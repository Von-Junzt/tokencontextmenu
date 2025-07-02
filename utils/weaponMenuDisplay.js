/**
 * @file Weapon menu display logic
 * @description Handles the creation and display of the weapon menu UI
 */

import {getWeaponSortPriority, emergencyCleanupTargeting} from "./interactionLayerUtils.js";
import {WeaponMenuApplication} from "../applications/weaponMenuApplication.js";
import {weaponSystemCoordinator} from "../managers/WeaponSystemCoordinator.js";
import {targetingSessionManager} from "../managers/TargetingSessionManager.js";
import {debugWarn} from "./debug.js";

/**
 * Gets menu items (weapons and powers) for a token with optional expansion
 * @param {Token} token - The token to get items for
 * @param {Object} options - Options for item filtering
 * @param {boolean} options.expandWeapons - Include carried (unequipped) weapons
 * @param {boolean} options.expandPowers - Include unfavorited powers
 * @returns {{items: Array, metadata: Map}} Items array and metadata map
 * @private
 */
export function getMenuItems(token, options = {}) {
    if (!token?.actor) return { items: [], metadata: new Map() };

    const { expandWeapons = false, expandPowers = false } = options;
    const metadata = new Map();

    // Filter for equipped weapons
    const equippedWeapons = token.actor.items.filter(i =>
        (i.type === "weapon" &&
            (
                [5, 4, 2].includes(i.system.equipStatus) ||
                (i.system.equipStatus === 1 && Object.values(i.system.templates).some(v => v === true))
            )
            && i.system.equipStatus !== 0
        )
    );

    // Get carried and stored weapons if expanded
    const carriedWeapons = expandWeapons ? 
        token.actor.items.filter(i => {
            if (i.type !== "weapon") return false;
            
            // Exclude any weapon that's already in the equipped weapons list
            if (equippedWeapons.some(eq => eq.id === i.id)) return false;
            
            // Include carried weapons (status 1)
            if (i.system.equipStatus === 1) {
                return true;
            }
            
            // Include stored template weapons (status 0 with templates)
            if (i.system.equipStatus === 0 && 
                i.system.templates && 
                Object.values(i.system.templates).some(v => v === true)) {
                return true;
            }
            
            return false;
        }) : [];

    // Mark carried/stored weapons in metadata
    carriedWeapons.forEach(w => {
        if (w.system.equipStatus === 1) {
            metadata.set(w.id, { isCarried: true });
        } else if (w.system.equipStatus === 0) {
            metadata.set(w.id, { isStored: true });
        }
    });

    // Get favorited powers
    const favoritedPowers = token.actor.items.filter(i =>
        i.type === "power" && i.system.favorite === true
    );

    // Get unfavorited powers if expanded
    const unfavoritedPowers = expandPowers ?
        token.actor.items.filter(i => 
            i.type === "power" && 
            i.system.favorite !== true
        ) : [];

    // Mark unfavorited powers in metadata
    unfavoritedPowers.forEach(p => metadata.set(p.id, { isUnfavorited: true }));

    // Sort all item arrays
    const sortItems = (items) => {
        items.sort((a, b) => {
            const priorityA = getWeaponSortPriority(a);
            const priorityB = getWeaponSortPriority(b);
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return a.name.localeCompare(b.name);
        });
    };

    sortItems(equippedWeapons);
    sortItems(carriedWeapons);
    favoritedPowers.sort((a, b) => a.name.localeCompare(b.name));
    unfavoritedPowers.sort((a, b) => a.name.localeCompare(b.name));

    // Build result array
    const result = [];

    // Add equipped weapons
    result.push(...equippedWeapons);

    // Add carried weapons section if expanded
    if (expandWeapons && carriedWeapons.length > 0) {
        result.push(...carriedWeapons);
    }

    // Track if we have any expandable items
    const hasWeapons = equippedWeapons.length > 0 || carriedWeapons.length > 0;
    const totalWeapons = token.actor.items.filter(i => 
        i.type === "weapon" && 
        i.system.equipStatus !== 0
    ).length;

    // Add powers section
    const hasPowers = favoritedPowers.length > 0 || unfavoritedPowers.length > 0;
    const totalPowers = token.actor.items.filter(i => i.type === "power").length;
    
    if (hasPowers) {
        if (result.length > 0) {
            result.push({
                type: "separator",
                id: "powers-separator",
                name: "───── Powers ─────"
            });
        }
        
        result.push(...favoritedPowers);
        
        // Add unfavorited powers if expanded
        if (expandPowers && unfavoritedPowers.length > 0) {
            result.push(...unfavoritedPowers);
        }
    }
    
    // Add single equipment mode toggle button if there are any items
    if (totalWeapons > 0 || totalPowers > 0) {
        result.push({
            type: "expandButton",
            id: "expand-equipment",
            section: "equipment",  // New section type for equipment mode
            expanded: expandWeapons || expandPowers  // Expanded if either is true
        });
    }

    return { items: result, metadata };
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
    const { closeWeaponMenu } = await import("./weaponMenuCloser.js");
    await closeWeaponMenu({ reason: 'opening-new-menu' });

    // Get menu items with default expansion state from settings
    let expandWeapons = false;
    let expandPowers = false;
    
    if (game?.ready) {
        expandWeapons = game.settings.get("tokencontextmenu", "expandWeaponsByDefault") ?? false;
        expandPowers = game.settings.get("tokencontextmenu", "expandPowersByDefault") ?? false;
    }
    
    const { items, metadata } = getMenuItems(token, { expandWeapons, expandPowers });

    if (!items.length) {
        debugWarn("No items found for", token.name);
        return;
    }

    // Create and render the weapon menu application
    const weaponMenu = new WeaponMenuApplication(token, items, { metadata });
    await weaponMenu.render(true);
}