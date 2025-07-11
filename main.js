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
import {debug, debugWarn} from "./utils/debug.js";

/**
 * Initialize module on Foundry init
 */
Hooks.once('init', function() {
    // Display ASCII art logo
    const version = game.modules.get('tokencontextmenu')?.version || "1.0.0"
    const logo = `
═══════════════════════════════════════════════════════════════
                                                               
 ██╗   ██╗     ██╗    ████████╗ ██████╗███╗   ███╗           
 ██║   ██║     ██║    ╚══██╔══╝██╔════╝████╗ ████║           
 ██║   ██║     ██║       ██║   ██║     ██╔████╔██║           
 ╚██╗ ██╔╝██   ██║       ██║   ██║     ██║╚██╔╝██║           
  ╚████╔╝ ╚█████╔╝       ██║   ╚██████╗██║ ╚═╝ ██║           
   ╚═══╝   ╚════╝        ╚═╝    ╚═════╝╚═╝     ╚═╝           
                                                               
        Token Context Menu for SWADE v${version}                    
                  by Von Junzt                                 
                                                               
═══════════════════════════════════════════════════════════════`;
    
    // Keep ASCII art as console.log for visual effect
    console.log(`%c${logo}`, 'color: #0095ff; font-family: monospace; font-weight: bold;');
    debug('Token Context Menu: Initializing');

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
    debug('Token Context Menu: Token handlers registered');
    
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
        debugWarn('Token Context Menu: Manual cleanup completed');
    };
    debug("Debug commands available: tokencontextmenu.getWeaponMenuStatus(), tokencontextmenu.getSystemState(), tokencontextmenu.cleanup()");
});

/**
 * Handle canvas ready events for interaction layer management
 */
Hooks.on('canvasReady', () => {
    initializeGlobalInteractionLayer(); // Create but don't activate
    updateInteractionLayerHitArea();    // Ensure correct size
    
    // Keep final setup message as console.log for visual effect
    console.log('%c═══════════════════════════════════════════════════════════════', 'color: #ff6400;');
    console.log('%c VJ TCM: Module initialized! Happy Gaming! 🎮', 'color: #ff6400; font-weight: bold; font-size: 14px;');
    console.log('%c═══════════════════════════════════════════════════════════════', 'color: #ff6400;');
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
    debug('Token Context Menu: Cleaning up module resources');
    if (window.tokencontextmenu?.cleanup) {
        await window.tokencontextmenu.cleanup();
    }
});