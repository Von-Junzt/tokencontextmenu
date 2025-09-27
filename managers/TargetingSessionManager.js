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

    // ============= Phase 2 Refactoring: Weapon Targeting Logic =============

    /**
     * Begin a weapon roll targeting session (Phase 2 feature extraction)
     * @param {Token} token - The token making the attack
     * @param {string} weaponId - The ID of the weapon being used
     * @param {Function} hideMenuCallback - Callback to hide the menu
     * @returns {Promise<void>}
     */
    async beginWeaponRoll(token, weaponId, hideMenuCallback) {
        // Import dependencies to avoid circular references
        const { betterRollsAdapter } = await import("../integrations/BetterRollsAdapter.js");
        const { shouldAutoRemoveTargets } = await import("../settings/settings.js");
        const { showTargetTooltip, setupTargetClickHandlers, emergencyCleanupTargeting } = await import("../utils/interactionLayerUtils.js");

        // Hide menu first to prevent interference
        if (hideMenuCallback) hideMenuCallback();

        // Get weapon
        const weapon = token.actor.items.find(i => i.id === weaponId);
        if (!weapon) {
            ui.notifications.error("Weapon not found.");
            return;
        }

        // Ensure weapon data is up to date
        await weapon.prepareDerivedData?.();

        debug(`Beginning weapon roll for "${weapon.name}"`, {
            weaponId: weapon.id,
            requiresTarget: betterRollsAdapter.requiresTarget(weapon)
        });

        // Check if weapon requires a target
        if (!betterRollsAdapter.requiresTarget(weapon)) {
            // Template/AOE weapons - create roll immediately
            if (game.user.targets.size > 0) {
                debug(`Clearing ${game.user.targets.size} lingering targets for template weapon`);
                game.user.targets.forEach(t => t.setTarget(false, {user: game.user}));
                game.user.targets.clear();
            }
            await betterRollsAdapter.createWeaponCard(token.actor, weaponId, { tokenId: token.id });
            return;
        }

        // Clear existing targets if the setting is enabled
        if (shouldAutoRemoveTargets()) {
            game.user.targets.forEach(t => t.setTarget(false, {user: game.user}));
            game.user.targets.clear();
        }

        // Check for existing target
        if (game.user.targets.size > 0) {
            // We have a target, create the card directly
            await betterRollsAdapter.createWeaponCard(token.actor, weaponId, { tokenId: token.id });
            return;
        }

        // No target - need to start targeting session
        await this.startWeaponTargeting(token, weaponId);
    }

    /**
     * Start a weapon targeting session (Phase 2 feature extraction)
     * @param {Token} token - The token making the attack
     * @param {string} weaponId - The ID of the weapon
     * @returns {Promise<void>}
     */
    async startWeaponTargeting(token, weaponId) {
        // Import dependencies
        const { showTargetTooltip, setupTargetClickHandlers, emergencyCleanupTargeting } = await import("../utils/interactionLayerUtils.js");

        // End any existing targeting session
        if (this.isActive()) {
            this.endSession();
        }

        // Clean up any existing targeting first
        emergencyCleanupTargeting();

        // Show the target tooltip IMMEDIATELY
        showTargetTooltip(true);

        // Store data for later
        const pendingData = {
            actorId: token.actor.id,
            weaponId: weaponId,
            tokenId: token.id,
            timestamp: Date.now()
        };

        // Store the pending data
        await game.user.setFlag('tokencontextmenu', 'pendingWeaponRoll', pendingData);

        // Start the targeting session
        const sessionId = `weapon-${weaponId}-${Date.now()}`;
        this.startSession(sessionId, () => {
            showTargetTooltip(false);
        });

        // Variable to track if we've already handled the targeting
        let targetHandled = false;

        // Set up click handlers for target selection
        setupTargetClickHandlers(
            pendingData,
            // On target selected callback
            async () => {
                if (targetHandled) return;
                targetHandled = true;

                showTargetTooltip(false);
                await this.completeWeaponTargeting(token, pendingData);
            },
            // On abort callback
            async (reason) => {
                if (targetHandled) return;
                targetHandled = true;

                showTargetTooltip(false);
                await game.user.unsetFlag('tokencontextmenu', 'pendingWeaponRoll');
                this.endSession();

                if (reason && !reason.includes('manually aborted')) {
                    ui.notifications.warn(reason);
                }
            }
        );
    }

    /**
     * Complete a weapon targeting session (Phase 2 feature extraction)
     * @param {Token} token - The token making the attack
     * @param {Object} pendingData - The pending weapon roll data
     * @returns {Promise<void>}
     */
    async completeWeaponTargeting(token, pendingData) {
        const { betterRollsAdapter } = await import("../integrations/BetterRollsAdapter.js");

        const storedData = await game.user.getFlag('tokencontextmenu', 'pendingWeaponRoll');

        // Verify it's the same pending action (using timestamp)
        if (storedData && storedData.timestamp === pendingData.timestamp) {
            await game.user.unsetFlag('tokencontextmenu', 'pendingWeaponRoll');

            const actor = token.actor;
            if (actor && game.user.targets.size > 0) {
                await betterRollsAdapter.createWeaponCard(actor, storedData.weaponId, { tokenId: token.id });
            } else if (!game.user.targets.size) {
                ui.notifications.warn("Target was lost. Please try again.");
            } else {
                ui.notifications.error("Could not find the actor. Please try again.");
            }
        } else {
            debug('Stored data mismatch or missing');
            ui.notifications.warn("Action data mismatch. Please try again.");
        }

        // End the targeting session
        this.endSession();
    }
}

// Apply StateManager mixin
Object.assign(TargetingSessionManager.prototype, StateManager);

// Export singleton instance
export const targetingSessionManager = new TargetingSessionManager();