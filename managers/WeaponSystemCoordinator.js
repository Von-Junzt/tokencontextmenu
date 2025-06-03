import { tickerDelay } from "../utils/timingUtils.js";
import { TIMING } from "../utils/constants.js";
import { tokenDragManager } from "./TokenDragManager.js";
import { targetingSessionManager } from "./TargetingSessionManager.js";

/**
 * Coordinates between weapon menu, selection, and movement systems
 * Acts as the central hub for cross-component communication
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

        this._setupHooks();
    }

    /**
     * Setup internal hooks for system coordination
     * @private
     */
    _setupHooks() {
        Hooks.on('tokencontextmenu.weaponMenuClosed', () => {
            // Stop all movement trackers FIRST
            for (const [tokenId, ticker] of this.state.movementTrackers) {
                ticker.stop();
            }
            this.state.movementTrackers.clear();

            // Clear any selection processing timeouts
            this.clearSelectionProcessing();

            // Update menu state AFTER all other cleanup
            this.updateMenuState({
                weaponMenuOpen: false,
                currentMenuApp: null,
                currentToken: null
            });
        });

        Hooks.on('canvasReady', () => {
            this.reset();
        });
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
        this.state.isProcessingSelection = true;

        if (this.state.selectionDelayId !== null) {
            tickerDelay.cancel(this.state.selectionDelayId);
        }

        this.state.selectionDelayId = tickerDelay.delay(() => {
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
        this.state.isProcessingSelection = false;
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
            targetingManager: targetingSessionManager.getDebugInfo()
        };
    }

    /**
     * Log current state to console for debugging
     */
    logState() {
        console.debug('Token Context Menu: System State:', this.getStateSnapshot());
    }

    /**
     * Full system reset - ensures UI and state stay synchronized
     * Called on scene changes to prevent state leaks
     */
    reset() {
        // Close any open menu application BEFORE clearing state
        if (this.state.currentMenuApp) {
            this.state.currentMenuApp.close();
        }

        // Stop all movement trackers
        for (const [tokenId, ticker] of this.state.movementTrackers) {
            ticker.stop();
        }
        this.state.movementTrackers.clear();

        // Clear selection processing
        this.clearSelectionProcessing();

        // Clear menu state
        this.updateMenuState({
            weaponMenuOpen: false,
            currentMenuApp: null,
            currentToken: null,
            menuOpenedAt: 0
        });
    }
}

// Export singleton instance  
export const weaponSystemCoordinator = new WeaponSystemCoordinator();

// Export for debugging
window.tokenContextMenuCoordinator = weaponSystemCoordinator;