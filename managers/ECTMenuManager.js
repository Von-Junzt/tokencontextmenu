/**
 * @file ECT context menu manager (PIXI-based)
 * @description Manages the Enhanced Combat Toolkit context menu for weapon enhancements
 * Uses ECT's public API and PIXI for canvas-integrated rendering
 */

import { CleanupManager } from "./CleanupManager.js";
import { blurFilterManager } from "./BlurFilterManager.js";
import { weaponSystemCoordinator } from "./WeaponSystemCoordinator.js";
import { debug, debugWarn, debugError } from "../utils/debug.js";
import { COLORS, TIMING, ECT_MENU, ECT_BLUR, GRID, MATH } from "../utils/constants.js";
import { timestamps } from "../utils/timingUtils.js";
import { getECTMenuLayout, getWeaponMenuIconScale, getECTMenuIconScale } from "../settings/settings.js";

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
     * Calculates scaled dimensions based on grid size and user settings
     * @returns {Object} Object with scaled dimensions
     * @private
     */
    _calculateScaledDimensions() {
        // Cache grid size with fallback
        const gridSize = canvas?.grid?.size || GRID.DEFAULT_SIZE;

        // Cache scale settings (only 2 settings calls instead of 6)
        const baseScale = getWeaponMenuIconScale();  // Base scaling with grid
        const ectScale = getECTMenuIconScale();      // User's ECT-specific scale preference
        const combinedScale = baseScale * ectScale;  // Combine both scales

        // Calculate all scaled dimensions once
        return {
            // Core dimensions
            circleRadius: Math.round(gridSize * ECT_MENU.CIRCLE_RADIUS_RATIO * combinedScale),
            circleSpacing: Math.round(gridSize * ECT_MENU.CIRCLE_SPACING_RATIO * combinedScale),
            iconSize: Math.round(gridSize * ECT_MENU.ICON_SIZE_RATIO * combinedScale),
            positionOffset: Math.round(gridSize * ECT_MENU.POSITION_OFFSET_RATIO * combinedScale),
            iconMaskRadius: Math.round(gridSize * ECT_MENU.ICON_MASK_RADIUS_RATIO * combinedScale),
            circleBorderWidth: Math.max(1, Math.round(gridSize * ECT_MENU.CIRCLE_BORDER_WIDTH_RATIO * combinedScale)),
            edgePadding: Math.round(gridSize * ECT_MENU.EDGE_PADDING_RATIO * combinedScale),

            // Circular layout specific (calculated once here, not repeated later)
            circularRadiusOffset: Math.round(ECT_MENU.CIRCULAR.RADIUS_OFFSET_RATIO * gridSize * combinedScale),

            // Store the scales for any other calculations that might need them
            gridSize: gridSize,
            combinedScale: combinedScale
        };
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

        // Calculate scaled dimensions for this menu
        const scaledDimensions = this._calculateScaledDimensions();

        // Filter out separators for simplified menu
        const filteredOptions = menuOptions.filter(option => !option.separator);

        // Create circle menu items and filter out nulls
        const circles = [];
        filteredOptions.forEach(option => {
            const circle = this._createMenuItem(option, context, scaledDimensions);
            if (circle) {
                circles.push(circle);
            }
        });

        // If no valid circles, don't create menu
        if (circles.length === 0) {
            return null;
        }

        // Get layout preference
        const layout = getECTMenuLayout();

        // Position menu based on layout
        if (layout === ECT_MENU.LAYOUTS.CIRCULAR) {
            this._positionCircular(circles, menu, weaponContainer, iconRadius, scaledDimensions);
        } else {
            this._positionList(circles, menu, weaponContainer, iconRadius, scaledDimensions);
        }

        // Add to canvas tokens layer (same layer as weapon menu)
        canvas.tokens.addChild(menu);

        return menu;
    }

    /**
     * Position menu items in a vertical list layout
     * @param {Array<PIXI.Container>} circles - Array of menu item containers
     * @param {PIXI.Container} menu - The menu container
     * @param {PIXI.Container} weaponContainer - The weapon icon container
     * @param {number} iconRadius - Radius of the weapon icon
     * @param {Object} scaledDimensions - Scaled dimension values
     * @private
     */
    _positionList(circles, menu, weaponContainer, iconRadius, scaledDimensions) {
        // Use scaled dimensions
        const circleSize = scaledDimensions.circleRadius * 2;
        const totalHeight = (circles.length * circleSize) +
                           ((circles.length - 1) * scaledDimensions.circleSpacing);

        // Position relative to weapon icon
        const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
        const localPos = canvas.tokens.toLocal(globalPos);
        menu.x = localPos.x + iconRadius + scaledDimensions.positionOffset + scaledDimensions.circleRadius;
        menu.y = localPos.y - totalHeight / 2 + scaledDimensions.circleRadius;  // Center vertically on icon

        // Position and add circles with animation
        let currentY = 0;
        circles.forEach((circle, index) => {
            // Set initial state (at origin, invisible)
            circle.x = 0;
            circle.y = 0;
            circle.scale.set(ECT_MENU.ANIMATION.INITIAL_SCALE);
            circle.alpha = 0;
            menu.addChild(circle);

            // Calculate target position
            const targetY = currentY;
            currentY += circleSize + scaledDimensions.circleSpacing;

            // Animate to target position with stagger
            this._animateMenuItem(circle, 0, targetY, index);
        });

        // Check if menu would go off screen and adjust
        this._adjustMenuPosition(menu, circleSize, totalHeight, weaponContainer, iconRadius, scaledDimensions);
    }

    /**
     * Position menu items in a circular layout around the weapon
     * @param {Array<PIXI.Container>} circles - Array of menu item containers
     * @param {PIXI.Container} menu - The menu container
     * @param {PIXI.Container} weaponContainer - The weapon icon container
     * @param {number} iconRadius - Radius of the weapon icon
     * @param {Object} scaledDimensions - Scaled dimension values
     * @private
     */
    _positionCircular(circles, menu, weaponContainer, iconRadius, scaledDimensions) {
        // Position menu at weapon center
        const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
        const localPos = canvas.tokens.toLocal(globalPos);
        menu.x = localPos.x;
        menu.y = localPos.y;

        // Calculate total angular spread based on number of items
        // For even distribution, center the arc around 0° (3 o'clock)
        const totalSpread = (circles.length - 1) * ECT_MENU.CIRCULAR.ANGLE_STEP;
        const startAngle = -(totalSpread / 2); // Start from top of arc

        circles.forEach((circle, index) => {
            // Set initial state (at center, invisible)
            circle.x = 0;
            circle.y = 0;
            circle.scale.set(ECT_MENU.ANIMATION.INITIAL_SCALE);
            circle.alpha = 0;
            menu.addChild(circle);

            // Calculate angle for this item (spreading from top to bottom)
            const angle = startAngle + (index * ECT_MENU.CIRCULAR.ANGLE_STEP);

            // Convert to radians using constant
            const radians = angle * MATH.DEG_TO_RAD;

            // Use pre-calculated radius offset from scaledDimensions
            const radius = iconRadius + scaledDimensions.circularRadiusOffset;
            const targetX = Math.cos(radians) * radius;
            const targetY = Math.sin(radians) * radius;

            // Animate to target position with stagger
            this._animateMenuItem(circle, targetX, targetY, index);
        });

        // Adjust menu position if items would go off screen
        this._adjustMenuPositionCircular(menu, weaponContainer, iconRadius, scaledDimensions);
    }

    /**
     * Animates a menu item from center to its target position
     * @param {PIXI.Container} item - The menu item container
     * @param {number} targetX - Target X position
     * @param {number} targetY - Target Y position
     * @param {number} index - Item index for stagger delay
     * @private
     */
    _animateMenuItem(item, targetX, targetY, index) {
        // Calculate stagger delay based on index (in frames, not ms)
        const staggerFrames = (index * ECT_MENU.ANIMATION.STAGGER_DELAY) / (1000 / 60); // Convert ms to frames at 60fps
        
        // Track animation state
        let frameCount = 0;
        let animationStarted = false;
        const duration = ECT_MENU.ANIMATION.DURATION;
        let startTime = null;
        
        // Create ticker function
        const tickerFn = (delta) => {
            frameCount += delta;
            
            // Wait for stagger delay
            if (!animationStarted && frameCount >= staggerFrames) {
                animationStarted = true;
                startTime = Date.now();
            }
            
            // Perform animation after stagger delay
            if (animationStarted) {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Apply easeOutBack easing (overshoots slightly then settles)
                const eased = this._easeOutBack(progress);
                
                // Update position
                item.x = targetX * eased;
                item.y = targetY * eased;
                
                // Update scale and alpha
                item.scale.set(ECT_MENU.ANIMATION.INITIAL_SCALE +
                             (ECT_MENU.ANIMATION.FINAL_SCALE - ECT_MENU.ANIMATION.INITIAL_SCALE) * eased);
                item.alpha = eased;
                
                // Remove ticker when animation completes
                if (progress >= 1) {
                    canvas.app.ticker.remove(tickerFn);
                }
            }
        };
        
        // Add ticker to PIXI application ticker
        if (canvas?.app?.ticker) {
            canvas.app.ticker.add(tickerFn);
            
            // Store ticker reference for cleanup
            if (!this._animationTickers) {
                this._animationTickers = [];
            }
            this._animationTickers.push(tickerFn);
        } else {
            // Fallback: immediate positioning if ticker not available
            item.x = targetX;
            item.y = targetY;
            item.scale.set(ECT_MENU.ANIMATION.FINAL_SCALE);
            item.alpha = 1;
        }
    }

    /**
     * EaseOutBack easing function - overshoots then settles
     * @param {number} t - Progress (0-1)
     * @returns {number} Eased value
     * @private
     */
    _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
     * @param {Object} scaledDimensions - Scaled dimension values
     * @returns {PIXI.Container|null} The menu item container or null if invalid
     * @private
     */
    _createMenuItem(option, context, scaledDimensions) {
        const iconPath = this._resolveIconPath(option, context);

        // Only create circle if we have an icon
        if (!iconPath) {
            return null;
        }

        const container = new PIXI.Container();

        // Create circle border with scaled dimensions
        const circle = new PIXI.Graphics();
        circle.lineStyle(scaledDimensions.circleBorderWidth, ECT_MENU.CIRCLE_BORDER_COLOR);
        circle.drawCircle(0, 0, scaledDimensions.circleRadius);
        container.addChild(circle);

        // Create icon sprite (with caching) - use existence checks instead of try-catch
        // Check texture cache first
        let iconTexture = this._textureCache.get(iconPath);
        if (!iconTexture) {
            // Limit cache size - simple FIFO eviction
            if (this._textureCache.size >= ECT_MENU.MAX_TEXTURE_CACHE_SIZE) {
                const firstKey = this._textureCache.keys().next().value;
                this._textureCache.delete(firstKey);
            }
            
            // Check if texture can be created (validate path exists)
            const textureLoader = PIXI.Assets || PIXI.Loader?.shared;
            if (!textureLoader) {
                debugWarn(`PIXI texture loader not available for icon: ${option.name}`);
                return null;
            }
            
            iconTexture = PIXI.Texture.from(iconPath);
            this._textureCache.set(iconPath, iconTexture);
        }

        // Check if texture is valid before creating sprite
        if (!iconTexture || iconTexture === PIXI.Texture.EMPTY || iconTexture === PIXI.Texture.WHITE) {
            debugWarn(`Invalid texture for icon: ${option.name} at path: ${iconPath}`);
            return null;
        }

        const icon = new PIXI.Sprite(iconTexture);

        // Size and position icon within circle using scaled dimensions
        icon.width = scaledDimensions.iconSize;
        icon.height = scaledDimensions.iconSize;
        icon.x = -(scaledDimensions.iconSize / 2);
        icon.y = -(scaledDimensions.iconSize / 2);

        // Create circular mask for the icon with scaled radius
        const iconMask = new PIXI.Graphics();
        iconMask.beginFill(0xffffff);
        iconMask.drawCircle(0, 0, scaledDimensions.iconMaskRadius);
        iconMask.endFill();

        // Apply mask to icon
        icon.mask = iconMask;

        // Add mask and icon to container
        container.addChild(iconMask);
        container.addChild(icon);

        // Make container interactive
        container.interactive = true;
        container.eventMode = 'static';
        container.cursor = 'pointer';

        // Set hit area to circle with scaled radius
        container.hitArea = new PIXI.Circle(0, 0, scaledDimensions.circleRadius);

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
                // CLAUDE.md: "Operations on external modules that might not be installed"
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
     * @param {Object} scaledDimensions - Scaled dimension values
     * @private
     */
    _adjustMenuPosition(menu, menuWidth, menuHeight, weaponContainer, iconRadius, scaledDimensions) {
        const menuBounds = {
            left: menu.x - scaledDimensions.circleRadius,
            right: menu.x + scaledDimensions.circleRadius,
            top: menu.y - scaledDimensions.circleRadius,
            bottom: menu.y + menuHeight - scaledDimensions.circleRadius
        };

        const canvasBounds = canvas.dimensions.rect;

        // Check right edge
        if (menuBounds.right > canvasBounds.right) {
            // Position to left of icon instead
            const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
            const localPos = canvas.tokens.toLocal(globalPos);
            menu.x = localPos.x - iconRadius - menuWidth - scaledDimensions.positionOffset;
        }

        // Check bottom edge
        if (menuBounds.bottom > canvasBounds.bottom) {
            menu.y = canvasBounds.bottom - menuHeight - scaledDimensions.edgePadding;
        }

        // Check top edge
        if (menuBounds.top < canvasBounds.top) {
            menu.y = canvasBounds.top + scaledDimensions.edgePadding;
        }
    }

    /**
     * Adjusts circular menu position to keep all items on screen
     * @param {PIXI.Container} menu - The menu container
     * @param {PIXI.Container} weaponContainer - The weapon icon container
     * @param {number} iconRadius - Icon radius
     * @param {Object} scaledDimensions - Scaled dimension values
     * @private
     */
    _adjustMenuPositionCircular(menu, weaponContainer, iconRadius, scaledDimensions) {
        const canvasBounds = canvas.dimensions.rect;
        // Use the pre-calculated radius offset from scaledDimensions
        const radius = iconRadius + scaledDimensions.circularRadiusOffset;

        // Get the bounds of all children to find actual menu bounds
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        menu.children.forEach(child => {
            const childBounds = {
                left: menu.x + child.x - scaledDimensions.circleRadius,
                right: menu.x + child.x + scaledDimensions.circleRadius,
                top: menu.y + child.y - scaledDimensions.circleRadius,
                bottom: menu.y + child.y + scaledDimensions.circleRadius
            };

            minX = Math.min(minX, childBounds.left);
            maxX = Math.max(maxX, childBounds.right);
            minY = Math.min(minY, childBounds.top);
            maxY = Math.max(maxY, childBounds.bottom);
        });

        // Calculate needed adjustments
        let adjustX = 0, adjustY = 0;

        // Check edges and adjust
        if (minX < canvasBounds.left) {
            adjustX = canvasBounds.left - minX + scaledDimensions.edgePadding;
        } else if (maxX > canvasBounds.right) {
            adjustX = canvasBounds.right - maxX - scaledDimensions.edgePadding;
        }

        if (minY < canvasBounds.top) {
            adjustY = canvasBounds.top - minY + scaledDimensions.edgePadding;
        } else if (maxY > canvasBounds.bottom) {
            adjustY = canvasBounds.bottom - maxY - scaledDimensions.edgePadding;
        }

        // Apply adjustments
        if (adjustX !== 0 || adjustY !== 0) {
            menu.x += adjustX;
            menu.y += adjustY;
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
            // Simplified token detection using canvas.tokens.placeables
            let isTokenClick = false;
            
            // Get the event's global position
            const globalPos = event.data?.global;
            if (globalPos && canvas?.tokens?.placeables) {
                // Check if click position intersects with any token
                for (const token of canvas.tokens.placeables) {
                    if (token.mesh && token.mesh.containsPoint) {
                        // Use token's mesh contains point if available (v13+)
                        if (token.mesh.containsPoint(globalPos)) {
                            isTokenClick = true;
                            break;
                        }
                    } else if (token.bounds) {
                        // Fallback to bounds check
                        if (token.bounds.contains(globalPos.x, globalPos.y)) {
                            isTokenClick = true;
                            break;
                        }
                    }
                }
            }
            
            // Also check if the direct target is a token (for immediate detection)
            if (!isTokenClick && event.target instanceof foundry.canvas.placeables.Token) {
                isTokenClick = true;
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
        if (!this._currentMenuContainer && !this._blurredContainers && !this._clickHandler && !this._keyHandler && !this._tokenClickHandler && !this._animationTickers) {
            return;
        }
        
        // Clean up animation tickers
        if (this._animationTickers && canvas?.app?.ticker) {
            this._animationTickers.forEach(ticker => {
                canvas.app.ticker.remove(ticker);
            });
            this._animationTickers = [];
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
        // Clear any animation tickers
        if (this._animationTickers && canvas?.app?.ticker) {
            this._animationTickers.forEach(ticker => {
                canvas.app.ticker.remove(ticker);
            });
            this._animationTickers = [];
        }
        
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