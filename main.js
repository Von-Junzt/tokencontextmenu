/**
 * @file Main entry point for the Token Context Menu module
 * @description Initializes the weapon menu system for SWADE in Foundry VTT.
 * Sets up all hooks, event handlers, and system coordinators.
 */

import {registerSettings} from "./settings/settings.js";
import {
    registerTokenHudSelectionHandler,
    registerTokenHudMovementHandler,
    registerTokenHudTokenHudHandler,
    registerTokenHudDeletionHandler
} from "./hooks/tokenEventHandlers.js";
import {
    deactivateInteractionLayer,
    initializeGlobalInteractionLayer,
    resetGlobalInteractionLayer,
    updateInteractionLayerHitArea
} from "./utils/interactionLayerUtils.js";
import {weaponSystemCoordinator} from "./managers/WeaponSystemCoordinator.js";

/**
 * Initialize module on Foundry init
 */
Hooks.once('init', function() {
    console.warn('Token Context Menu: Initializing');

    // Register module settings
    registerSettings();
});

/**
 * Setup module functionality when Foundry is ready
 */
Hooks.once('ready', async () => {
    // register centralized token click handling
    registerTokenHudSelectionHandler(); // Now uses WeaponMenuTokenClickManager
    registerTokenHudMovementHandler();
    registerTokenHudTokenHudHandler();
    registerTokenHudDeletionHandler();
    console.warn('Token Context Menu: Token handlers registered');
    
    // Add debugging command for weapon menu
    window.tokencontextmenu = window.tokencontextmenu || {};
    window.tokencontextmenu.getWeaponMenuStatus = () => {
        const menuApp = weaponSystemCoordinator.getMenuApp();
        if (menuApp && menuApp.getStatus) {
            return menuApp.getStatus();
        } else {
            return { state: 'No weapon menu active' };
        }
    };
    window.tokencontextmenu.getSystemState = () => weaponSystemCoordinator.getStateSnapshot();
    window.tokencontextmenu.cleanup = async () => {
        const { cleanupTokenHandlers } = await import("./hooks/tokenEventHandlers.js");
        await cleanupTokenHandlers();
        console.warn('Token Context Menu: Manual cleanup completed');
    };
    console.log("Token Context Menu | Debug commands available: tokencontextmenu.getWeaponMenuStatus(), tokencontextmenu.getSystemState(), tokencontextmenu.cleanup()");

    // final setup message
    console.warn("Token Context Menu: Module initialized! Happy Gaming!");
});

/**
 * Handle canvas ready events for interaction layer management
 */
Hooks.on('canvasReady', () => {
    initializeGlobalInteractionLayer(); // Create but don't activate
    updateInteractionLayerHitArea();    // Ensure correct size
});

Hooks.on('canvasPan', () => {
    updateInteractionLayerHitArea();
});

Hooks.on('canvasDimensionsReady', () => {
    updateInteractionLayerHitArea();
});

Hooks.once('canvasInit', () => {
    deactivateInteractionLayer();
    resetGlobalInteractionLayer()
});

/**
 * Handle module cleanup when it's disabled or the game closes
 */
Hooks.once('closeGame', async () => {
    console.warn('Token Context Menu: Cleaning up module resources');
    if (window.tokencontextmenu?.cleanup) {
        await window.tokencontextmenu.cleanup();
    }
});