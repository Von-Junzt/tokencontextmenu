import { CleanupManager } from "./CleanupManager.js";
import { StateManager } from "./StateManager.js";
import { debug, debugError } from "../utils/debug.js";

/**
 * Manages targeting sessions for the weapon menu system
 * 
 * @class TargetingSessionManager
 * @extends {CleanupManager}
 * @description Coordinates target selection workflows, ensuring only one targeting session
 * is active at a time. Handles cleanup when sessions end or scenes change.
 * 
 * @example
 * // Start a targeting session
 * targetingSessionManager.startSession('weapon-123', () => {
 *     debug('Targeting ended, cleanup UI');
 * });
 * 
 * // Check if targeting is active
 * if (targetingSessionManager.isActive()) {
 *     // Show targeting UI
 * }
 * 
 * @property {Object|null} activeSession - Current active targeting session
 */
class TargetingSessionManager extends CleanupManager {
    constructor() {
        super();
        
        // Initialize state using StateManager
        this.initializeState({
            activeSession: null
        });
        
        this._setupHooks();
    }
    
    /**
     * Set up hooks for targeting cleanup
     * @private
     */
    _setupHooks() {
        // Register hooks using CleanupManager
        // Note: canvasReady is already handled by handleCanvasReady
        
        // Clean up if weapon menu closes during targeting
        this.registerHook('tokencontextmenu.weaponMenuClosed', () => {
            this.endSession();
        });
    }
    
    /**
     * Override handleCanvasReady from CleanupManager
     */
    handleCanvasReady() {
        this.endSession();
    }
    
    /**
     * Start a new targeting session
     * @param {string} sessionId - Unique identifier for this session
     * @param {Function} cleanupCallback - Function to call when session ends
     * @returns {boolean} Whether session was started successfully
     * @description Ends any existing session before starting a new one. The cleanup
     * callback is stored and will be called when the session ends (either normally
     * or due to scene changes/menu closing).
     */
    startSession(sessionId, cleanupCallback) {
        // End any existing session first
        if (this.state.activeSession) {
            this.endSession();
        }
        
        this.updateState({
            activeSession: {
                id: sessionId,
                startTime: Date.now(),
                cleanup: cleanupCallback,
                targets: new Set()
            }
        });
        
        debug(`Started targeting session: ${sessionId}`);
        return true;
    }
    
    /**
     * End the current targeting session
     * @param {boolean} executeCleanup - Whether to run the cleanup callback
     */
    endSession(executeCleanup = true) {
        if (!this.state.activeSession) return;
        
        const session = this.state.activeSession;
        debug(`Ending targeting session: ${session.id}`);
        
        // Run cleanup callback if requested
        if (executeCleanup && session.cleanup) {
            try {
                session.cleanup();
            } catch (error) {
                debugError('Error during targeting cleanup:', error);
            }
        }
        
        // Clear the session
        this.updateState({ activeSession: null });
    }
    
    /**
     * Check if a targeting session is active
     * @returns {boolean}
     */
    isActive() {
        return this.state.activeSession !== null;
    }
    
    /**
     * Check if a specific session is the current active session
     * @param {string} sessionId 
     * @returns {boolean}
     */
    isCurrentSession(sessionId) {
        return this.state.activeSession?.id === sessionId;
    }

    /**
     * Get current session info
     * @returns {Object|null}
     */
    getSessionInfo() {
        if (!this.state.activeSession) return null;
        
        return {
            id: this.state.activeSession.id,
            duration: Date.now() - this.state.activeSession.startTime,
            targetCount: this.state.activeSession.targets.size,
            hasCleanup: !!this.state.activeSession.cleanup
        };
    }
    
    /**
     * Get debug information
     * @returns {Object}
     */
    getDebugInfo() {
        return {
            hasActiveSession: this.isActive(),
            sessionInfo: this.getSessionInfo()
        };
    }
    
    /**
     * Cleanup hooks when module is disabled
     */
    cleanup() {
        // End any active session
        this.endSession();
        
        // Reset state
        this.resetState();
        
        // Call parent cleanup to remove hooks
        super.cleanup();
    }
}

// Apply StateManager mixin
Object.assign(TargetingSessionManager.prototype, StateManager);

// Export singleton instance
export const targetingSessionManager = new TargetingSessionManager();