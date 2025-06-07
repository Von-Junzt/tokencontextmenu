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

/**
 * Coordinates between weapon menu, selection, and movement systems
 * 
 * @class WeaponSystemCoordinator
 * @description Central coordinator that manages the overall state of the weapon menu
 * system. Uses the facade pattern to provide a simple interface to complex subsystems.
 * All major components communicate through this coordinator to ensure consistency.
 * 
 * @property {Object} state - Central state store for the weapon menu system
 * @property {boolean} state.weaponMenuOpen - Whether a menu is currently open
 * @property {number} state.menuOpenedAt - Timestamp when menu was opened
 * @property {WeaponMenuApplication|null} state.currentMenuApp - Reference to current menu
 * @property {Token|null} state.currentToken - Token associated with current menu
 * @property {Map} state.movementTrackers - Active movement tracking tickers
 */
class WeaponSystemCoordinator {
    constructor() {
        this.state = {
            // Menu state
            weaponMenuOpen: false,
            menuOpenedAt: 0,
            currentMenuApp: null,
            currentToken: null,

            // Selection coordination
            isProcessingSelection: false,
            selectionDelayId: null,

            // Movement tracking
            movementTrackers: new Map()
        };

        // Performance cache for controlled tokens
        this._controlledTokensCache = {
            tokens: [],
            count: 0,
            singleToken: null,
            version: 0  // Use version counter instead of timestamp
        };

        this._setupHooks();
    }

    /**
     * Setup internal hooks for system coordination
     * @private
     */
    _setupHooks() {
        // Store hook handlers for cleanup
        this._controlTokenHandler = () => {
            this._invalidateControlledTokensCache();
        };
        
        this._weaponMenuClosedHandler = () => {
            // Stop all movement trackers FIRST
            for (const [tokenId, ticker] of this.state.movementTrackers) {
                ticker.stop();
            }
            this.state.movementTrackers.clear();

            // Clear any selection processing timeouts
            this.clearSelectionProcessing();

            // Note: Menu state is already updated by weaponMenuCloser.js
            // This hook is just for additional cleanup
        };
        
        this._canvasReadyHandler = async () => {
            await this.reset();
            this._invalidateControlledTokensCache();
        };
        
        // Register hooks
        Hooks.on('controlToken', this._controlTokenHandler);
        Hooks.on('tokencontextmenu.weaponMenuClosed', this._weaponMenuClosedHandler);
        Hooks.on('canvasReady', this._canvasReadyHandler);
    }

    /**
     * Update menu state with partial changes
     * @param {Object} changes - State changes to apply
     */
    updateMenuState(changes) {
        Object.assign(this.state, changes);

        // Clear selection processing when menu successfully opens
        if (changes.weaponMenuOpen === true) {
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
        return this.state.weaponMenuOpen;
    }

    /**
     * Get the token associated with the current menu
     * @returns {Token|null} The current menu's token
     */
    getMenuToken() {
        return this.state.currentToken;
    }

    /**
     * Set the current menu application reference
     * @param {WeaponMenuApplication|null} app - The menu application
     */
    setMenuApp(app) {
        this.state.currentMenuApp = app;
    }

    /**
     * Get the current menu application
     * @returns {WeaponMenuApplication|null} The current menu app
     */
    getMenuApp() {
        return this.state.currentMenuApp;
    }

    /**
     * Start selection processing with timeout
     * Prevents race conditions between selection and click events
     */
    startSelectionProcessing() {
        if (this.state.isProcessingSelection) {
            debugWarn('Selection processing already active, resetting timeout');
        }
        
        this.state.isProcessingSelection = true;
        debug('Selection processing started, will timeout in', TIMING.SELECTION_TIMEOUT, 'ms');

        if (this.state.selectionDelayId !== null) {
            tickerDelay.cancel(this.state.selectionDelayId);
        }

        this.state.selectionDelayId = tickerDelay.delay(() => {
            debugWarn('Selection processing timed out, force clearing');
            this.clearSelectionProcessing();
        }, TIMING.SELECTION_TIMEOUT, 'selectionProcessingTimeout');
    }

    /**
     * Clear selection processing state and timeouts
     */
    clearSelectionProcessing() {
        if (this.state.selectionDelayId !== null) {
            tickerDelay.cancel(this.state.selectionDelayId);
            this.state.selectionDelayId = null;
        }
        
        if (this.state.isProcessingSelection) {
            debug('Selection processing cleared');
            this.state.isProcessingSelection = false;
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
        this.state.menuOpenedAt = Date.now();
    }

    /**
     * Add a movement tracker for a token
     * @param {string} tokenId - The token ID
     * @param {PIXI.Ticker} ticker - The PIXI ticker instance
     */
    addMovementTracker(tokenId, ticker) {
        this.state.movementTrackers.set(tokenId, ticker);
    }

    /**
     * Remove and stop a movement tracker
     * @param {string} tokenId - The token ID
     */
    removeMovementTracker(tokenId) {
        const ticker = this.state.movementTrackers.get(tokenId);
        if (ticker) {
            ticker.stop();
            this.state.movementTrackers.delete(tokenId);
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
            weaponMenuOpen: this.state.weaponMenuOpen,
            isProcessingSelection: this.state.isProcessingSelection,
            currentToken: this.state.currentToken?.name || null,
            movementTrackerCount: this.state.movementTrackers.size,
            
            // Delegated state
            dragManager: tokenDragManager.getDebugInfo(this.state.currentToken),
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
        console.debug('Token Context Menu: System State:', this.getStateSnapshot());
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

        // Stop all movement trackers
        for (const [tokenId, ticker] of this.state.movementTrackers) {
            ticker.stop();
        }
        this.state.movementTrackers.clear();

        // Clear selection processing
        this.clearSelectionProcessing();

        // Clear menu state - no need to update here as forceCloseAllMenus already does it
        this.state.menuOpenedAt = 0;
    }
    
    /**
     * Cleanup all hooks and state
     * Call this when the module is disabled
     */
    cleanup() {
        // Remove hooks
        if (this._controlTokenHandler) {
            Hooks.off('controlToken', this._controlTokenHandler);
            this._controlTokenHandler = null;
        }
        
        if (this._weaponMenuClosedHandler) {
            Hooks.off('tokencontextmenu.weaponMenuClosed', this._weaponMenuClosedHandler);
            this._weaponMenuClosedHandler = null;
        }
        
        if (this._canvasReadyHandler) {
            Hooks.off('canvasReady', this._canvasReadyHandler);
            this._canvasReadyHandler = null;
        }
        
        // Reset the system
        this.reset();
    }
}

// Export singleton instance  
export const weaponSystemCoordinator = new WeaponSystemCoordinator();

// Export for debugging
window.tokenContextMenuCoordinator = weaponSystemCoordinator;