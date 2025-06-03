/**
 * Manages targeting sessions for the weapon menu system
 * Handles target selection workflows and cleanup
 */
class TargetingSessionManager {
    constructor() {
        this.activeSession = null;
        this._setupHooks();
    }
    
    /**
     * Set up hooks for targeting cleanup
     * @private
     */
    _setupHooks() {
        // Clean up on canvas ready
        Hooks.on('canvasReady', () => {
            this.endSession();
        });
        
        // Clean up if weapon menu closes during targeting
        Hooks.on('tokencontextmenu.weaponMenuClosed', () => {
            this.endSession();
        });
    }
    
    /**
     * Start a new targeting session
     * @param {string} sessionId - Unique identifier for this session
     * @param {Function} cleanupCallback - Function to call when session ends
     * @returns {boolean} Whether session was started successfully
     */
    startSession(sessionId, cleanupCallback) {
        // End any existing session first
        if (this.activeSession) {
            this.endSession();
        }
        
        this.activeSession = {
            id: sessionId,
            startTime: Date.now(),
            cleanup: cleanupCallback,
            targets: new Set()
        };
        
        console.debug(`tokencontextmenu | Started targeting session: ${sessionId}`);
        return true;
    }
    
    /**
     * End the current targeting session
     * @param {boolean} executeCleanup - Whether to run the cleanup callback
     */
    endSession(executeCleanup = true) {
        if (!this.activeSession) return;
        
        const session = this.activeSession;
        console.debug(`tokencontextmenu | Ending targeting session: ${session.id}`);
        
        // Run cleanup callback if requested
        if (executeCleanup && session.cleanup) {
            try {
                session.cleanup();
            } catch (error) {
                console.error('tokencontextmenu | Error during targeting cleanup:', error);
            }
        }
        
        // Clear the session
        this.activeSession = null;
    }
    
    /**
     * Check if a targeting session is active
     * @returns {boolean}
     */
    isActive() {
        return this.activeSession !== null;
    }
    
    /**
     * Check if a specific session is the current active session
     * @param {string} sessionId 
     * @returns {boolean}
     */
    isCurrentSession(sessionId) {
        return this.activeSession?.id === sessionId;
    }
    
    /**
     * Add a target to the current session
     * @param {string} targetId 
     * @returns {boolean} Whether target was added
     */
    addTarget(targetId) {
        if (!this.activeSession) return false;
        this.activeSession.targets.add(targetId);
        return true;
    }
    
    /**
     * Remove a target from the current session
     * @param {string} targetId 
     * @returns {boolean} Whether target was removed
     */
    removeTarget(targetId) {
        if (!this.activeSession) return false;
        return this.activeSession.targets.delete(targetId);
    }
    
    /**
     * Get all targets in current session
     * @returns {Set<string>|null}
     */
    getTargets() {
        return this.activeSession?.targets || null;
    }
    
    /**
     * Get current session info
     * @returns {Object|null}
     */
    getSessionInfo() {
        if (!this.activeSession) return null;
        
        return {
            id: this.activeSession.id,
            duration: Date.now() - this.activeSession.startTime,
            targetCount: this.activeSession.targets.size,
            hasCleanup: !!this.activeSession.cleanup
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
}

// Export singleton instance
export const targetingSessionManager = new TargetingSessionManager();