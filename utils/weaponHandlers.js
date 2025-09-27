/**
 * @file Weapon selection and editing handlers
 * @description Manages weapon selection workflows including targeting and roll creation
 *
 * Phase 2 Refactoring: These functions now serve as shims that delegate to
 * the appropriate managers when the feature flag is enabled. This allows for
 * backward compatibility while testing the new architecture.
 */

import {shouldAutoRemoveTargets} from "../settings/settings.js";
import {showTargetTooltip, setupTargetClickHandlers, emergencyCleanupTargeting} from "./interactionLayerUtils.js";
import {targetingSessionManager} from "../managers/TargetingSessionManager.js";
import {equipmentModeHandler} from "../managers/EquipmentModeHandler.js";
import {debug, debugWarn} from "./debug.js";

/**
 * Handles weapon selection logic (enhanced with state manager coordination)
 * Phase 2: Delegates to TargetingSessionManager when feature flag enabled
 * @param {Token} token - The token that owns the weapon
 * @param {string} weaponId - The ID of the selected weapon
 * @param {Function} hideMenuCallback - Callback to hide the menu
 * @returns {Promise<void>}
 */
export async function handleWeaponSelection(token, weaponId, hideMenuCallback) {
    // Use TargetingSessionManager for weapon selection
    debug("Using TargetingSessionManager for weapon selection");
    return targetingSessionManager.beginWeaponRoll(token, weaponId, hideMenuCallback);
}

/**
 * Handles weapon editing (right-click)
 * Opens the weapon's item sheet for editing
 * @param {Token} token - The token that owns the weapon
 * @param {string} weaponId - The ID of the weapon to edit
 * @param {Function} hideMenuCallback - Callback to hide the menu
 */
export async function handleWeaponEdit(token, weaponId, hideMenuCallback) {
    // Check permissions
    if (!token.actor.isOwner) {
        ui.notifications.warn("You don't have permission to modify this token");
        return;
    }
    
    const weapon = token.actor.items.find(i => i.id === weaponId);

    if (weapon) {
        if (hideMenuCallback) hideMenuCallback();
        weapon.sheet.render(true);
    } else {
        ui.notifications.error("Weapon not found.");
    }
}

/**
 * Handles equipping a carried weapon
 * Phase 2: Delegates to EquipmentModeHandler when feature flag enabled
 * @param {Actor} actor - The actor that owns the weapon
 * @param {string} weaponId - The ID of the weapon to equip
 * @returns {Promise<void>}
 */
export async function handleWeaponEquip(actor, weaponId) {
    // Use EquipmentModeHandler for weapon equip
    debug("Using EquipmentModeHandler for weapon equip");
    return equipmentModeHandler.equipWeapon(actor, weaponId);
}

/**
 * Handles toggling favorite status on a power
 * Phase 2: Delegates to EquipmentModeHandler when feature flag enabled
 * @param {Actor} actor - The actor that owns the power
 * @param {string} powerId - The ID of the power to toggle
 * @returns {Promise<void>}
 */
export async function handlePowerFavoriteToggle(actor, powerId) {
    // Use EquipmentModeHandler for power favorite toggle
    debug("Using EquipmentModeHandler for power favorite toggle");
    return equipmentModeHandler.togglePowerFavorite(actor, powerId);
}

/**
 * Handles reloading a weapon to full ammo
 * Phase 2: Delegates to EquipmentModeHandler when feature flag enabled
 * @param {Actor} actor - The actor that owns the weapon
 * @param {string} weaponId - The ID of the weapon to reload
 * @returns {Promise<void>}
 */
export async function handleWeaponReload(actor, weaponId) {
    // Use EquipmentModeHandler for weapon reload
    debug("Using EquipmentModeHandler for weapon reload");
    return equipmentModeHandler.reloadWeapon(actor, weaponId);
}

/**
 * Handles unequipping a weapon (setting it to carried status)
 * Phase 2: Delegates to EquipmentModeHandler when feature flag enabled
 * @param {Actor} actor - The actor that owns the weapon
 * @param {string} weaponId - The ID of the weapon to unequip
 * @returns {Promise<void>}
 */
export async function handleWeaponUnequip(actor, weaponId) {
    // Use EquipmentModeHandler for weapon unequip
    debug("Using EquipmentModeHandler for weapon unequip");
    return equipmentModeHandler.unequipWeapon(actor, weaponId);
}
