export function registerSettings() {
    game.settings.register("tokencontextmenu", "autoRemoveTargets", {
        name: game.i18n.localize("tokencontextmenu.Settings.AutoRemoveTargets"),
        hint: game.i18n.localize("tokencontextmenu.Settings.AutoRemoveTargetsHint"),
        scope: "client",     // This makes it a per-client setting
        config: true,        // This makes it show up in the configuration menu
        type: Boolean,
        default: true,      // Default to automatically removing targets
        onChange: () => {
            // Force re-render any open token HUDs when the setting changes
            if (canvas.tokens.hud.rendered) canvas.tokens.hud.render(true);
        }
    });

    // Add the new setting for weapon menu on token selection
    game.settings.register("tokencontextmenu", "showWeaponMenuOnSelection", {
        name: "tokencontextmenu.Settings.ShowWeaponMenuOnSelection",
        hint: "tokencontextmenu.Settings.ShowWeaponMenuOnSelectionHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    // Add the new setting for reopening menu after dragging
    game.settings.register("tokencontextmenu", "reopenMenuAfterDrag", {
        name: "tokencontextmenu.Settings.ReopenMenuAfterDrag",
        hint: "tokencontextmenu.Settings.ReopenMenuAfterDragHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "detailedWeaponTooltips", {
        name: "tokencontextmenu.Settings.DetailedWeaponTooltips",
        hint: "tokencontextmenu.Settings.DetailedWeaponTooltipsHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "weaponMenuItemsPerRow", {
        name: "tokencontextmenu.Settings.WeaponItemsPerRow",
        hint: "tokencontextmenu.Settings.WeaponItemsPerRowHint",
        scope: "client",
        config: true,
        type: Number,
        default: 4,
        range: {
            min: 2,
            max: 8,
            step: 1
        },
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "weaponMenuIconScale", {
        name: "tokencontextmenu.Settings.WeaponIconScale",
        hint: "tokencontextmenu.Settings.WeaponIconScaleHint",
        scope: "client",
        config: true,
        type: Number,
        default: 0.5,
        range: {
            min: 0.3,
            max: 1.2,
            step: 0.1
        },
        requiresReload: false
    });
    
    // Debug setting
    game.settings.register("tokencontextmenu", "debugMode", {
        name: "tokencontextmenu.Settings.DebugMode",
        hint: "tokencontextmenu.Settings.DebugModeHint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });
}

// Helper function to check if targets should be automatically removed
export function shouldAutoRemoveTargets() {
    return game.settings.get("tokencontextmenu", "autoRemoveTargets");
}

// Helper function to check if weapon menu should show on selection
export function shouldShowWeaponMenuOnSelection() {
    return game.settings.get("tokencontextmenu", "showWeaponMenuOnSelection");
}

// Export function to get the setting
export function getWeaponMenuItemsPerRow() {
    return game.settings.get("tokencontextmenu", "weaponMenuItemsPerRow");
}

/**
 * Check if detailed weapon tooltips should be shown
 * @returns {boolean} True if detailed tooltips are enabled
 */
export function shouldShowDetailedTooltips() {
    return game.settings.get("tokencontextmenu", "detailedWeaponTooltips");
}

/**
 * Get the weapon menu icon scale factor
 * @returns {number} Scale factor (0.3-1.2)
 */
export function getWeaponMenuIconScale() {
    return game.settings.get("tokencontextmenu", "weaponMenuIconScale");
}

// Helper function to check if weapon menu should reopen after dragging
export function shouldReopenMenuAfterDrag() {
    return game.settings.get("tokencontextmenu", "reopenMenuAfterDrag");
}

// Helper function to check if debug mode is enabled
export function isDebugEnabled() {
    // The WeaponMenuTokenClickManager singleton is created at module load time,
    // before Foundry's game object is initialized. This check prevents errors
    // when debug() is called from the constructor or other early initialization code.
    // Once Foundry is ready, this will always pass and use the actual setting.
    if (typeof game === 'undefined' || !game.settings) {
        return false;
    }
    return game.settings.get("tokencontextmenu", "debugMode");
}