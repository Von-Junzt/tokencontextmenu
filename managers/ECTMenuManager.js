/**
 * @file ECT context menu manager (PIXI-based)
 * @description Manages the Enhanced Combat Toolkit context menu for weapon enhancements
 * Uses ECT's public API and PIXI for canvas-integrated rendering
 */

import { CleanupManager } from "./CleanupManager.js";
import { debug, debugWarn } from "../utils/debug.js";
import { COLORS, TIMING } from "../utils/constants.js";
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

        // Add detailed debugging
        debug("ECT Integration Check:", {
            moduleActive: game.modules.get('enhancedcombattoolkit')?.active,
            gameObject: !!game.enhancedcombattoolkit,
            apiObject: !!game.enhancedcombattoolkit?.api,
            weaponContextMenuAPI: !!game.enhancedcombattoolkit?.api?.weaponContextMenu,
            hasGetMenuOptions: typeof game.enhancedcombattoolkit?.api?.weaponContextMenu?.getMenuOptions,
            weaponName: weapon?.name,
            weaponType: weapon?.type,
            weaponFlags: weapon?.flags?.enhancedcombattoolkit
        });

        // Check if ECT is available and get menu options
        // ECT initializes its API in the ready hook, so it should be available now
        const ectAPI = game.enhancedcombattoolkit?.api?.weaponContextMenu;
        if (ectAPI && typeof ectAPI.getMenuOptions === 'function') {
            const ectOptions = await ectAPI.getMenuOptions(actor, weapon, token) || [];
            debug("ECT options retrieved:", {
                count: ectOptions.length,
                options: ectOptions.map(opt => opt.name),
                weaponEnhancements: weapon?.flags?.enhancedcombattoolkit?.enhancements
            });
            if (ectOptions.length > 0) {
                menuOptions = [...ectOptions];
            }
        } else {
            debug("ECT API not available or getMenuOptions not a function", {
                ectAPI: ectAPI,
                typeOfGetMenuOptions: typeof ectAPI?.getMenuOptions
            });
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

        // Store current menu reference
        this._currentMenuContainer = menu;

        // Mark timestamp for debouncing (same pattern as weapon menu)
        timestamps.mark('ectMenuOpened');

        // Set up event handlers
        this._setupEventHandlers(onClose);

        debug("ECT menu shown", {
            optionCount: menuOptions.length,
            weaponName: weapon.name
        });
    }

    /**
     * Creates the PIXI menu container
     * @param {Array} menuOptions - Array of menu options
     * @param {PIXI.Container} weaponContainer - The weapon icon container
     * @param {number} iconRadius - Radius of the weapon icon
     * @param {Object} context - Context data {weapon, onClose}
     * @returns {PIXI.Container} The menu container
     * @private
     */
    _createPIXIMenu(menuOptions, weaponContainer, iconRadius, context) {
        const menu = new PIXI.Container();
        menu.name = "ect-context-menu";

        // Simpler dimensions for badge-style items
        const menuWidth = 150;
        const itemHeight = 24;
        const padding = 4;

        // Filter out separators for simplified menu
        const filteredOptions = menuOptions.filter(option => !option.separator);

        // Calculate total height
        const totalHeight = (filteredOptions.length * itemHeight) + (padding * 2);

        // Position relative to weapon icon
        const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
        const localPos = canvas.tokens.toLocal(globalPos);
        menu.x = localPos.x + iconRadius + 15;  // Position to right of icon
        menu.y = localPos.y - totalHeight / 2;  // Center vertically on icon

        // Create background
        const background = new PIXI.Graphics();
        background.beginFill(0x000000, 0.85);
        background.lineStyle(1, COLORS.MENU_BORDER);
        background.drawRoundedRect(0, 0, menuWidth, totalHeight, 5);
        background.endFill();
        menu.addChild(background);

        // Make the background interactive to prevent click-through
        background.interactive = true;
        background.eventMode = 'static';

        // Create menu items as simple text badges
        let currentY = padding;
        filteredOptions.forEach((option, index) => {
            const textBadge = this._createMenuItem(
                option,
                currentY,
                menuWidth,
                itemHeight,
                context
            );
            menu.addChild(textBadge);
            currentY += itemHeight;
        });

        // Check if menu would go off screen and adjust
        this._adjustMenuPosition(menu, menuWidth, totalHeight, weaponContainer, iconRadius);

        // Add to canvas tokens layer (same layer as weapon menu)
        canvas.tokens.addChild(menu);

        return menu;
    }

    /**
     * Creates a single menu item as a text badge
     * @param {Object} option - Menu option configuration
     * @param {number} y - Y position within menu
     * @param {number} width - Item width
     * @param {number} height - Item height
     * @param {Object} context - Context data {weapon, onClose}
     * @returns {PIXI.Text} The text badge
     * @private
     */
    _createMenuItem(option, y, width, height, context) {
        // Create text badge with better rendering
        const text = new PIXI.Text(option.name, {
            fontFamily: 'Signika',  // Use system fonts for sharper rendering
            fontSize: 10,  // Slightly larger for better readability
            fill: 0xffffff,  // Pure white for better contrast
            align: 'center',
            resolution: 4  // Higher resolution for sharper text
        });

        // Position the text
        text.x = (width - text.width) / 2;  // Center horizontally
        text.y = y + (height - text.height) / 2;  // Position vertically with centering

        // Make text interactive
        text.interactive = true;
        text.eventMode = 'static';
        text.cursor = 'pointer';

        // Set hitArea to the full item area, not just the text bounds
        text.hitArea = new PIXI.Rectangle(
            -(width - text.width) / 2,  // Offset to expand hit area to full width
            -(height - text.height) / 2,  // Offset to expand hit area to full height
            width,
            height
        );

        // Click handler
        text.on('pointerdown', async (event) => {
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }

            debug(`ECT menu item clicked: ${option.name}`);

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

        return text;
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
            menu.x = localPos.x - iconRadius - menuWidth - 15;
        }

        // Check bottom edge
        if (menuBounds.bottom > canvasBounds.bottom) {
            menu.y = canvasBounds.bottom - menuHeight - 10;
        }

        // Check top edge
        if (menuBounds.top < canvasBounds.top) {
            menu.y = canvasBounds.top + 10;
        }
    }

    /**
     * Sets up event handlers for closing the menu
     * @param {Function} onClose - Close callback
     * @private
     */
    _setupEventHandlers(onClose) {
        // Close on canvas click outside the menu
        this._clickHandler = (event) => {
            // Check debounce timing to prevent immediate close
            if (!timestamps.hasElapsed('ectMenuOpened', TIMING.MENU_CLICK_DEBOUNCE)) {
                return;
            }

            // Check if click is outside menu
            if (this._currentMenuContainer) {
                const bounds = this._currentMenuContainer.getBounds();
                const point = event.data.global;

                if (!bounds.contains(point.x, point.y)) {
                    this.hide();
                    if (onClose) onClose();
                }
            }
        };

        // Add click listener to canvas
        canvas.stage.on('pointerdown', this._clickHandler);

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

        // Remove event handlers
        if (this._clickHandler) {
            canvas.stage.off('pointerdown', this._clickHandler);
            this._clickHandler = null;
        }

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }

        debug("ECT menu hidden");
    }

    /**
     * Cleanup method called when manager is destroyed
     * @override
     */
    cleanup() {
        this.hide();
        super.cleanup();
    }
}

// Export singleton instance following project pattern
export const ectMenuManager = new ECTMenuManager();