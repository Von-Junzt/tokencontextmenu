/**
 * Register all module settings with Foundry
 * @description Defines all user-configurable settings for the token context menu.
 * Settings are client-scoped (per-user) to allow individual preferences.
 */
import { debug } from "../utils/debug.js";
import { EQUIPMENT_STATE_COLORS, EQUIPMENT_ZOOM, EQUIPMENT_BLUR, COLORS } from "../utils/constants.js";

export function registerSettings() {
    // Debug setting - this should show up as last entry in the settings window
    game.settings.register("tokencontextmenu", "debugMode", {
        name: game.i18n.localize("tokencontextmenu.Settings.DebugMode"),
        hint: game.i18n.localize("tokencontextmenu.Settings.DebugModeHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "autoRemoveTargets", {
        name: game.i18n.localize("tokencontextmenu.Settings.AutoRemoveTargets"),
        hint: game.i18n.localize("tokencontextmenu.Settings.AutoRemoveTargetsHint"),
        scope: "client",     // This makes it a per-client setting
        config: true,        // This makes it show up in the configuration menu
        type: Boolean,
        default: true       // Default to automatically removing targets
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

    // Equipment badges display setting
    game.settings.register("tokencontextmenu", "showEquipmentBadges", {
        name: game.i18n.localize("tokencontextmenu.Settings.ShowEquipmentBadges"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ShowEquipmentBadgesHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    // Equipment badge color setting
    game.settings.register("tokencontextmenu", "equipmentBadgeColor", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentBadgeColor"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentBadgeColorHint"),
        scope: "client",
        config: true,
        type: String,
        default: `#${COLORS.EQUIPMENT_BADGE_DEFAULT.toString(16).padStart(6, '0')}`,
        requiresReload: false
    });
    
    // Equipment badge background color setting
    game.settings.register("tokencontextmenu", "equipmentBadgeBgColor", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentBadgeBgColor"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentBadgeBgColorHint"),
        scope: "client",
        config: true,
        type: String,
        default: `#${COLORS.EQUIPMENT_BADGE_BG_DEFAULT.toString(16).padStart(6, '0')}`,
        requiresReload: false
    });

    // Equipment state color toggle setting
    game.settings.register("tokencontextmenu", "useEquipmentStateColors", {
        name: game.i18n.localize("tokencontextmenu.Settings.UseEquipmentStateColors"),
        hint: game.i18n.localize("tokencontextmenu.Settings.UseEquipmentStateColorsHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        requiresReload: false
    });

    // Equipment active state color setting
    game.settings.register("tokencontextmenu", "equipmentColorActive", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentColorActive"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentColorActiveHint"),
        scope: "client",
        config: true,
        type: String,
        default: EQUIPMENT_STATE_COLORS.HEX.ACTIVE,
        requiresReload: false
    });

    // Equipment carried state color setting
    game.settings.register("tokencontextmenu", "equipmentColorCarried", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentColorCarried"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentColorCarriedHint"),
        scope: "client",
        config: true,
        type: String,
        default: EQUIPMENT_STATE_COLORS.HEX.CARRIED,
        requiresReload: false
    });

    // Equipment mode zoom settings
    game.settings.register("tokencontextmenu", "equipmentModeZoom", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeZoom"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeZoomHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "equipmentModeZoomLevel", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeZoomLevel"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeZoomLevelHint"),
        scope: "client",
        config: true,
        type: Number,
        default: EQUIPMENT_ZOOM.DEFAULT_SCALE,
        range: {
            min: EQUIPMENT_ZOOM.MIN_SCALE,
            max: EQUIPMENT_ZOOM.MAX_SCALE,
            step: EQUIPMENT_ZOOM.STEP
        },
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "equipmentModeZoomDuration", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeZoomDuration"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeZoomDurationHint"),
        scope: "client",
        config: true,
        type: Number,
        default: EQUIPMENT_ZOOM.ANIMATION_DURATION,
        range: {
            min: EQUIPMENT_ZOOM.MIN_DURATION,
            max: EQUIPMENT_ZOOM.MAX_DURATION,
            step: EQUIPMENT_ZOOM.DURATION_STEP
        },
        requiresReload: false
    });

    // Equipment mode blur settings
    game.settings.register("tokencontextmenu", "equipmentModeBlur", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeBlur"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeBlurHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "equipmentModeBlurStrength", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeBlurStrength"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeBlurStrengthHint"),
        scope: "client",
        config: true,
        type: Number,
        default: EQUIPMENT_BLUR.DEFAULT_STRENGTH,
        range: {
            min: EQUIPMENT_BLUR.MIN_STRENGTH,
            max: EQUIPMENT_BLUR.MAX_STRENGTH,
            step: EQUIPMENT_BLUR.STRENGTH_STEP
        },
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "equipmentModeBlurQuality", {
        name: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeBlurQuality"),
        hint: game.i18n.localize("tokencontextmenu.Settings.EquipmentModeBlurQualityHint"),
        scope: "client",
        config: true,
        type: Number,
        default: EQUIPMENT_BLUR.DEFAULT_QUALITY,
        range: {
            min: EQUIPMENT_BLUR.MIN_QUALITY,
            max: EQUIPMENT_BLUR.MAX_QUALITY,
            step: EQUIPMENT_BLUR.QUALITY_STEP
        },
        requiresReload: false
    });

    // Reload button color settings
    game.settings.register("tokencontextmenu", "reloadButtonColor", {
        name: game.i18n.localize("tokencontextmenu.Settings.ReloadButtonColor"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ReloadButtonColorHint"),
        scope: "client",
        config: true,
        type: String,
        default: `#${COLORS.EQUIPMENT_BADGE_DEFAULT.toString(16).padStart(6, '0')}`, // Same as badge icon color
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "reloadButtonBgColor", {
        name: game.i18n.localize("tokencontextmenu.Settings.ReloadButtonBgColor"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ReloadButtonBgColorHint"),
        scope: "client",
        config: true,
        type: String,
        default: `#${COLORS.EQUIPMENT_BADGE_BG_DEFAULT.toString(16).padStart(6, '0')}`, // Same as badge bg color
        requiresReload: false
    });

    game.settings.register("tokencontextmenu", "alwaysShowReloadButton", {
        name: game.i18n.localize("tokencontextmenu.Settings.AlwaysShowReloadButton"),
        hint: game.i18n.localize("tokencontextmenu.Settings.AlwaysShowReloadButtonHint"),
        scope: "client",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    });

    // ECT Menu Layout option
    game.settings.register("tokencontextmenu", "ectMenuLayout", {
        name: game.i18n.localize("tokencontextmenu.Settings.ECTMenuLayout"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ECTMenuLayoutHint"),
        scope: "client",
        config: true,
        type: String,
        choices: {
            "list": game.i18n.localize("tokencontextmenu.Settings.ECTMenuLayoutList"),
            "circular": game.i18n.localize("tokencontextmenu.Settings.ECTMenuLayoutCircular")
        },
        default: "circular",
        requiresReload: false
    });

    // ECT Menu Icon Scale setting
    game.settings.register("tokencontextmenu", "ectMenuIconScale", {
        name: game.i18n.localize("tokencontextmenu.Settings.ECTMenuIconScale"),
        hint: game.i18n.localize("tokencontextmenu.Settings.ECTMenuIconScaleHint"),
        scope: "client",
        config: true,
        type: Number,
        range: {
            min: 1.0,
            max: 5.0,
            step: 0.1
        },
        default: 2.7,
        requiresReload: false
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
 * Check if equipment badges should be shown
 * @returns {boolean} True if badges are enabled
 */
export function shouldShowEquipmentBadges() {
    if (typeof game === 'undefined' || !game.ready) return true;
    return game.settings.get("tokencontextmenu", "showEquipmentBadges");
}

/**
 * Get the equipment badge color
 * @returns {string} Hex color string for badge tinting
 */
export function getEquipmentBadgeColor() {
    if (typeof game === 'undefined' || !game.ready) 
        return `#${COLORS.EQUIPMENT_BADGE_FALLBACK.toString(16).padStart(6, '0')}`;
    return game.settings.get("tokencontextmenu", "equipmentBadgeColor");
}

/**
 * Get the equipment badge background color
 * @returns {string} Hex color string for badge background
 */
export function getEquipmentBadgeBgColor() {
    if (typeof game === 'undefined' || !game.ready) 
        return `#${COLORS.EQUIPMENT_BADGE_BG_FALLBACK.toString(16).padStart(6, '0')}`;
    return game.settings.get("tokencontextmenu", "equipmentBadgeBgColor");
}

/**
 * Check if equipment state colors are enabled
 * @returns {boolean} True if state-based coloring is enabled
 */
export function shouldUseEquipmentStateColors() {
    if (typeof game === 'undefined' || !game.ready) return false;
    return game.settings.get("tokencontextmenu", "useEquipmentStateColors");
}

/**
 * Get the equipment active state color
 * @returns {string} Hex color string for active equipment state
 */
export function getEquipmentColorActive() {
    if (typeof game === 'undefined' || !game.ready) return EQUIPMENT_STATE_COLORS.HEX.ACTIVE;
    return game.settings.get("tokencontextmenu", "equipmentColorActive");
}

/**
 * Get the equipment carried state color
 * @returns {string} Hex color string for carried equipment state
 */
export function getEquipmentColorCarried() {
    if (typeof game === 'undefined' || !game.ready) return EQUIPMENT_STATE_COLORS.HEX.CARRIED;
    return game.settings.get("tokencontextmenu", "equipmentColorCarried");
}

/**
 * Check if zoom should be enabled for equipment mode
 * @returns {boolean} True if equipment mode zoom is enabled
 */
export function shouldZoomOnEquipmentMode() {
    if (typeof game === 'undefined' || !game.ready) return false;
    return game.settings.get("tokencontextmenu", "equipmentModeZoom");
}

/**
 * Get the equipment mode zoom level
 * @returns {number} Zoom scale factor
 */
export function getEquipmentModeZoomLevel() {
    if (typeof game === 'undefined' || !game.ready) return EQUIPMENT_ZOOM.DEFAULT_SCALE;
    return game.settings.get("tokencontextmenu", "equipmentModeZoomLevel");
}

/**
 * Get the equipment mode zoom animation duration
 * @returns {number} Animation duration in milliseconds
 */
export function getEquipmentModeZoomDuration() {
    if (typeof game === 'undefined' || !game.ready) return EQUIPMENT_ZOOM.ANIMATION_DURATION;
    return game.settings.get("tokencontextmenu", "equipmentModeZoomDuration");
}

/**
 * Check if blur should be enabled for equipment mode
 * @returns {boolean} True if equipment mode blur is enabled
 */
export function shouldBlurOnEquipmentMode() {
    if (typeof game === 'undefined' || !game.ready) return true;
    return game.settings.get("tokencontextmenu", "equipmentModeBlur");
}

/**
 * Get the equipment mode blur strength
 * @returns {number} Blur strength value
 */
export function getEquipmentModeBlurStrength() {
    if (typeof game === 'undefined' || !game.ready) return EQUIPMENT_BLUR.DEFAULT_STRENGTH;
    return game.settings.get("tokencontextmenu", "equipmentModeBlurStrength");
}

/**
 * Get the equipment mode blur quality
 * @returns {number} Blur quality value
 */
export function getEquipmentModeBlurQuality() {
    if (typeof game === 'undefined' || !game.ready) return EQUIPMENT_BLUR.DEFAULT_QUALITY;
    return game.settings.get("tokencontextmenu", "equipmentModeBlurQuality");
}

/**
 * Gets the reload button icon color
 * @returns {string} The reload button icon color as hex string
 */
export function getReloadButtonColor() {
    if (typeof game === 'undefined' || !game.ready) {
        return `#${COLORS.EQUIPMENT_BADGE_DEFAULT.toString(16).padStart(6, '0')}`;
    }
    return game.settings.get("tokencontextmenu", "reloadButtonColor");
}

/**
 * Gets the reload button background color
 * @returns {string} The reload button background color as hex string
 */
export function getReloadButtonBgColor() {
    if (typeof game === 'undefined' || !game.ready) {
        return `#${COLORS.EQUIPMENT_BADGE_BG_DEFAULT.toString(16).padStart(6, '0')}`;
    }
    return game.settings.get("tokencontextmenu", "reloadButtonBgColor");
}

/**
 * Gets whether to always show reload buttons
 * @returns {boolean} Whether to always show reload buttons
 */
export function getAlwaysShowReloadButton() {
    if (typeof game === 'undefined' || !game.ready) {
        return false;
    }
    return game.settings.get("tokencontextmenu", "alwaysShowReloadButton");
}

/**
 * Gets the ECT menu layout preference
 * @returns {string} The layout type: 'list' or 'circular'
 */
export function getECTMenuLayout() {
    if (typeof game === 'undefined' || !game.ready) {
        return 'list';
    }
    return game.settings.get("tokencontextmenu", "ectMenuLayout");
}

/**
 * Gets the ECT menu icon scale setting
 * @returns {number} The icon scale multiplier (0.5 to 2.0)
 */
export function getECTMenuIconScale() {
    if (typeof game === 'undefined' || !game.ready) {
        return 1.0;
    }
    return game.settings.get("tokencontextmenu", "ectMenuIconScale");
}
