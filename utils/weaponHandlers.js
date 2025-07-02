/**
 * @file Weapon selection and editing handlers
 * @description Manages weapon selection workflows including targeting and roll creation
 */

import {shouldAutoRemoveTargets} from "../settings/settings.js";
import {showTargetTooltip, setupTargetClickHandlers, emergencyCleanupTargeting} from "./interactionLayerUtils.js";
import {targetingSessionManager} from "../managers/TargetingSessionManager.js";
import {debug, debugWarn} from "./debug.js";

/**
 * Handles weapon selection logic (enhanced with state manager coordination)
 * @param {Token} token - The token that owns the weapon
 * @param {string} weaponId - The ID of the selected weapon
 * @param {Function} hideMenuCallback - Callback to hide the menu
 * @returns {Promise<void>}
 */
export async function handleWeaponSelection(token, weaponId, hideMenuCallback) {
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

    // Debug logging for template properties
    debug(`Checking weapon "${weapon.name}" for templates:`, {
        weaponId: weapon.id,
        templates: weapon.system?.templates,
        hasTemplates: weapon.system?.templates ? Object.entries(weapon.system.templates) : 'No templates object'
    });

    // Check if weapon has any template AOE properties activated
    const hasTemplateAOE = weapon?.system?.templates &&
        Object.values(weapon.system.templates).some(v => v === true);

    debug(`Template check result:`, {
        hasTemplateAOE,
        currentTargetsSize: game.user.targets.size,
        willSkipTargeting: hasTemplateAOE && !game.user.targets.size
    });

    // If it's a template weapon, create the roll card immediately without requiring a target
    if (hasTemplateAOE) {
        // Clear any lingering targets for template weapons
        if (game.user.targets.size > 0) {
            debug(`Clearing ${game.user.targets.size} lingering targets for template weapon`);
            game.user.targets.forEach(t => t.setTarget(false, {user: game.user}));
            game.user.targets.clear();
        }
        await game.brsw.create_item_card(token.actor, weaponId, {});
        return;
    }

    // Clear existing targets if the setting is enabled
    if (shouldAutoRemoveTargets()) {
        game.user.targets.forEach(t => t.setTarget(false, {user: game.user}));
        game.user.targets.clear();
    }

    // Check for target
    if (!game.user.targets.size) {
        // Use state manager to ensure clean targeting state
        if (targetingSessionManager.isActive()) {
            targetingSessionManager.endSession();
        }

        // Clean up any existing targeting first
        emergencyCleanupTargeting();

        // Show the target tooltip IMMEDIATELY
        showTargetTooltip(true);

        // Store data for later and prompt user
        const pendingData = {
            actorId: token.actor.id,
            weaponId: weaponId,
            tokenId: token.id,
            timestamp: Date.now()
        };

        // Store the pending data
        await game.user.setFlag('tokencontextmenu', 'pendingWeaponRoll', pendingData);

        // Variable to track if we've already handled the targeting
        let targetHandled = false;

        // Set up click handlers for target selection using state-managed targeting
        setupTargetClickHandlers(
            pendingData,
            // On target selected callback
            async () => {
                if (targetHandled) return;
                targetHandled = true;

                showTargetTooltip(false);
                await processTargetSelection();
            },
            // On abort callback
            async (reason) => {
                if (targetHandled) return;
                targetHandled = true;

                showTargetTooltip(false);
                await game.user.unsetFlag('tokencontextmenu', 'pendingWeaponRoll');
                if (reason && !reason.includes('manually aborted')) {
                    ui.notifications.warn(reason);
                }
            }
        );

        // Function to process the target selection
        async function processTargetSelection() {
            const storedData = await game.user.getFlag('tokencontextmenu', 'pendingWeaponRoll');

            // Verify it's the same pending action (using timestamp)
            if (storedData && storedData.timestamp === pendingData.timestamp) {
                await game.user.unsetFlag('tokencontextmenu', 'pendingWeaponRoll');

                const actor = token.actor;
                if (actor && game.user.targets.size > 0) {
                    await game.brsw.create_item_card(actor, storedData.weaponId, { tokenId: token.id });
                } else if (!game.user.targets.size) {
                    ui.notifications.warn("Target was lost. Please try again.");
                } else {
                    ui.notifications.error("Could not find the actor. Please try again.");
                }
            } else {
                debugWarn('Stored data mismatch or missing');
                ui.notifications.warn("Action data mismatch. Please try again.");
            }
        }

        return;
    }

    // If we have a target, create the card directly
    await game.brsw.create_item_card(token.actor, weaponId, { tokenId: token.id });
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
 * @param {Actor} actor - The actor that owns the weapon
 * @param {string} weaponId - The ID of the weapon to equip
 * @returns {Promise<void>}
 */
export async function handleWeaponEquip(actor, weaponId) {
    // Check permissions
    if (!actor.isOwner) {
        ui.notifications.warn("You don't have permission to modify this token");
        return;
    }
    
    const weapon = actor.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") {
        debugWarn("Invalid weapon for equipping:", weaponId);
        return;
    }
    
    debug(`Equipping weapon: ${weapon.name}`);
    
    // For now, simply equip to main hand (status 4)
    // In the future, could add logic to handle two-handed weapons, off-hand conflicts, etc.
    await weapon.update({ "system.equipStatus": 4 });
}

/**
 * Handles toggling favorite status on a power
 * @param {Actor} actor - The actor that owns the power
 * @param {string} powerId - The ID of the power to toggle
 * @returns {Promise<void>}
 */
export async function handlePowerFavoriteToggle(actor, powerId) {
    // Check permissions
    if (!actor.isOwner) {
        ui.notifications.warn("You don't have permission to modify this token");
        return;
    }
    
    const power = actor.items.get(powerId);
    if (!power || power.type !== "power") {
        debugWarn("Invalid power for favorite toggle:", powerId);
        return;
    }
    
    const newState = !power.system.favorite;
    debug(`Toggling power favorite: ${power.name} to ${newState}`);
    
    await power.update({ "system.favorite": newState });
}

/**
 * Handles unequipping a weapon (setting it to carried status)
 * @param {Actor} actor - The actor that owns the weapon
 * @param {string} weaponId - The ID of the weapon to unequip
 * @returns {Promise<void>}
 */
export async function handleWeaponUnequip(actor, weaponId) {
    // Check permissions
    if (!actor.isOwner) {
        ui.notifications.warn("You don't have permission to modify this token");
        return;
    }
    
    const weapon = actor.items.get(weaponId);
    if (!weapon || weapon.type !== "weapon") {
        debugWarn("Invalid weapon for unequipping:", weaponId);
        return;
    }
    
    debug(`Unequipping weapon: ${weapon.name}`);
    
    await weapon.update({ "system.equipStatus": 1 });
}
