/**
 * @file Token event handlers for weapon menu system
 * @description Manages Foundry hooks for token selection, movement, HUD rendering, and deletion.
 * Coordinates menu visibility based on token interactions and user settings.
 */

import {showWeaponMenuUnderToken} from "../utils/weaponMenuDisplay.js";
import {shouldReopenMenuAfterDrag, shouldShowWeaponMenuOnSelection} from "../settings/settings.js";
import {WeaponMenuApplication} from "../applications/weaponMenuApplication.js";
import {weaponSystemCoordinator} from "../managers/WeaponSystemCoordinator.js";
import {weaponMenuTokenClickManager} from "../managers/WeaponMenuTokenClickManager.js";
import {debug, debugWarn} from "../utils/debug.js";
import {TIMING} from "../utils/constants.js";

/**
 * Track token movement and reshow weapon menu when movement stops
 * Enhanced to use centralized state management
 * Uses PIXI ticker to detect when token stops moving for menu reshow
 * @param {Token} token - The token to track
 * @private
 */
function trackTokenMovementForMenuReshow(token) {
    const tickerId = `menu-reshow-${token.id}`;

    // Check if already tracking
    if (weaponSystemCoordinator.state.movementTrackers.has(tickerId)) {
        return;
    }

    const ticker = new PIXI.Ticker();
    weaponSystemCoordinator.addMovementTracker(tickerId, ticker);

    // Initialize tracking variables
    ticker.lastPosition = foundry.utils.duplicate(token.center);
    ticker.stationaryFrames = 0;

    ticker.add(() => {
        const currentCenter = token.center;
        const movementDistance = Math.hypot(
            currentCenter.x - ticker.lastPosition.x,
            currentCenter.y - ticker.lastPosition.y
        );
        ticker.lastPosition = foundry.utils.duplicate(currentCenter);

        if (movementDistance < TIMING.MOVEMENT_THRESHOLD) {
            ticker.stationaryFrames++;
            if (ticker.stationaryFrames > TIMING.MOVEMENT_CHECK_FRAMES) {
                stopTokenMovementTracker(token);

                if (token.controlled &&
                    !canvas.hud.token.rendered &&
                    weaponSystemCoordinator.hasExactlyOneControlledToken() &&
                    shouldShowWeaponMenuOnSelection()) {

                    showWeaponMenuUnderToken(token);
                }
                return;
            }
        } else {
            ticker.stationaryFrames = 0;
        }
    });

    ticker.start();
}

/**
 * Stop and remove the movement tracker for a specific token
 * @param {Token} token - The token to stop tracking
 * @private
 */
function stopTokenMovementTracker(token) {
    const tickerId = `menu-reshow-${token.id}`;
    weaponSystemCoordinator.removeMovementTracker(tickerId);
}

/**
 * Registers the consolidated token interaction handler
 * Delegates to WeaponMenuTokenClickManager for all click/selection handling
 */
export function registerTokenHudSelectionHandler() {
    weaponMenuTokenClickManager.setupEventHandlers();
}

/**
 * Registers a handler to close weapon menu when tokens move and start tracking for reshow
 * Listens to updateToken hook to detect position changes
 */
export function registerTokenHudMovementHandler() {
    Hooks.on("updateToken", async (tokenDocument, changes, options, userId) => {
        if (!("x" in changes || "y" in changes)) return;

        const token = tokenDocument.object;
        if (!token || !token.controlled) return;

        weaponMenuTokenClickManager.resetDragState(token);
        await closeWeaponMenu();

        if (shouldReopenMenuAfterDrag()) {
            trackTokenMovementForMenuReshow(token);
        }
    });
}

/**
 * Registers a handler to close weapon menu when token HUD opens
 * Uses timing to distinguish between selection events and actual HUD opens
 */
export function registerTokenHudTokenHudHandler() {
    Hooks.on("renderTokenHUD", async (hud, html, data) => {
        // This is a legitimate HUD open (right-click, etc.) - close the weapon menu
        await closeWeaponMenu();
        weaponSystemCoordinator.getControlledTokens().forEach(token => {
            stopTokenMovementTracker(token);
        });
    });
}

/**
 * Registers a handler to close weapon menu when tokens are deleted
 */
export function registerTokenHudDeletionHandler() {
    Hooks.on("deleteToken", async (tokenDocument, options, userId) => {
        await closeWeaponMenu();
        if (tokenDocument.object) {
            stopTokenMovementTracker(tokenDocument.object);
        }
    });
}

/**
 * Closes any open weapon menu
 * @private
 */
async function closeWeaponMenu() {
    const { closeWeaponMenu } = await import("../utils/weaponMenuCloser.js");
    return closeWeaponMenu({ reason: 'token-event-handler' });
}

/**
 * Debug function to check state consistency
 * Verifies that coordinator state matches actual UI state
 * Logs warnings if mismatches are detected
 */
export function debugAssertState() {
    const existingApp = Object.values(ui.windows).find(app => app instanceof WeaponMenuApplication);
    const actualMenuOpen = !!existingApp;
    const stateMenuOpen = weaponSystemCoordinator.isMenuOpen();

    if (stateMenuOpen !== actualMenuOpen) {
        debugWarn('State mismatch detected - state says:', stateMenuOpen, 'actual:', actualMenuOpen);
        weaponSystemCoordinator.updateMenuState({ weaponMenuOpen: actualMenuOpen });
    }

    const clickManagerInfo = weaponMenuTokenClickManager.getDebugInfo();
    debug('Click Manager State:', clickManagerInfo);
}

/**
 * Cleanup function for when the module is disabled or scenes change
 * Removes all event handlers and closes any open menus
 */
export async function cleanupTokenHandlers() {
    // Import managers that need cleanup
    const { targetingSessionManager } = await import("../managers/TargetingSessionManager.js");
    
    // Clean up all managers
    weaponMenuTokenClickManager.cleanup();
    weaponSystemCoordinator.cleanup();
    targetingSessionManager.cleanup();
    
    // Close any open menus
    await closeWeaponMenu();

    // Stop any active movement trackers
    canvas.tokens?.controlled?.forEach(token => {
        stopTokenMovementTracker(token);
    });
}