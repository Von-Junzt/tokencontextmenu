/**
 * @file Weapon menu display logic
 * @description Handles the creation and display of the weapon menu UI
 */

import {getWeaponSortPriority, emergencyCleanupTargeting} from "./interactionLayerUtils.js";
import {WeaponMenuApplication} from "../applications/weaponMenuApplication.js";
import {weaponSystemCoordinator} from "../managers/WeaponSystemCoordinator.js";
import {targetingSessionManager} from "../managers/TargetingSessionManager.js";

/**
 * Gets equipped weapons and powers for a token, filtered and sorted
 * Filters by equip status and favorite powers, sorts by priority
 * @param {Token} token - The token to get weapons and powers for
 * @returns {Array} Array of equipped weapon items and powers with separators
 * @private
 */
function getEquippedWeapons(token) {
    if (!token?.actor) return [];

    // Filter for equipped weapons and powers
    const weapons = token.actor.items.filter(i =>
        (i.type === "weapon" &&
            (
                [5, 4, 2].includes(i.system.equipStatus) ||
                (i.system.equipStatus === 1 && Object.values(i.system.templates).some(v => v === true)) ||
                i.name.toLowerCase().includes('unarmed attack')
            )
            && i.system.equipStatus !== 0
        )
    );

    const powers = token.actor.items.filter(i =>
        i.type === "power" && i.system.favorite === true
    );

    // Sort weapons and powers
    weapons.sort((a, b) => {
        const priorityA = getWeaponSortPriority(a);
        const priorityB = getWeaponSortPriority(b);
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        return a.name.localeCompare(b.name);
    });

    powers.sort((a, b) => a.name.localeCompare(b.name));

    // Combine with separator if both weapons and powers exist
    const result = [...weapons];
    if (weapons.length > 0 && powers.length > 0) {
        result.push({
            type: "separator",
            id: "powers-separator",
            name: "───── Powers ─────"
        });
    }
    result.push(...powers);

    return result;
}

/**
 * Shows the weapon menu under the specified token
 * Enhanced to coordinate with state manager
 * @param {Token} token - The token to show the menu for
 */
export async function showWeaponMenuUnderToken(token) {
    if (!token?.actor) {
        ui.notifications.warn("No valid token selected.");
        return;
    }

    // Use state manager to handle targeting cleanup
    if (targetingSessionManager.isActive()) {
        targetingSessionManager.endSession();
    }

    // Clean up any existing targeting first
    emergencyCleanupTargeting();

    // Close any existing weapon menu - both tracked and orphaned
    const existingApp = weaponSystemCoordinator.getMenuApp();
    if (existingApp) {
        await existingApp.close();
    }
    
    // Also check for orphaned menus on the canvas
    const orphanedMenus = canvas.tokens?.children?.filter(child => 
        child.name === "tokencontextmenu-weapon-menu"
    ) || [];
    
    for (const menu of orphanedMenus) {
        if (menu.parent) {
            menu.parent.removeChild(menu);
        }
        if (menu.weaponContainers) {
            menu.weaponContainers.forEach(wc => wc.removeAllListeners());
        }
    }

    // Get equipped weapons
    const equippedWeapons = getEquippedWeapons(token);

    if (!equippedWeapons.length) {
        console.warn("Token Context Menu: No equipped weapons found for", token.name);
        ui.notifications.info("No equipped weapons or favorite powers found.");
        return;
    }

    // Create and render the weapon menu application
    const weaponMenu = new WeaponMenuApplication(token, equippedWeapons);
    await weaponMenu.render(true);
}