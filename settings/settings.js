/**
 * Register all module settings with Foundry
 * @description Defines all user-configurable settings for the token context menu.
 * Settings are client-scoped (per-user) to allow individual preferences.
 */
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
        name: game.i18n.localize("tokencontextmenu.Settings.ShowWeaponMenuOnSelection"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ShowWeaponMenuOnSelectionHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    // Add the new setting for reopening menu after dragging
    game.settings.register("tokencontextmenu", "reopenMenuAfterDrag", {
        name: game.i18n.localize("tokencontextmenu.Settings.ReopenMenuAfterDrag"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ReopenMenuAfterDragHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "detailedWeaponTooltips", {
        name: game.i18n.localize("tokencontextmenu.Settings.DetailedWeaponTooltips"),
        hint: game.i18n.localize("tokencontextmenu.Settings.DetailedWeaponTooltipsHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "weaponMenuItemsPerRow", {
        name: game.i18n.localize("tokencontextmenu.Settings.WeaponItemsPerRow"),
        hint: game.i18n.localize("tokencontextmenu.Settings.WeaponItemsPerRowHint"),
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
        name: game.i18n.localize("tokencontextmenu.Settings.WeaponIconScale"),
        hint: game.i18n.localize("tokencontextmenu.Settings.WeaponIconScaleHint"),
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
        name: game.i18n.localize("tokencontextmenu.Settings.DebugMode"),
        hint: game.i18n.localize("tokencontextmenu.Settings.DebugModeHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });
}

/**
 * Check if targets should be automatically removed when selecting weapons
 * @returns {boolean} True if auto-remove is enabled
 */
export function shouldAutoRemoveTargets() {
    return game.settings.get("tokencontextmenu", "autoRemoveTargets");
}

/**
 * Check if weapon menu should show automatically on token selection
 * @returns {boolean} True if auto-show is enabled
 */
export function shouldShowWeaponMenuOnSelection() {
    return game.settings.get("tokencontextmenu", "showWeaponMenuOnSelection");
}

/**
 * Get the number of weapon items to display per row
 * @returns {number} Items per row (2-8)
 */
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

/**
 * Check if weapon menu should reopen after dragging tokens
 * @returns {boolean} True if reopen after drag is enabled
 */
export function shouldReopenMenuAfterDrag() {
    return game.settings.get("tokencontextmenu", "reopenMenuAfterDrag");
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} True if debug mode is active
 * @description Includes safety check for early module initialization before
 * Foundry's game object is available. This prevents errors during singleton
 * construction.
 */
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