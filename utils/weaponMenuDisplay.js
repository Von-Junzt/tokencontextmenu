/**
 * @file Weapon menu display logic
 * @description Handles the creation and display of the weapon menu UI
 */

import {getWeaponSortPriority, getItemSortPriorityEquipmentMode, emergencyCleanupTargeting} from "./interactionLayerUtils.js";
import {WeaponMenuApplication} from "../applications/weaponMenuApplication.js";
import {weaponSystemCoordinator} from "../managers/WeaponSystemCoordinator.js";
import {targetingSessionManager} from "../managers/TargetingSessionManager.js";
import {equipmentModeHandler} from "../managers/EquipmentModeHandler.js";
import {debug, debugWarn} from "./debug.js";
import {WEAPON_NAMES} from "./constants.js";
import {shouldShowEquipmentBadges} from "../settings/settings.js";

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
                showBadge: expandWeapons && shouldShowEquipmentBadges()  // Show badge if enabled
            };
            
            // Determine if this weapon would be visible in normal mode
            const isEquipped = w.isReadied;
            const hasTemplate = equipmentModeHandler.hasTemplateAOE(w);
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
            if (i.isReadied) return true;
            
            // Show carried (status 1) template weapons only
            if (i.system.equipStatus === 1) {
                return equipmentModeHandler.hasTemplateAOE(i);
            }
            
            return false;
        });
        
        // Add equipment status metadata for weapons in normal mode
        weapons.forEach(w => {
            metadata.set(w.id, { 
                equipStatus: w.system.equipStatus,
                showBadge: false  // Don't show badge in normal mode
            });
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
                metadataObj.showPowerBadge = expandPowers && shouldShowEquipmentBadges();
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
/**
 * Ensures the actor has an Unarmed Attack weapon equipped
 * Creates one if it doesn't exist, equips it if it's not equipped
 * @param {Actor} actor - The actor to check
 * @returns {Promise<boolean>} - True if successful, false if no permissions
 */
async function ensureUnarmedAttack(actor) {
    if (!actor?.isOwner) {
        debugWarn("Cannot create Unarmed Attack - insufficient permissions");
        return false;
    }
    
    // Look for existing unarmed attack (case insensitive)
    const existingUnarmed = actor.items.find(i => 
        i.type === "weapon" && 
        i.name.toLowerCase().includes(WEAPON_NAMES.UNARMED_ATTACK.toLowerCase())
    );
    
    if (existingUnarmed) {
        // Check if it needs to be equipped
        if (!existingUnarmed.isReadied) {
            debug(`Equipping existing ${WEAPON_NAMES.UNARMED_ATTACK} for ${actor.name}`);
            await existingUnarmed.update({ "system.equipStatus": 4 });
        }
        return true;
    }
    
    // Create minimal unarmed attack weapon
    debug(`Creating ${WEAPON_NAMES.UNARMED_ATTACK} for ${actor.name}`);
    await actor.createEmbeddedDocuments("Item", [{
        name: WEAPON_NAMES.UNARMED_ATTACK,
        type: "weapon",
        img: "systems/swade/assets/icons/skills/punch.svg",
        system: {
            damage: "@str",
            equipStatus: 4, // Equipped in main hand
            actions: {
                trait: "Fighting",
                traitMod: "",
                dmgMod: ""
            },
            ap: 0,
            range: "",
            rof: 1,
            shots: 0,
            currentShots: 0,
            favorite: false,
            isHeavyWeapon: false
        }
    }]);
    return true;
}

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

    // Get menu items with default expansion state (always false now)
    const expandWeapons = false;
    const expandPowers = false;
    
    let { items, metadata } = getMenuItems(token, { expandWeapons, expandPowers });

    // If no weapons in menu, ensure unarmed attack exists
    const hasWeapons = items.some(i => i.type === "weapon");
    if (!hasWeapons) {
        const created = await ensureUnarmedAttack(token.actor);
        if (created) {
            // Re-fetch menu items after creating/equipping unarmed attack
            const refreshed = getMenuItems(token, { expandWeapons, expandPowers });
            items = refreshed.items;
            metadata = refreshed.metadata;
        }
    }

    if (!items.length) {
        debugWarn("No items found for", token.name);
        return;
    }

    // Create and render the weapon menu application
    const weaponMenu = new WeaponMenuApplication(token, items, { metadata });
    await weaponMenu.render(true);
}

/**
 * Get the equipment state color for an item based on its state
 * @param {Item} item - The item to check
 * @returns {string|null} Hex color string or null to use default
 */
export function getEquipmentStateColor(item) {
    // Check if game settings are available
    if (typeof game === 'undefined' || !game.ready) {
        return null;
    }
    
    // Use game.settings directly instead of imported functions
    if (!game.settings.get("tokencontextmenu", "useEquipmentStateColors")) {
        return null; // Use default coloring
    }
    
    // Weapon logic
    if (item.type === "weapon") {
        const equipStatus = item.system.equipStatus;
        const hasTemplate = equipmentModeHandler.hasTemplateAOE(item);
        
        // Equipped or carried template = active (green)
        if (item.isReadied || (equipStatus === 1 && hasTemplate)) {
            return game.settings.get("tokencontextmenu", "equipmentColorActive");
        }
        // Carried non-template = carried (yellow)
        else if (equipStatus === 1) {
            return game.settings.get("tokencontextmenu", "equipmentColorCarried");
        }
    }
    // Power logic
    else if (item.type === "power") {
        if (item.system.favorite === true) {
            return game.settings.get("tokencontextmenu", "equipmentColorActive");
        }
    }
    
    return null; // Use default color
}