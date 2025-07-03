/**
 * @file Weapon menu display logic
 * @description Handles the creation and display of the weapon menu UI
 */

import {getWeaponSortPriority, getItemSortPriorityEquipmentMode, emergencyCleanupTargeting} from "./interactionLayerUtils.js";
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

    // Get weapons based on equipment mode
    let weapons;
    if (expandWeapons) {
        // Equipment mode: Show ALL weapons
        weapons = token.actor.items.filter(i => i.type === "weapon");
        
        // Mark equipment status in metadata for badges and coloring
        weapons.forEach(w => {
            const metadataObj = { 
                equipStatus: w.system.equipStatus,
                showBadge: true  // Show badge in equipment mode
            };
            
            // Determine if this weapon would be visible in normal mode
            const isEquipped = [2, 4, 5].includes(w.system.equipStatus);
            const hasTemplate = w.system.templates && 
                Object.values(w.system.templates).some(v => v === true);
            const isCarriedTemplate = w.system.equipStatus === 1 && hasTemplate;
            
            // Mark items that would NOT be visible in normal mode for grey coloring
            if (!isEquipped && !isCarriedTemplate) {
                // This includes: stored items (0), carried non-templates (1)
                metadataObj.isStored = true;  // Using isStored for grey coloring
            }
            
            metadata.set(w.id, metadataObj);
        });
    } else {
        // Normal mode: Show equipped weapons and carried template weapons
        weapons = token.actor.items.filter(i => {
            if (i.type !== "weapon") return false;
            
            // Always show equipped weapons
            if ([5, 4, 2].includes(i.system.equipStatus)) return true;
            
            // Show carried (status 1) template weapons only
            if (i.system.equipStatus === 1) {
                const hasTemplate = i.system.templates && 
                    Object.values(i.system.templates).some(v => v === true);
                return hasTemplate;
            }
            
            return false;
        });
    }

    // Get powers based on expansion state
    let powers;
    if (expandPowers) {
        // Equipment mode: Get ALL powers
        powers = token.actor.items.filter(i => i.type === "power");
        
        // Mark powers with metadata for badges and grey coloring
        powers.forEach(p => {
            const metadataObj = {};
            if (p.system.favorite !== true) {
                metadataObj.isUnfavorited = true;
            }
            // Add badge info for equipment mode
            if (expandPowers) {
                metadataObj.showPowerBadge = true;
                metadataObj.isFavorited = p.system.favorite === true;
            }
            if (Object.keys(metadataObj).length > 0) {
                metadata.set(p.id, metadataObj);
            }
        });
    } else {
        // Normal mode: Only favorited powers
        powers = token.actor.items.filter(i =>
            i.type === "power" && i.system.favorite === true
        );
    }

    // Sort all item arrays
    const sortItems = (items, useEquipmentModeSort = false) => {
        items.sort((a, b) => {
            const priorityA = useEquipmentModeSort ? 
                getItemSortPriorityEquipmentMode(a) : getWeaponSortPriority(a);
            const priorityB = useEquipmentModeSort ? 
                getItemSortPriorityEquipmentMode(b) : getWeaponSortPriority(b);
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return a.name.localeCompare(b.name);
        });
    };

    // Use equipment mode sorting when in equipment mode
    sortItems(weapons, expandWeapons);
    
    // Powers always sort alphabetically
    powers.sort((a, b) => a.name.localeCompare(b.name));

    // Build result array
    const result = [];

    // Add weapons
    result.push(...weapons);

    // Track if we have any items
    const hasWeapons = weapons.length > 0;
    const totalWeapons = token.actor.items.filter(i => i.type === "weapon").length;

    // Add powers section
    const hasPowers = powers.length > 0;
    const totalPowers = token.actor.items.filter(i => i.type === "power").length;
    
    if (hasPowers) {
        if (result.length > 0) {
            result.push({
                type: "separator",
                id: "powers-separator",
                name: "───── Powers ─────"
            });
        }
        
        result.push(...powers);
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