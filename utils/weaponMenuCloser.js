/**
 * @file Centralized weapon menu closing utility
 * @description Provides a single, consistent way to close weapon menus throughout the module
 */

import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { WeaponMenuApplication } from "../applications/weaponMenuApplication.js";
import { debug, debugWarn } from "./debug.js";

/**
 * Close any open weapon menu using the most appropriate method
 * @param {Object} options - Closing options
 * @param {boolean} options.force - Force close even if state machine says no
 * @param {boolean} options.skipHook - Skip calling the weaponMenuClosed hook
 * @param {string} options.reason - Reason for closing (for debugging)
 * @returns {Promise<boolean>} True if menu was closed, false if no menu was open
 */
export async function closeWeaponMenu(options = {}) {
    const { force = false, skipHook = false, reason = 'unspecified' } = options;
    
    debug(`Closing weapon menu - reason: ${reason}`);
    
    let menuClosed = false;
    
    // Close via the registered application (the only method needed)
    const menuApp = weaponSystemCoordinator.getMenuApp();
    if (menuApp && menuApp instanceof WeaponMenuApplication) {
        // Check if the menu is already closing or closed
        const menuState = menuApp.stateMachine?.getState();
        if (menuState === 'CLOSING' || menuState === 'CLOSED') {
            debug('Menu already closing/closed');
            return false;
        } else if (force && menuApp._emergencyCleanup) {
            // Force close using emergency cleanup
            menuApp._emergencyCleanup();
            menuClosed = true;
        } else {
            // Normal close through state machine
            await menuApp.close();
            menuClosed = true;
        }
    }
    
    // Call hook if menu was closed and not skipped
    if (menuClosed && !skipHook) {
        Hooks.call('tokencontextmenu.weaponMenuClosed');
    }
    
    return menuClosed;
}


/**
 * Force close all weapon menus (emergency use only)
 * @param {string} reason - Reason for force closing
 */
export async function forceCloseAllMenus(reason = 'emergency') {
    debugWarn(`Force closing all menus - reason: ${reason}`);
    
    // Close tracked menu through normal means
    const closed = await closeWeaponMenu({ force: true, reason, skipHook: true });
    
    // Manually call hook once at the end if menu was closed
    if (closed) {
        Hooks.call('tokencontextmenu.weaponMenuClosed');
    }
}