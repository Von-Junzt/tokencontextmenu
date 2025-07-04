/**
 * Register all module settings with Foundry
 * @description Defines all user-configurable settings for the token context menu.
 * Settings are client-scoped (per-user) to allow individual preferences.
 */
import { debug } from "../utils/debug.js";

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
    
    // Settings for expanding sections by default
    game.settings.register("tokencontextmenu", "expandWeaponsByDefault", {
        name: game.i18n.localize("tokencontextmenu.Settings.ExpandWeaponsByDefault"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ExpandWeaponsByDefaultHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });
    
    game.settings.register("tokencontextmenu", "expandPowersByDefault", {
        name: game.i18n.localize("tokencontextmenu.Settings.ExpandPowersByDefault"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ExpandPowersByDefaultHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });
    
    // Equipment badge color setting
    game.settings.register("tokencontextmenu", "equipmentBadgeColor", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentBadgeColor"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentBadgeColorHint"),
        scope: "client",     // Per-client setting
        config: true,        // Shows in configuration menu
        type: String,
        default: "#00c4ff",  // default color
        requiresReload: false,
        onChange: (value) => {
            debug("Equipment badge color changed", { newColor: value });
            
            // Get the coordinator instance properly
            if (window.tokencontextmenu?.weaponSystemCoordinator) {
                const menuApp = window.tokencontextmenu.weaponSystemCoordinator.getMenuApp();
                if (menuApp?.rendered) {
                    debug("Refreshing menu display for color change");
                    menuApp._updateMenuDisplay();
                }
            }
        }
    });
}

/**
 * Check if targets should be automatically removed when selecting weapons
 * @returns {boolean} True if auto-remove is enabled
 */
export function shouldAutoRemoveTargets() {
    if (typeof game === 'undefined' || !game.ready) return true;
    return game.settings.get("tokencontextmenu", "autoRemoveTargets");
}

/**
 * Check if weapon menu should show automatically on token selection
 * @returns {boolean} True if auto-show is enabled
 */
export function shouldShowWeaponMenuOnSelection() {
    if (typeof game === 'undefined' || !game.ready) return true;
    return game.settings.get("tokencontextmenu", "showWeaponMenuOnSelection");
}

/**
 * Get the number of weapon items to display per row
 * @returns {number} Items per row (2-8)
 */
export function getWeaponMenuItemsPerRow() {
    if (typeof game === 'undefined' || !game.ready) return 4;
    return game.settings.get("tokencontextmenu", "weaponMenuItemsPerRow");
}

/**
 * Check if detailed weapon tooltips should be shown
 * @returns {boolean} True if detailed tooltips are enabled
 */
export function shouldShowDetailedTooltips() {
    if (typeof game === 'undefined' || !game.ready) return true;
    return game.settings.get("tokencontextmenu", "detailedWeaponTooltips");
}

/**
 * Get the weapon menu icon scale factor
 * @returns {number} Scale factor (0.3-1.2)
 */
export function getWeaponMenuIconScale() {
    if (typeof game === 'undefined' || !game.ready) return 0.5;
    return game.settings.get("tokencontextmenu", "weaponMenuIconScale");
}

/**
 * Check if weapon menu should reopen after dragging tokens
 * @returns {boolean} True if reopen after drag is enabled
 */
export function shouldReopenMenuAfterDrag() {
    if (typeof game === 'undefined' || !game.ready) return true;
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
    if (typeof game === 'undefined' || !game.ready) {
        return false;
    }
    
    return game.settings.get("tokencontextmenu", "debugMode");
}

/**
 * Get the equipment badge color
 * @returns {string} Hex color string for badge tinting
 */
export function getEquipmentBadgeColor() {
    if (typeof game === 'undefined' || !game.ready) return "#FFA500";
    return game.settings.get("tokencontextmenu", "equipmentBadgeColor");
}

/**
 * Hook to add color picker UI to settings
 * Uses Foundry's native HTML5 color input
 */
Hooks.on("renderSettingsConfig", (app, html, data) => {
    // Find our color setting input
    const colorInput = html.find('input[name="tokencontextmenu.equipmentBadgeColor"]');
    if (colorInput.length) {
        // Get the current value
        const currentValue = colorInput.val();
        
        // Create a color input element using HTML5 native color picker
        const colorPicker = $(`<input type="color" value="${currentValue}" style="height: 28px; width: 50px; margin-left: 10px; cursor: pointer;">`);
        
        // Insert the color picker after the text input
        colorInput.after(colorPicker);
        
        // Update both when color picker changes
        colorPicker.on("change input", function() {
            colorInput.val(this.value).trigger("change");
        });
        
        // Update color picker when text input changes
        colorInput.on("change input", function() {
            const value = $(this).val();
            // Validate hex color format
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                colorPicker.val(value);
            }
        });
        
        // Make the text input wider to accommodate the color picker
        colorInput.css("width", "calc(100% - 60px)");
    }
});
