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
                update: { "system.equipStatus": currentStatus > 1 ? 1 : 4 },
                description: currentStatus > 1 ? "Unequipping special weapon" : "Equipping special weapon"
            };
        }

        // Template weapons toggle between carried (1) and stored (0), never equipped
        if (hasTemplateAOE) {
            let newStatus;
            if (currentStatus >= 2) {
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
            update: { "system.equipStatus": currentStatus > 1 ? 1 : 4 },
            description: currentStatus > 1 ? "Unequipping weapon" : "Equipping weapon",
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
     * Gets the appropriate tooltip text for an item in equipment mode
     * @param {Object} metadata - Item metadata
     * @returns {string}
     */
    getEquipmentTooltip(metadata) {
        // In equipment mode with badges, no tooltip needed - badges are self-explanatory
        if (metadata?.showBadge && metadata?.equipStatus !== undefined) {
            return "";
        }
        // Legacy tooltips for non-equipment mode
        else if (metadata?.isCarried) {
            return " [Carried - Click to equip]";
        } else if (metadata?.isStored) {
            return " [Stored Template - Click to carry]";
        } else if (metadata?.isUnfavorited) {
            // No tooltip for unfavorited powers - visual styling is enough
            return "";
        }
        return "";
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
}

// Export singleton instance following project pattern
export const equipmentModeHandler = new EquipmentModeHandler();