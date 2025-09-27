/**
 * @file WeaponSystemCoordinator - Central hub for weapon menu system coordination
 * @description This manager implements a facade pattern to coordinate between different
 * subsystems of the weapon menu module. It manages state, handles cross-component
 * communication, and ensures consistency across the system.
 * 
 * Architecture Overview:
 * - WeaponSystemCoordinator (this file) - Central state hub
 * - WeaponMenuTokenClickManager - Handles all token click/drag interactions
 * - TokenDragManager - Tracks drag states for individual tokens
 * - TargetingSessionManager - Manages weapon targeting workflows
 * - WeaponMenuApplication - The PIXI-based menu UI
 */

import { tickerDelay } from "../utils/timingUtils.js";
import { TIMING } from "../utils/constants.js";
import { tokenDragManager } from "./TokenDragManager.js";
import { targetingSessionManager } from "./TargetingSessionManager.js";
import { debug, debugWarn } from "../utils/debug.js";
import { CleanupManager } from "./CleanupManager.js";
import { StateManager } from "./StateManager.js";

/**
 * Coordinates between weapon menu, selection, and movement systems
 * 
 * @class WeaponSystemCoordinator
 * @description Central coordinator that manages the overall state of the weapon menu
 * system. Uses the facade pattern to provide a simple interface to complex subsystems.
 * All major components communicate through this coordinator to ensure consistency.
 * 
 * @property {Object} state - Central state store for the weapon menu system
 * @property {number} state.menuOpenedAt - Timestamp when menu was opened
 * @property {boolean} state.isProcessingSelection - Whether selection is being processed
 * @property {number|null} state.selectionDelayId - Timeout ID for selection processing
 * @property {WeaponMenuApplication|null} currentMenuApp - Reference to current menu (instance property)
 * @property {Token|null} currentToken - Token associated with current menu (instance property)
 * @property {Map} movementTrackers - Active movement tracking tickers (instance property)
 */
class WeaponSystemCoordinator extends CleanupManager {
    constructor() {
        super();
        
        // Initialize state using StateManager mixin
        this.initializeState({
            // Menu state
            menuOpenedAt: 0,

            // Selection coordination
            isProcessingSelection: false,
            selectionDelayId: null
        });
        
        // Object references - keep as instance properties since they can't be merged
        this.currentMenuApp = null;
        this.currentToken = null;
        
        // Movement tracking - keep as instance property since Map can't be in state
        this.movementTrackers = new Map();

        // Performance cache for controlled tokens
        this._controlledTokensCache = {
            tokens: [],
            count: 0,
            singleToken: null,
            version: 0  // Use version counter instead of timestamp
        };
        
        // Register cleanup callback for movement trackers
        this.onCleanup(() => {
            // Stop all movement trackers
            for (const [tokenId, ticker] of this.movementTrackers) {
                ticker.stop();
            }
            this.movementTrackers.clear();
        });

        this._setupHooks();
    }

    /**
     * Setup internal hooks for system coordination
     * @private
     */
    _setupHooks() {
        // Register hooks using CleanupManager's automatic tracking
        this.registerHook('controlToken', (token, controlled) => {
            this._invalidateControlledTokensCache();
            
            // Clear selection processing if token is being deselected
            if (!controlled && this.state.isProcessingSelection) {
                debug('Token deselected during selection processing, clearing timeout');
                this.clearSelectionProcessing();
            }
        });
        
        this.registerHook('tokencontextmenu.weaponMenuClosed', () => {
            // Stop all movement trackers FIRST
            for (const [tokenId, ticker] of this.movementTrackers) {
                ticker.stop();
            }
            this.movementTrackers.clear();

            // Clear any selection processing timeouts
            this.clearSelectionProcessing();

            // Note: Menu state is already updated by weaponMenuCloser.js
            // This hook is just for additional cleanup
        });
        
        this.registerHook('deleteToken', (tokenDocument) => {
            // Clear selection processing if the deleted token was being processed
            if (this.state.isProcessingSelection) {
                debug('Token deleted during selection processing, clearing timeout');
                this.clearSelectionProcessing();
            }
            
            // Also invalidate cache since controlled tokens may have changed
            this._invalidateControlledTokensCache();
        });
    }
    
    /**
     * Override handleCanvasReady from CleanupManager
     * Called automatically on canvasReady hook
     */
    async handleCanvasReady() {
        await this.reset();
        this._invalidateControlledTokensCache();
    }

    /**
     * Update menu state with partial changes
     * @param {Object} changes - State changes to apply
     */
    updateMenuState(changes) {
        // Handle object references separately
        if ('currentMenuApp' in changes) {
            this.currentMenuApp = changes.currentMenuApp;
        }
        if ('currentToken' in changes) {
            this.currentToken = changes.currentToken;
        }
        
        // Filter out object references before updating state
        const stateChanges = {};
        for (const [key, value] of Object.entries(changes)) {
            if (key !== 'currentMenuApp' && key !== 'currentToken') {
                stateChanges[key] = value;
            }
        }
        
        // Update state with only serializable values
        if (Object.keys(stateChanges).length > 0) {
            this.updateState(stateChanges);
        }

        // Clear selection processing when menu app is set
        if (changes.currentMenuApp) {
            tickerDelay.delay(() => {
                this.clearSelectionProcessing();
            }, TIMING.MENU_SELECTION_CLEAR, 'clearSelectionOnOpen');
        }
    }

    /**
     * Check if weapon menu is currently open
     * @returns {boolean} True if menu is open
     */
    isMenuOpen() {
        return this.currentMenuApp?.stateMachine?.isActive() || false;
    }

    /**
     * Get the token associated with the current menu
     * @returns {Token|null} The current menu's token
     */
    getMenuToken() {
        return this.currentToken;
    }

    /**
     * Set the current menu application reference
     * @param {WeaponMenuApplication|null} app - The menu application
     */
    setMenuApp(app) {
        this.currentMenuApp = app;
    }

    /**
     * Get the current menu application
     * @returns {WeaponMenuApplication|null} The current menu app
     */
    getMenuApp() {
        return this.currentMenuApp;
    }

    /**
     * Start selection processing with timeout
     * Prevents race conditions between selection and click events
     */
    startSelectionProcessing() {
        if (this.state.isProcessingSelection) {
            debugWarn('Selection processing already active, resetting timeout');
        }
        
        this.updateState({ isProcessingSelection: true });
        debug('Selection processing started, will timeout in', TIMING.SELECTION_TIMEOUT, 'ms');

        if (this.state.selectionDelayId !== null) {
            tickerDelay.cancel(this.state.selectionDelayId);
        }

        const delayId = tickerDelay.delay(() => {
            debugWarn('Selection processing timed out, force clearing');
            this.clearSelectionProcessing();
        }, TIMING.SELECTION_TIMEOUT, 'selectionProcessingTimeout');
        
        this.updateState({ selectionDelayId: delayId });
    }

    /**
     * Clear selection processing state and timeouts
     */
    clearSelectionProcessing() {
        if (this.state.selectionDelayId !== null) {
            tickerDelay.cancel(this.state.selectionDelayId);
            this.updateState({ selectionDelayId: null });
        }
        
        if (this.state.isProcessingSelection) {
            debug('Selection processing cleared');
            this.updateState({ isProcessingSelection: false });
        }
    }

    /**
     * Check if currently processing a selection event
     * @returns {boolean} True if processing selection
     */
    isProcessingSelection() {
        return this.state.isProcessingSelection;
    }

    /**
     * Check if within click debounce window
     * @returns {boolean} True if within debounce period
     */
    isWithinDebounceWindow() {
        const now = Date.now();
        return (now - this.state.menuOpenedAt) < TIMING.MENU_CLICK_DEBOUNCE;
    }

    /**
     * Update the menu opened timestamp for debouncing
     */
    updateOpenTime() {
        this.updateState({ menuOpenedAt: Date.now() });
    }

    /**
     * Add a movement tracker for a token
     * @param {string} tokenId - The token ID
     * @param {PIXI.Ticker} ticker - The PIXI ticker instance
     */
    addMovementTracker(tokenId, ticker) {
        this.movementTrackers.set(tokenId, ticker);
    }

    /**
     * Remove and stop a movement tracker
     * @param {string} tokenId - The token ID
     */
    removeMovementTracker(tokenId) {
        const ticker = this.movementTrackers.get(tokenId);
        if (ticker) {
            ticker.stop();
            this.movementTrackers.delete(tokenId);
        }
    }

    /**
     * Initialize drag tracking for a token (delegates to TokenDragManager)
     * @param {Token} token - The token to track
     * @returns {Object} Drag state object
     */
    initializeDragTracking(token) {
        return tokenDragManager.initializeDragState(token);
    }

    /**
     * Get drag state for a token (delegates to TokenDragManager)
     * @param {Token} token - The token
     * @returns {Object|null} Drag state or null
     */
    getDragState(token) {
        return tokenDragManager.getDragState(token);
    }

    /**
     * Update drag state for a token (delegates to TokenDragManager)
     * @param {Token} token - The token
     * @param {Object} changes - State changes
     */
    updateDragState(token, changes) {
        tokenDragManager.updateDragState(token, changes);
    }

    /**
     * Reset drag state for a token (delegates to TokenDragManager)
     * @param {Token} token - The token
     */
    resetDragState(token) {
        tokenDragManager.resetDragState(token);
    }

    /**
     * Start a targeting session (delegates to TargetingSessionManager)
     * @param {string} sessionId - Unique session ID
     * @param {Function} cleanup - Cleanup callback
     * @returns {boolean} True if session started
     */
    startTargeting(sessionId, cleanup) {
        return targetingSessionManager.startSession(sessionId, cleanup);
    }

    /**
     * Stop the current targeting session (delegates to TargetingSessionManager)
     */
    stopTargeting() {
        targetingSessionManager.endSession();
    }

    /**
     * Check if a session ID matches current targeting (delegates to TargetingSessionManager)
     * @param {string} sessionId - Session ID to check
     * @returns {boolean} True if current session
     */
    isCurrentTargetingSession(sessionId) {
        return targetingSessionManager.isCurrentSession(sessionId);
    }

    /**
     * Get a snapshot of current system state for debugging
     * @returns {Object} State snapshot
     */
    getStateSnapshot() {
        return {
            // Core state
            weaponMenuOpen: this.isMenuOpen(),
            isProcessingSelection: this.state.isProcessingSelection,
            currentToken: this.currentToken?.name || null,
            movementTrackerCount: this.movementTrackers.size,
            
            // Delegated state
            dragManager: tokenDragManager.getDebugInfo(this.currentToken),
            targetingManager: targetingSessionManager.getDebugInfo(),
            
            // Cache state
            controlledTokensCache: {
                count: this._controlledTokensCache.count,
                hasSingle: !!this._controlledTokensCache.singleToken,
                version: this._controlledTokensCache.version,
                cachedVersion: this._cachedVersion
            }
        };
    }

    /**
     * Log current state to console for debugging
     */
    logState() {
        debug('Token Context Menu: System State:', this.getStateSnapshot());
    }

    /**
     * Invalidate the controlled tokens cache
     * @private
     */
    _invalidateControlledTokensCache() {
        this._controlledTokensCache.version++;
    }

    /**
     * Update the controlled tokens cache if needed
     * @private
     */
    _updateControlledTokensCache() {
        // Skip if cache is already updated for this version
        if (this._cachedVersion === this._controlledTokensCache.version) {
            return;
        }

        // Clear cache if canvas not ready
        if (!canvas?.ready) {
            this._controlledTokensCache.tokens = [];
            this._controlledTokensCache.count = 0;
            this._controlledTokensCache.singleToken = null;
            this._cachedVersion = this._controlledTokensCache.version;
            return;
        }

        const controlled = canvas.tokens?.controlled || [];
        this._controlledTokensCache.tokens = [...controlled]; // Defensive copy
        this._controlledTokensCache.count = controlled.length;
        this._controlledTokensCache.singleToken = controlled.length === 1 ? controlled[0] : null;
        this._cachedVersion = this._controlledTokensCache.version;
    }

    /**
     * Get controlled tokens (cached)
     * @returns {Token[]} Array of controlled tokens
     */
    getControlledTokens() {
        this._updateControlledTokensCache();
        return this._controlledTokensCache.tokens;
    }

    /**
     * Get count of controlled tokens (cached)
     * @returns {number} Number of controlled tokens
     */
    getControlledTokensCount() {
        this._updateControlledTokensCache();
        return this._controlledTokensCache.count;
    }

    /**
     * Check if exactly one token is controlled (cached)
     * @returns {boolean} True if exactly one token is controlled
     */
    hasExactlyOneControlledToken() {
        this._updateControlledTokensCache();
        return this._controlledTokensCache.count === 1;
    }

    /**
     * Get the single controlled token if exactly one is controlled (cached)
     * @returns {Token|null} The single controlled token or null
     */
    getSingleControlledToken() {
        this._updateControlledTokensCache();
        return this._controlledTokensCache.singleToken;
    }

    /**
     * Check if a specific token is the only controlled token (cached)
     * @param {Token} token - Token to check
     * @returns {boolean} True if this token is the only controlled token
     */
    isOnlyControlledToken(token) {
        this._updateControlledTokensCache();
        return this._controlledTokensCache.count === 1 && 
               this._controlledTokensCache.singleToken === token;
    }

    /**
     * Full system reset - ensures UI and state stay synchronized
     * Called on scene changes to prevent state leaks
     */
    async reset() {
        // Use centralized closer for menu cleanup
        const { forceCloseAllMenus } = await import("../utils/weaponMenuCloser.js");
        await forceCloseAllMenus('system-reset');

        // Stop all movement trackers before resetting state
        for (const [tokenId, ticker] of this.movementTrackers) {
            ticker.stop();
        }

        // Clear selection processing
        this.clearSelectionProcessing();

        // Reset state to initial values using StateManager
        this.resetState();
        
        // Reset instance properties
        this.currentMenuApp = null;
        this.currentToken = null;
        this.movementTrackers.clear();
        
        // Re-invalidate cache after reset
        this._invalidateControlledTokensCache();
    }
    
    /**
     * Cleanup all hooks and state
     * Call this when the module is disabled
     */
    cleanup() {
        // Reset the system first
        this.reset();
        
        // Call parent cleanup to remove all hooks automatically
        super.cleanup();
    }
}

// Apply StateManager mixin
Object.assign(WeaponSystemCoordinator.prototype, StateManager);

// Export singleton instance  
export const weaponSystemCoordinator = new WeaponSystemCoordinator();

// Export for debugging
window.tokenContextMenuCoordinator = weaponSystemCoordinator;