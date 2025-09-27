/**
 * @file Equipment mode handler for weapon menu
 * @description Manages equipment mode logic including equip/unequip operations and special weapon rules
 */

import { debug, debugWarn } from "../utils/debug.js";
import { WEAPON_PRIORITY, EQUIP_STATUS } from "../utils/constants.js";

/**
 * Handles equipment mode operations and business logic
 * Separates equipment management concerns from UI rendering
 */
class EquipmentModeHandler {
    constructor() {
        // WeakMap for tracking equipment mode states per actor
        this.actorStates = new WeakMap();
    }

    /**
     * Determines the update operations needed for a weapon in equipment mode
     * @param {Item} weapon - The weapon item to process
     * @returns {Object|null} Update operations or null if invalid
     */
    getWeaponUpdateOperations(weapon) {
        if (!weapon?.system) {
            debugWarn("Invalid weapon for equipment mode", weapon);
            return null;
        }

        const weaponName = weapon.name.toLowerCase();
        const currentStatus = weapon.system.equipStatus;
        const isSpecialWeapon = this.isSpecialWeapon(weaponName);
        const hasTemplateAOE = this.hasTemplateAOE(weapon);

        debug(`Determining equipment operation for: ${weapon.name}`, {
            currentStatus,
            isSpecialWeapon,
            hasTemplateAOE
        });

        // Special weapons (unarmed, claws) toggle between equipped (4) and carried (1)
        if (isSpecialWeapon) {
            return {
                update: { "system.equipStatus": weapon.isReadied ? 1 : 4 },
                description: weapon.isReadied ? "Unequipping special weapon" : "Equipping special weapon"
            };
        }

        // Template weapons toggle between carried (1) and stored (0), never equipped
        if (hasTemplateAOE) {
            let newStatus;
            if (weapon.isReadied) {
                // Incorrectly equipped -> Move to carried
                newStatus = 1;
            } else if (currentStatus === 1) {
                // Carried -> Store it
                newStatus = 0;
            } else {
                // Stored -> Carry it
                newStatus = 1;
            }

            return {
                update: { "system.equipStatus": newStatus },
                description: `Changing template weapon status from ${currentStatus} to ${newStatus}`
            };
        }

        // Normal weapons toggle between equipped and carried
        return {
            update: { "system.equipStatus": weapon.isReadied ? 1 : 4 },
            description: weapon.isReadied ? "Unequipping weapon" : "Equipping weapon",
            useHandler: true // Use existing handlers for normal weapons
        };
    }

    /**
     * Checks if a weapon is a special type
     * @param {string} weaponName - Lowercase weapon name
     * @returns {boolean}
     */
    isSpecialWeapon(weaponName) {
        return WEAPON_PRIORITY.SPECIAL_WEAPONS.some(special => weaponName.includes(special));
    }

    /**
     * Checks if a weapon has template AOE properties
     * @param {Item} weapon - The weapon item
     * @returns {boolean}
     */
    hasTemplateAOE(weapon) {
        return weapon?.system?.templates && 
               Object.values(weapon.system.templates).some(v => v === true);
    }

    /**
     * Determines if a power should be toggled in equipment mode
     * @param {Item} power - The power item
     * @param {boolean} isExpanded - Whether powers section is expanded
     * @returns {boolean}
     */
    shouldTogglePower(power, isExpanded) {
        return isExpanded && power?.type === "power" && power.system.favorite === true;
    }

    /**
     * Tracks equipment mode state for an actor
     * @param {Actor} actor - The actor
     * @param {boolean} enabled - Equipment mode state
     */
    setEquipmentModeState(actor, enabled) {
        if (!actor) return;
        this.actorStates.set(actor, { enabled, lastUpdate: Date.now() });
    }

    /**
     * Gets equipment mode state for an actor
     * @param {Actor} actor - The actor
     * @returns {boolean}
     */
    getEquipmentModeState(actor) {
        if (!actor) return false;
        const state = this.actorStates.get(actor);
        return state?.enabled || false;
    }

    /**
     * Cycles through valid equipment statuses for a weapon
     * @param {Item} weapon - The weapon item
     * @returns {number} The next equipment status in the cycle
     */
    cycleEquipmentStatus(weapon) {
        if (!weapon?.system) {
            debugWarn("Invalid weapon for cycling equipment status", weapon);
            return 0;
        }

        const current = weapon.system.equipStatus;
        const hasTemplateAOE = this.hasTemplateAOE(weapon);

        if (hasTemplateAOE) {
            // Template weapons: toggle between stored (0) and carried (1) only
            return current === 0 ? 1 : 0;
        }

        // Normal weapons: cycle through all valid states
        const currentIndex = EQUIP_STATUS.CYCLE_ORDER.indexOf(current);
        const nextIndex = (currentIndex + 1) % EQUIP_STATUS.CYCLE_ORDER.length;
        return EQUIP_STATUS.CYCLE_ORDER[nextIndex];
    }

    // ============= Phase 2 Refactoring: Extracted Feature Logic =============

    /**
     * Reloads a weapon to full ammo (Phase 2 feature extraction)
     * @param {Actor} actor - The actor that owns the weapon
     * @param {string} weaponId - The ID of the weapon to reload
     * @returns {Promise<boolean>} True if successful
     */
    async reloadWeapon(actor, weaponId) {
        // Check permissions
        if (!actor?.isOwner) {
            ui.notifications.warn("You don't have permission to modify this token");
            return false;
        }

        const weapon = actor.items.get(weaponId);
        if (!weapon || weapon.type !== "weapon") {
            debugWarn("Invalid weapon for reloading:", weaponId);
            return false;
        }

        // Check if weapon has ammo system
        if (weapon.system?.shots === undefined || weapon.system?.currentShots === undefined) {
            debugWarn("Weapon does not have ammo system:", weapon.name);
            return false;
        }

        debug(`Reloading weapon: ${weapon.name} from ${weapon.system.currentShots}/${weapon.system.shots}`);

        try {
            // Call SWADE's reload method if available, otherwise update currentShots
            if (weapon.reload && typeof weapon.reload === 'function') {
                await weapon.reload();
            } else {
                // Fallback to manual update
                await weapon.update({ "system.currentShots": weapon.system.shots });
            }

            debug(`${weapon.name} reloaded successfully!`);
            return true;
        } catch (error) {
            debugWarn(`Failed to reload weapon ${weapon.name}:`, error);
            ui.notifications.error(`Failed to reload ${weapon.name}`);
            return false;
        }
    }

    /**
     * Equips a carried weapon (Phase 2 feature extraction)
     * @param {Actor} actor - The actor that owns the weapon
     * @param {string} weaponId - The ID of the weapon to equip
     * @returns {Promise<boolean>} True if successful
     */
    async equipWeapon(actor, weaponId) {
        // Check permissions
        if (!actor?.isOwner) {
            ui.notifications.warn("You don't have permission to modify this token");
            return false;
        }

        const weapon = actor.items.get(weaponId);
        if (!weapon || weapon.type !== "weapon") {
            debugWarn("Invalid weapon for equipping:", weaponId);
            return false;
        }

        debug(`Equipping weapon: ${weapon.name}`);

        try {
            // For now, simply equip to main hand (status 4)
            // In the future, could add logic to handle two-handed weapons, off-hand conflicts, etc.
            await weapon.update({ "system.equipStatus": 4 });
            return true;
        } catch (error) {
            debugWarn(`Failed to equip weapon ${weapon.name}:`, error);
            ui.notifications.error(`Failed to equip ${weapon.name}`);
            return false;
        }
    }

    /**
     * Unequips a weapon (sets it to carried status) (Phase 2 feature extraction)
     * @param {Actor} actor - The actor that owns the weapon
     * @param {string} weaponId - The ID of the weapon to unequip
     * @returns {Promise<boolean>} True if successful
     */
    async unequipWeapon(actor, weaponId) {
        // Check permissions
        if (!actor?.isOwner) {
            ui.notifications.warn("You don't have permission to modify this token");
            return false;
        }

        const weapon = actor.items.get(weaponId);
        if (!weapon || weapon.type !== "weapon") {
            debugWarn("Invalid weapon for unequipping:", weaponId);
            return false;
        }

        debug(`Unequipping weapon: ${weapon.name}`);

        try {
            await weapon.update({ "system.equipStatus": 1 });
            return true;
        } catch (error) {
            debugWarn(`Failed to unequip weapon ${weapon.name}:`, error);
            ui.notifications.error(`Failed to unequip ${weapon.name}`);
            return false;
        }
    }

    /**
     * Toggles favorite status on a power (Phase 2 feature extraction)
     * @param {Actor} actor - The actor that owns the power
     * @param {string} powerId - The ID of the power to toggle
     * @returns {Promise<boolean>} True if successful
     */
    async togglePowerFavorite(actor, powerId) {
        // Check permissions
        if (!actor?.isOwner) {
            ui.notifications.warn("You don't have permission to modify this token");
            return false;
        }

        const power = actor.items.get(powerId);
        if (!power || power.type !== "power") {
            debugWarn("Invalid power for favorite toggle:", powerId);
            return false;
        }

        const newState = !power.system.favorite;
        debug(`Toggling power favorite: ${power.name} to ${newState}`);

        try {
            await power.update({ "system.favorite": newState });
            return true;
        } catch (error) {
            debugWarn(`Failed to toggle power favorite ${power.name}:`, error);
            ui.notifications.error(`Failed to toggle favorite for ${power.name}`);
            return false;
        }
    }
}

// Export singleton instance following project pattern
export const equipmentModeHandler = new EquipmentModeHandler();