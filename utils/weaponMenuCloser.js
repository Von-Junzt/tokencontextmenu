/**
 * @file Centralized weapon menu closing utility
 * @description Provides a single, consistent way to close weapon menus throughout the module
 */

import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { WeaponMenuApplication } from "../applications/weaponMenuApplication.js";

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
    
    console.debug(`Token Context Menu | Closing weapon menu - reason: ${reason}`);
    
    let menuClosed = false;
    
    // First try: Close via the registered application (preferred method)
    const menuApp = weaponSystemCoordinator.getMenuApp();
    if (menuApp && menuApp instanceof WeaponMenuApplication) {
        // Check if the menu is already closing or closed
        const menuState = menuApp.stateMachine?.getState();
        if (menuState === 'CLOSING' || menuState === 'CLOSED') {
            console.debug('Token Context Menu | Menu already closing/closed');
            menuClosed = true;
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
    
    // Second try: Clean up any orphaned menus on the canvas
    const orphanedMenus = findOrphanedMenus();
    if (orphanedMenus.length > 0) {
        orphanedMenus.forEach(menu => cleanupOrphanedMenu(menu));
        menuClosed = true;
    }
    
    // Update coordinator state if needed
    if (menuClosed) {
        weaponSystemCoordinator.updateMenuState({
            weaponMenuOpen: false,
            currentToken: null,
            currentMenuApp: null
        });
        
        // Call hook if not skipped
        if (!skipHook) {
            Hooks.call('tokencontextmenu.weaponMenuClosed');
        }
    } else if (weaponSystemCoordinator.isMenuOpen()) {
        // State mismatch - coordinator thinks menu is open but we found nothing
        console.warn('Token Context Menu | State mismatch detected - clearing menu state');
        weaponSystemCoordinator.updateMenuState({
            weaponMenuOpen: false,
            currentToken: null,
            currentMenuApp: null
        });
    }
    
    return menuClosed;
}

/**
 * Find orphaned weapon menus on the canvas
 * @returns {PIXI.Container[]} Array of orphaned menu containers
 */
function findOrphanedMenus() {
    if (!canvas.tokens?.children) return [];
    
    const currentMenuContainer = weaponSystemCoordinator.getMenuApp()?.container;
    
    return canvas.tokens.children.filter(child => {
        // Must be a weapon menu
        if (child.name !== "tokencontextmenu-weapon-menu") return false;
        
        // If we have a current menu container, exclude it
        if (currentMenuContainer && child === currentMenuContainer) return false;
        
        // Otherwise, it's orphaned
        return true;
    });
}

/**
 * Clean up an orphaned menu container
 * @param {PIXI.Container} menu - The orphaned menu container
 */
function cleanupOrphanedMenu(menu) {
    console.warn('Token Context Menu | Cleaning up orphaned menu');
    
    // Remove from parent
    if (menu.parent) {
        menu.parent.removeChild(menu);
    }
    
    // Clean up weapon containers
    if (menu.weaponContainers && Array.isArray(menu.weaponContainers)) {
        menu.weaponContainers.forEach(wc => {
            if (wc && !wc.destroyed) {
                wc.removeAllListeners();
            }
        });
    }
    
    // Destroy the container
    if (!menu.destroyed) {
        menu.destroy({ children: true });
    }
}

/**
 * Force close all weapon menus (emergency use only)
 * @param {string} reason - Reason for force closing
 */
export async function forceCloseAllMenus(reason = 'emergency') {
    console.warn(`Token Context Menu | Force closing all menus - reason: ${reason}`);
    
    // Close tracked menu (this will also handle orphaned menus)
    await closeWeaponMenu({ force: true, reason, skipHook: true });
    
    // Extra paranoid cleanup - find ANY menu-like containers that might have been missed
    if (canvas.tokens?.children) {
        const suspiciousContainers = canvas.tokens.children.filter(child =>
            child !== weaponSystemCoordinator.getMenuApp()?.container &&
            (child.name?.includes('menu') || child.weaponContainers !== undefined)
        );
        
        suspiciousContainers.forEach(container => {
            cleanupOrphanedMenu(container);
        });
    }
    
    // Manually call hook once at the end if anything was closed
    Hooks.call('tokencontextmenu.weaponMenuClosed');
}