/**
 * @file ECT context menu manager (PIXI-based)
 * @description Manages the Enhanced Combat Toolkit context menu for weapon enhancements
 * Uses ECT's public API and PIXI for canvas-integrated rendering
 */

import { CleanupManager } from "./CleanupManager.js";
import { blurFilterManager } from "./BlurFilterManager.js";
import { weaponSystemCoordinator } from "./WeaponSystemCoordinator.js";
import { debug, debugWarn, debugError } from "../utils/debug.js";
import { COLORS, TIMING, ECT_MENU, ECT_BLUR } from "../utils/constants.js";
import { timestamps } from "../utils/timingUtils.js";

/**
 * Manages ECT enhancement context menu using PIXI
 * Extends CleanupManager for automatic resource cleanup
 */
class ECTMenuManager extends CleanupManager {
    constructor() {
        super();
        this._currentMenuContainer = null;  // PIXI.Container
        this._clickHandler = null;
        this._keyHandler = null;
        this._tokenClickHandler = null;  // Hook handler for token clicks
        this._textureCache = new Map();  // Cache for loaded textures
        this._blurredContainers = null;  // Track containers we've blurred
        
        // Set up cleanup hook - ECT menu should close when weapon menu closes
        Hooks.on('tokencontextmenu.weaponMenuClosed', () => {
            if (this.isOpen()) {
                debug("ECT menu closing - parent weapon menu closed");
                this.hide();
            }
        });
    }

    /**
     * Shows the ECT context menu for a weapon
     * @param {Object} params - Menu parameters
     * @param {Actor} params.actor - The actor that owns the weapon
     * @param {Item} params.weapon - The weapon item
     * @param {Token} params.token - The token
     * @param {PIXI.Container} params.weaponContainer - The weapon icon container
     * @param {number} params.iconRadius - Radius of the weapon icon
     * @param {Function} params.onClose - Callback when menu closes
     * @returns {Promise<void>}
     */
    async show({ actor, weapon, token, weaponContainer, iconRadius, onClose }) {
        // Hide any existing menu
        this.hide();

        // Start with empty menu options
        let menuOptions = [];

        // Check if ECT is available and get menu options
        const ectAPI = game.enhancedcombattoolkit?.api?.weaponContextMenu;
        if (ectAPI && typeof ectAPI.getMenuOptions === 'function') {
            const ectOptions = await ectAPI.getMenuOptions(actor, weapon, token) || [];
            if (ectOptions.length > 0) {
                menuOptions = [...ectOptions];
            }
        }

        // Always add Edit Weapon as the last option
        menuOptions.push({
            name: game.i18n.localize("tokencontextmenu.EditWeapon") || "Edit Weapon",
            callback: () => {
                this.hide();
                if (onClose) onClose();
                weapon.sheet.render(true);
            }
        });

        // Create PIXI menu
        const menu = this._createPIXIMenu(menuOptions, weaponContainer, iconRadius, { weapon, onClose });

        // If no menu was created (no valid icons), return early
        if (!menu) {
            if (onClose) onClose();
            return;
        }

        // Store current menu reference
        this._currentMenuContainer = menu;

        // Mark timestamp for debouncing (same pattern as weapon menu)
        timestamps.mark('ectMenuOpened');

        // Set up event handlers
        this._setupEventHandlers(onClose);

        // Apply blur to other weapon containers
        const weaponMenu = weaponSystemCoordinator.getMenuApp();

        debug("Checking for weapon menu to blur", {
            hasCoordinator: !!weaponSystemCoordinator,
            menuApp: !!weaponMenu,
            containerCount: weaponMenu?.weaponContainers?.length || 0
        });

        if (weaponMenu?.weaponContainers) {
            this._blurredContainers = weaponMenu.weaponContainers;
            blurFilterManager.applyECTWeaponBlur(weaponContainer, this._blurredContainers);
        }

        debug("ECT menu shown", {
            optionCount: menuOptions.length,
            weaponName: weapon.name,
            blurredContainers: this._blurredContainers?.length || 0
        });
    }

    /**
     * Creates the PIXI menu container
     * @param {Array} menuOptions - Array of menu options
     * @param {PIXI.Container} weaponContainer - The weapon icon container
     * @param {number} iconRadius - Radius of the weapon icon
     * @param {Object} context - Context data {weapon, onClose}
     * @returns {PIXI.Container|null} The menu container or null if no valid items
     * @private
     */
    _createPIXIMenu(menuOptions, weaponContainer, iconRadius, context) {
        const menu = new PIXI.Container();
        menu.name = "ect-context-menu";

        // Filter out separators for simplified menu
        const filteredOptions = menuOptions.filter(option => !option.separator);

        // Create circle menu items and filter out nulls
        const circles = [];
        filteredOptions.forEach(option => {
            const circle = this._createMenuItem(option, context);
            if (circle) {
                circles.push(circle);
            }
        });

        // If no valid circles, don't create menu
        if (circles.length === 0) {
            return null;
        }

        // Calculate dimensions based on actual circles
        const circleSize = ECT_MENU.CIRCLE_RADIUS * 2;
        const totalHeight = (circles.length * circleSize) +
                           ((circles.length - 1) * ECT_MENU.CIRCLE_SPACING);

        // Position relative to weapon icon
        const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
        const localPos = canvas.tokens.toLocal(globalPos);
        menu.x = localPos.x + iconRadius + ECT_MENU.POSITION_OFFSET;
        menu.y = localPos.y - totalHeight / 2;  // Center vertically on icon

        // Position and add circles
        let currentY = 0;
        circles.forEach(circle => {
            circle.y = currentY;
            menu.addChild(circle);
            currentY += circleSize + ECT_MENU.CIRCLE_SPACING;
        });

        // Check if menu would go off screen and adjust
        this._adjustMenuPosition(menu, circleSize, totalHeight, weaponContainer, iconRadius);

        // Add to canvas tokens layer (same layer as weapon menu)
        canvas.tokens.addChild(menu);

        return menu;
    }

    /**
     * Resolves the icon path for a menu option
     * @param {Object} option - Menu option
     * @param {Object} context - Context with weapon data
     * @returns {string|null} Icon path or null
     * @private
     */
    _resolveIconPath(option, context) {
        // Check if option already has an icon
        if (option.icon) {
            // Extract icon path from HTML if it's wrapped in HTML
            const iconMatch = option.icon.match(/src=["']([^"']+)["']/);
            if (iconMatch) {
                return iconMatch[1];
            } else if (typeof option.icon === 'string' && !option.icon.includes('<')) {
                // Direct path
                return option.icon;
            }
        }

        // Check if this is the Edit Weapon option
        if (option.name.includes("Edit")) {
            return ECT_MENU.EDIT_ICON_PATH;
        }

        // Get enhancement type from mapping
        const enhancementType = ECT_MENU.ENHANCEMENT_MAPPINGS[option.name];
        if (!enhancementType || !context.weapon) {
            return null;
        }

        // Try to get icon from ECT API
        const ectAPI = game.enhancedcombattoolkit?.api?.weaponContextMenu;
        let iconPath = ectAPI?.getEnhancementIcon?.(context.weapon, enhancementType);

        // If no path from API, check weapon's enhancement data directly
        if (!iconPath) {
            const enhancements = context.weapon.flags?.enhancedcombattoolkit?.enhancements || [];
            const enhancement = enhancements.find(e => e.enhancementType === enhancementType);
            iconPath = enhancement?.img;
        }

        // Add module path if needed
        if (iconPath && !iconPath.startsWith('modules/') && !iconPath.startsWith('systems/')) {
            iconPath = `modules/enhancedcombattoolkit/${iconPath}`;
        }

        return iconPath;
    }

    /**
     * Creates a single menu item as a circular icon
     * @param {Object} option - Menu option configuration
     * @param {Object} context - Context data {weapon, onClose}
     * @returns {PIXI.Container|null} The menu item container or null if invalid
     * @private
     */
    _createMenuItem(option, context) {
        const iconPath = this._resolveIconPath(option, context);

        // Only create circle if we have an icon
        if (!iconPath) {
            return null;
        }

        const container = new PIXI.Container();

        // Create circle border
        const circle = new PIXI.Graphics();
        circle.lineStyle(ECT_MENU.CIRCLE_BORDER_WIDTH, ECT_MENU.CIRCLE_BORDER_COLOR);
        circle.drawCircle(ECT_MENU.CIRCLE_RADIUS, ECT_MENU.CIRCLE_RADIUS, ECT_MENU.CIRCLE_RADIUS);
        container.addChild(circle);

        // Create icon sprite (with caching)
        try {
            // Check texture cache first
            let iconTexture = this._textureCache.get(iconPath);
            if (!iconTexture) {
                // Limit cache size - simple FIFO eviction
                const MAX_CACHE_SIZE = 20;
                if (this._textureCache.size >= MAX_CACHE_SIZE) {
                    const firstKey = this._textureCache.keys().next().value;
                    this._textureCache.delete(firstKey);
                }
                
                iconTexture = PIXI.Texture.from(iconPath);
                this._textureCache.set(iconPath, iconTexture);
            }

            const icon = new PIXI.Sprite(iconTexture);

            // Size and position icon within circle
            icon.width = ECT_MENU.ICON_SIZE;
            icon.height = ECT_MENU.ICON_SIZE;
            icon.x = ECT_MENU.CIRCLE_RADIUS - (ECT_MENU.ICON_SIZE / 2);
            icon.y = ECT_MENU.CIRCLE_RADIUS - (ECT_MENU.ICON_SIZE / 2);

            // Create circular mask for the icon
            const iconMask = new PIXI.Graphics();
            iconMask.beginFill(0xffffff);
            iconMask.drawCircle(ECT_MENU.CIRCLE_RADIUS, ECT_MENU.CIRCLE_RADIUS, ECT_MENU.ICON_MASK_RADIUS);
            iconMask.endFill();

            // Apply mask to icon
            icon.mask = iconMask;

            // Add mask and icon to container
            container.addChild(iconMask);
            container.addChild(icon);
        } catch (error) {
            debugError(`Failed to load icon for ${option.name}:`, error);
            return null;
        }

        // Make container interactive
        container.interactive = true;
        container.eventMode = 'static';
        container.cursor = 'pointer';

        // Set hit area to circle
        container.hitArea = new PIXI.Circle(ECT_MENU.CIRCLE_RADIUS, ECT_MENU.CIRCLE_RADIUS, ECT_MENU.CIRCLE_RADIUS);

        // Click handler
        container.on('pointerdown', async (event) => {
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }

            // Hide menu
            this.hide();
            if (context.onClose) context.onClose();

            // Execute callback
            if (option.callback) {
                // Try-catch acceptable here - executing external module code
                try {
                    await option.callback(context.weapon);
                } catch (error) {
                    debugWarn(`Failed to execute ECT action: ${option.name}`, error);
                    ui.notifications.error(`Failed to ${option.name}`);
                }
            }
        });

        return container;
    }

    /**
     * Adjusts menu position to keep it on screen
     * @param {PIXI.Container} menu - The menu container
     * @param {number} menuWidth - Menu width
     * @param {number} menuHeight - Menu height
     * @param {PIXI.Container} weaponContainer - The weapon icon container
     * @param {number} iconRadius - Icon radius
     * @private
     */
    _adjustMenuPosition(menu, menuWidth, menuHeight, weaponContainer, iconRadius) {
        const menuBounds = {
            left: menu.x,
            right: menu.x + menuWidth,
            top: menu.y,
            bottom: menu.y + menuHeight
        };

        const canvasBounds = canvas.dimensions.rect;

        // Check right edge
        if (menuBounds.right > canvasBounds.right) {
            // Position to left of icon instead
            const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
            const localPos = canvas.tokens.toLocal(globalPos);
            menu.x = localPos.x - iconRadius - menuWidth - ECT_MENU.POSITION_OFFSET;
        }

        // Check bottom edge
        if (menuBounds.bottom > canvasBounds.bottom) {
            menu.y = canvasBounds.bottom - menuHeight - ECT_MENU.EDGE_PADDING;
        }

        // Check top edge
        if (menuBounds.top < canvasBounds.top) {
            menu.y = canvasBounds.top + ECT_MENU.EDGE_PADDING;
        }
    }

    /**
     * Sets up event handlers for closing the menu
     * @param {Function} onClose - Close callback
     * @private
     */
    _setupEventHandlers(onClose) {
        // Listen for clicks on tokens layer (catches ALL token clicks, not just selection changes)
        this._tokenClickHandler = (event) => {
            // Check if the click target is a token
            let isTokenClick = false;
            const target = event.target;
            
            if (target instanceof foundry.canvas.placeables.Token) {
                isTokenClick = true;
            } else if (target?.parent instanceof foundry.canvas.placeables.Token) {
                isTokenClick = true;
            } else {
                // Walk up the parent chain to find a token
                let parent = target?.parent;
                while (parent && !(parent instanceof foundry.canvas.placeables.Token)) {
                    parent = parent.parent;
                }
                if (parent instanceof foundry.canvas.placeables.Token) {
                    isTokenClick = true;
                }
            }

            if (isTokenClick) {
                debug("ECT menu closing - token clicked");
                this.hide();
                if (onClose) onClose();
            }
        };

        // Add listener to tokens layer (following the same pattern as WeaponMenuTokenClickManager)
        if (canvas?.tokens) {
            canvas.tokens.on('pointerdown', this._tokenClickHandler);
        }

        // Close on canvas click outside the menu
        this._clickHandler = (event) => {
            // Check debounce timing to prevent immediate close
            if (!timestamps.hasElapsed('ectMenuOpened', TIMING.MENU_CLICK_DEBOUNCE)) {
                return;
            }

            // Check if click is outside menu bounds
            if (this._currentMenuContainer) {
                const bounds = this._currentMenuContainer.getBounds();
                const point = event.data.global;

                if (!bounds.contains(point.x, point.y)) {
                    debug("ECT menu closing - clicked outside bounds");
                    this.hide();
                    if (onClose) onClose();
                }
            }
        };

        // Add click listener to canvas with capture phase to catch events before stopPropagation
        // Use 'true' for capture phase so we get the event before weapon containers
        if (canvas?.ready && canvas?.stage) {
            canvas.stage.on('pointerdown', this._clickHandler, null, true);
        }

        // Close on escape key
        this._keyHandler = (event) => {
            if (event.key === 'Escape') {
                this.hide();
                if (onClose) onClose();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    }

    /**
     * Hides the current menu
     */
    hide() {
        // Early return if nothing to hide
        if (!this._currentMenuContainer && !this._blurredContainers && !this._clickHandler && !this._keyHandler && !this._tokenClickHandler) {
            return;
        }

        // Clear weapon container blur if applied
        if (this._blurredContainers) {
            blurFilterManager.clearECTWeaponBlur(this._blurredContainers);
            this._blurredContainers = null;
        }

        // Remove PIXI container
        if (this._currentMenuContainer) {
            // Remove from parent
            if (this._currentMenuContainer.parent) {
                this._currentMenuContainer.parent.removeChild(this._currentMenuContainer);
            }

            // Destroy PIXI objects
            this._currentMenuContainer.destroy({ children: true });
            this._currentMenuContainer = null;
        }

        // Remove event handlers - must match how they were added
        if (this._clickHandler && canvas?.stage) {
            canvas.stage.off('pointerdown', this._clickHandler, null, true);
            this._clickHandler = null;
        }

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        // Remove token click handler from tokens layer
        if (this._tokenClickHandler && canvas?.tokens) {
            canvas.tokens.off('pointerdown', this._tokenClickHandler);
            this._tokenClickHandler = null;
        }

        debug("ECT menu hidden");
    }

    /**
     * Check if the ECT menu is currently open
     * @returns {boolean} True if menu is open, false otherwise
     */
    isOpen() {
        return !!this._currentMenuContainer;
    }

    /**
     * Cleanup method called when manager is destroyed
     * @override
     */
    cleanup() {
        // Clear any remaining blur
        if (this._blurredContainers) {
            blurFilterManager.clearECTWeaponBlur(this._blurredContainers);
            this._blurredContainers = null;
        }
        // Clear texture cache
        this._textureCache.clear();
        this.hide();
        super.cleanup();
    }
}

// Export singleton instance following project pattern
export const ectMenuManager = new ECTMenuManager();