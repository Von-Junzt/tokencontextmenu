/**
 * @file BetterRollsAdapter.js
 * @description Adapter for Better Rolls 2 integration (Phase 2 refactoring)
 *
 * This adapter provides a clean interface to Better Rolls functionality,
 * decoupling the module's core logic from the specific roll system.
 * Future roll systems can be integrated by creating similar adapters.
 */

import { debug, debugWarn } from "../utils/debug.js";

/**
 * Adapter class for Better Rolls 2 integration
 * Provides a consistent interface for weapon roll creation
 */
export class BetterRollsAdapter {
    /**
     * Check if Better Rolls is available and active
     * @returns {boolean} True if Better Rolls can be used
     */
    static isAvailable() {
        return game.modules.get('betterrolls-swade2')?.active &&
               typeof game.brsw?.create_item_card === 'function';
    }

    /**
     * Create a weapon attack card using Better Rolls
     * @param {Actor} actor - The actor making the attack
     * @param {string} weaponId - The ID of the weapon being used
     * @param {Object} options - Additional options for the roll
     * @param {string} [options.tokenId] - The ID of the token making the attack
     * @returns {Promise<void>}
     */
    static async createWeaponCard(actor, weaponId, options = {}) {
        if (!this.isAvailable()) {
            debugWarn("Better Rolls 2 is not available");
            ui.notifications.error("Better Rolls 2 module is required for weapon attacks");
            return;
        }

        if (!actor) {
            debugWarn("No actor provided for weapon card creation");
            return;
        }

        const weapon = actor.items.get(weaponId);
        if (!weapon) {
            debugWarn(`Weapon ${weaponId} not found on actor ${actor.name}`);
            ui.notifications.error("Weapon not found");
            return;
        }

        debug(`Creating Better Rolls card for ${weapon.name}`, {
            actor: actor.name,
            weaponId,
            options
        });

        try {
            // Call Better Rolls to create the attack card
            await game.brsw.create_item_card(actor, weaponId, options);

            debug(`Successfully created attack card for ${weapon.name}`);
        } catch (error) {
            debugWarn(`Failed to create Better Rolls card:`, error);
            ui.notifications.error(`Failed to create attack card: ${error.message}`);
        }
    }

    /**
     * Create a power activation card using Better Rolls
     * @param {Actor} actor - The actor using the power
     * @param {string} powerId - The ID of the power being used
     * @param {Object} options - Additional options for the roll
     * @returns {Promise<void>}
     */
    static async createPowerCard(actor, powerId, options = {}) {
        // Powers use the same card creation method as weapons in Better Rolls
        return this.createWeaponCard(actor, powerId, options);
    }

    /**
     * Check if an item requires a target for its roll
     * @param {Item} item - The item to check
     * @returns {boolean} True if the item requires a target
     */
    static requiresTarget(item) {
        if (!item) return false;

        // Check if the item has AOE templates which don't require a specific target
        const hasTemplateAOE = item?.system?.templates &&
            Object.values(item.system.templates).some(v => v === true);

        // Template weapons don't require a target
        if (hasTemplateAOE) {
            debug(`${item.name} has AOE template, no target required`);
            return false;
        }

        // Most weapons require a target unless they're AOE
        if (item.type === 'weapon') {
            return true;
        }

        // Powers might require targets depending on their type
        // This could be expanded based on power properties
        if (item.type === 'power') {
            // For now, assume non-AOE powers need targets
            return !hasTemplateAOE;
        }

        return false;
    }

    /**
     * Clear any pending roll data from Better Rolls
     * This might be needed if a roll is cancelled
     */
    static clearPendingRoll() {
        // Better Rolls doesn't maintain pending state that needs clearing
        // This method exists for future compatibility with other systems
        debug("Clearing any pending roll state");
    }
}

// Export singleton-style access for convenience
export const betterRollsAdapter = BetterRollsAdapter;