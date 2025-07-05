/**
 * @file Weapon menu builder utility
 * @description Consolidates menu building logic to eliminate duplication between create and rebuild operations
 */

import { debug, debugWarn } from "./debug.js";
import { COLORS, SIZES, UI, EQUIP_STATUS, POWER_STATUS, UI_ANIMATION, BADGE, EXPAND_BUTTON, GRAPHICS, MATH, CONTAINER, HEX_COLOR } from "./constants.js";
import { getWeaponMenuIconScale, getWeaponMenuItemsPerRow, getEquipmentBadgeColor, getEquipmentBadgeBgColor } from "../settings/settings.js";
import { getEquipmentStateColor } from "./weaponMenuDisplay.js";

/**
 * Builds PIXI menu structures for weapon menus
 * Eliminates duplication between initial creation and updates
 */
export class WeaponMenuBuilder {
    constructor() {
        this.baseIconSize = 0;
        this.iconRadius = 0;
        this.spriteSize = 0;
        this.fontSize = 0;
        this.itemsPerRow = 4;
    }

    /**
     * Builds or rebuilds the menu content
     * @param {PIXI.Container} container - The container to build in
     * @param {Array} weapons - Array of weapon/power items
     * @param {Map} expandButtons - Map to store expand button references
     * @param {Object} options - Build options
     * @returns {Object} Built elements { weaponContainers, background }
     */
    buildMenu(container, weapons, expandButtons, options = {}) {
        // Validate inputs
        if (!container || !canvas?.grid?.size) {
            debugWarn('Invalid container or canvas for menu build');
            return { weaponContainers: [], background: null };
        }

        // Clear existing content
        this._clearContainer(container);

        // Calculate sizes
        this._calculateSizes();

        // Parse weapon sections
        const { sections, expandButtonItems } = this._parseWeaponSections(weapons);

        // Calculate menu dimensions
        const dimensions = this._calculateMenuDimensions(sections, expandButtonItems);

        // Create background
        const background = this._createBackground(dimensions.width, dimensions.height);
        container.addChild(background);

        // Build menu content
        const weaponContainers = [];
        let yOffset = 0;
        let expandButtonIndex = 0;

        // Build each section
        sections.forEach((section, sectionIndex) => {
            if (section.length === 0) return;

            // Create weapon icons
            section.forEach((weapon, i) => {
                const weaponContainer = this._createWeaponIcon(
                    weapon, i, section.length, dimensions.width, yOffset, options
                );
                container.addChild(weaponContainer);
                weaponContainers.push(weaponContainer);
            });

            // Update y offset
            const sectionRows = Math.ceil(section.length / this.itemsPerRow);
            yOffset += sectionRows * this.baseIconSize;

            // Add expand button if applicable
            const expandButton = this._shouldAddExpandButton(
                section, expandButtonItems, expandButtonIndex
            );
            
            if (expandButton) {
                const buttonContainer = this._createExpandButton(
                    expandButton, dimensions.width, yOffset, sectionRows, options
                );
                container.addChild(buttonContainer);
                expandButtons.set(expandButton.section, buttonContainer);
                expandButtonIndex++;
            }

            // Add separator if not last section
            if (sectionIndex < sections.length - 1) {
                const separator = this._createSeparator(dimensions.width, yOffset);
                container.addChild(separator);
                yOffset += this.baseIconSize * SIZES.SEPARATOR_HEIGHT_RATIO;
            }
        });

        // Handle remaining expand buttons
        while (expandButtonIndex < expandButtonItems.length) {
            const expandButton = expandButtonItems[expandButtonIndex];
            const buttonContainer = this._createRemainingExpandButton(
                expandButton, dimensions.width, yOffset, options
            );
            container.addChild(buttonContainer);
            expandButtons.set(expandButton.section, buttonContainer);
            expandButtonIndex++;
        }

        debug(`Menu built with ${weaponContainers.length} items`);
        return { weaponContainers, background };
    }

    /**
     * Clears all content from a container
     * @param {PIXI.Container} container
     * @private
     */
    _clearContainer(container) {
        while (container.children.length > 0) {
            const child = container.children[CONTAINER.FIRST_CHILD_INDEX];
            if (child && !child.destroyed) {
                if (child.removeAllListeners) {
                    child.removeAllListeners();
                }
                container.removeChild(child);
                if (child.destroy) {
                    child.destroy();
                }
            }
        }
    }

    /**
     * Calculates icon sizes based on grid and settings
     * @private
     */
    _calculateSizes() {
        const gridSize = canvas.grid.size;
        const iconScale = getWeaponMenuIconScale();
        this.baseIconSize = gridSize * iconScale;
        this.iconRadius = this.baseIconSize * SIZES.ICON_RADIUS_RATIO;
        this.spriteSize = this.baseIconSize * SIZES.SPRITE_SIZE_RATIO;
        this.fontSize = this.baseIconSize * SIZES.FONT_SIZE_RATIO;
        this.itemsPerRow = getWeaponMenuItemsPerRow();
    }

    /**
     * Parses weapons array into sections and expand buttons
     * @param {Array} weapons
     * @returns {Object} { sections, expandButtonItems }
     * @private
     */
    _parseWeaponSections(weapons) {
        const sections = [];
        const expandButtonItems = [];
        let current = [];

        for (const w of weapons) {
            if (w.type === "separator") {
                if (current.length > 0) {
                    sections.push(current);
                    current = [];
                }
            } else if (w.type === "expandButton") {
                expandButtonItems.push(w);
            } else {
                current.push(w);
            }
        }

        if (current.length > 0) {
            sections.push(current);
        }

        return { sections, expandButtonItems };
    }

    /**
     * Calculates menu dimensions
     * @param {Array} sections
     * @param {Array} expandButtonItems
     * @returns {Object} { width, height }
     * @private
     */
    _calculateMenuDimensions(sections, expandButtonItems) {
        const rows = sections.map(sec => Math.ceil(sec.length / this.itemsPerRow));
        const sepCount = Math.max(0, sections.length - 1);
        const sepHeight = this.baseIconSize * SIZES.SEPARATOR_HEIGHT_RATIO;
        const menuHeight = rows.reduce((sum, r) => sum + (r * this.baseIconSize), 0) + (sepCount * sepHeight);
        
        const widths = sections.map(sec => Math.min(sec.length, this.itemsPerRow) * this.baseIconSize);
        const expandButtonSpace = expandButtonItems.length > 0 ? this.baseIconSize * EXPAND_BUTTON.SPACE_RATIO : 0;
        const menuWidth = Math.max(...widths, this.baseIconSize) + expandButtonSpace;

        return { width: menuWidth, height: menuHeight };
    }

    /**
     * Creates the menu background
     * @param {number} width
     * @param {number} height
     * @returns {PIXI.Graphics}
     * @private
     */
    _createBackground(width, height) {
        const background = new PIXI.Graphics();
        background.beginFill(COLORS.MENU_BACKGROUND, COLORS.MENU_BACKGROUND_ALPHA);
        background.lineStyle(GRAPHICS.DEFAULT_LINE_WIDTH, COLORS.MENU_BORDER);
        background.drawRoundedRect(-width/MATH.CENTER_DIVISOR, 0, width, height, UI.MENU_CORNER_RADIUS);
        background.endFill();
        return background;
    }

    /**
     * Creates a weapon icon container
     * @param {Object} weapon
     * @param {number} indexInSection
     * @param {number} totalInSection
     * @param {number} menuWidth
     * @param {number} yOffset
     * @param {Object} options
     * @returns {PIXI.Container}
     * @private
     */
    _createWeaponIcon(weapon, indexInSection, totalInSection, menuWidth, yOffset, options) {
        const row = Math.floor(indexInSection / this.itemsPerRow);
        const col = indexInSection % this.itemsPerRow;
        const startX = -menuWidth / MATH.CENTER_DIVISOR;
        const x = startX + (col * this.baseIconSize) + (this.baseIconSize / MATH.CENTER_DIVISOR);
        const y = (row * this.baseIconSize) + (this.baseIconSize / MATH.CENTER_DIVISOR) + yOffset;

        const weaponContainer = new PIXI.Container();
        weaponContainer.x = x;
        weaponContainer.y = y;
        weaponContainer.interactive = true;
        weaponContainer.eventMode = 'static';
        weaponContainer.cursor = 'pointer';
        weaponContainer.weapon = weapon;

        // Create icon background
        const iconBg = this._createIconBackground(weapon, options.itemMetadata);
        weaponContainer.addChild(iconBg);

        // Load sprite or create fallback
        this._loadWeaponSprite(weapon, weaponContainer, options.itemMetadata);
        
        // Add equipment status badge if in equipment mode and it's a weapon
        // Store badge info for later addition after sprite loads
        if (options.itemMetadata) {
            const metadata = options.itemMetadata.get(weapon.id);
            
            // Handle weapon badges
            if (weapon.type === "weapon" && metadata?.showBadge && metadata?.equipStatus !== undefined) {
                weaponContainer._badgeInfo = {
                    type: 'weapon',
                    weapon: weapon,
                    equipStatus: metadata.equipStatus,
                    iconRadius: this.iconRadius
                };
            }
            // Handle power badges
            else if (weapon.type === "power" && metadata?.showPowerBadge) {
                weaponContainer._badgeInfo = {
                    type: 'power',
                    power: weapon,
                    isFavorited: metadata.isFavorited,
                    iconRadius: this.iconRadius
                };
            }
        }

        return weaponContainer;
    }

    /**
     * Creates icon background graphics
     * @param {Object} weapon
     * @param {Map} itemMetadata
     * @returns {PIXI.Graphics}
     * @private
     */
    _createIconBackground(weapon, itemMetadata) {
        const iconBg = new PIXI.Graphics();
        const metadata = itemMetadata?.get(weapon.id);
        const isCarriedOrUnfavorited = metadata?.isCarried || metadata?.isUnfavorited || metadata?.isStored;

        const bgColor = isCarriedOrUnfavorited ? COLORS.CARRIED_BACKGROUND :
                       (weapon.type === "power" ? COLORS.POWER_BACKGROUND : COLORS.WEAPON_BACKGROUND);
        const borderColor = isCarriedOrUnfavorited ? COLORS.CARRIED_BORDER : 
                          (weapon.type === "power" ? COLORS.POWER_BORDER : COLORS.WEAPON_BORDER);

        iconBg.beginFill(bgColor);
        iconBg.lineStyle(GRAPHICS.DEFAULT_LINE_WIDTH, borderColor);
        iconBg.drawRoundedRect(-this.iconRadius, -this.iconRadius, 
                               this.iconRadius * MATH.DIMENSION_MULTIPLIER, this.iconRadius * MATH.DIMENSION_MULTIPLIER, 
                               UI.ICON_CORNER_RADIUS);
        iconBg.endFill();

        // Store reference for hover effects
        iconBg.name = 'background';
        
        return iconBg;
    }

    /**
     * Loads weapon sprite or creates fallback
     * @param {Object} weapon
     * @param {PIXI.Container} container
     * @param {Map} itemMetadata
     * @private
     */
    _loadWeaponSprite(weapon, container, itemMetadata) {
        if (!weapon.img) {
            this._createFallbackText(weapon, container);
            
            // Add badge for items with no image
            if (container._badgeInfo) {
                const badge = container._badgeInfo.type === 'power' ?
                    this._createPowerStatusBadge(
                        container._badgeInfo.isFavorited,
                        container._badgeInfo.iconRadius,
                        container._badgeInfo.power
                    ) :
                    this._createEquipStatusBadge(
                        container._badgeInfo.equipStatus, 
                        container._badgeInfo.iconRadius,
                        container._badgeInfo.weapon
                    );
                container.addChild(badge);
                delete container._badgeInfo;  // Clean up
            }
            return;
        }

        PIXI.Texture.fromURL(weapon.img).then(texture => {
            const sprite = new PIXI.Sprite(texture);
            sprite.width = this.spriteSize;
            sprite.height = this.spriteSize;
            sprite.anchor.set(GRAPHICS.CENTER_ANCHOR);

            // Create mask
            const spriteMask = new PIXI.Graphics();
            spriteMask.beginFill(COLORS.SPRITE_MASK);
            spriteMask.drawRoundedRect(-this.spriteSize/MATH.CENTER_DIVISOR, -this.spriteSize/MATH.CENTER_DIVISOR, 
                                       this.spriteSize, this.spriteSize, 
                                       UI.ICON_CORNER_RADIUS);
            spriteMask.endFill();
            sprite.mask = spriteMask;

            // Apply transparency for carried/unfavorited items
            const metadata = itemMetadata?.get(weapon.id);
            if (metadata?.isCarried || metadata?.isUnfavorited || metadata?.isStored) {
                sprite.alpha = UI_ANIMATION.CARRIED_SPRITE_ALPHA;
            }

            container.addChild(spriteMask);
            container.addChild(sprite);
            
            // Add badge after sprite is loaded (if needed)
            if (container._badgeInfo) {
                const badge = container._badgeInfo.type === 'power' ?
                    this._createPowerStatusBadge(
                        container._badgeInfo.isFavorited,
                        container._badgeInfo.iconRadius,
                        container._badgeInfo.power
                    ) :
                    this._createEquipStatusBadge(
                        container._badgeInfo.equipStatus, 
                        container._badgeInfo.iconRadius,
                        container._badgeInfo.weapon
                    );
                container.addChild(badge);
                delete container._badgeInfo;  // Clean up
            }
        }).catch(error => {
            debugWarn(`Failed to load weapon texture for ${weapon.name}:`, error);
            this._createFallbackText(weapon, container);
            
            // Add badge even on fallback
            if (container._badgeInfo) {
                const badge = container._badgeInfo.type === 'power' ?
                    this._createPowerStatusBadge(
                        container._badgeInfo.isFavorited,
                        container._badgeInfo.iconRadius,
                        container._badgeInfo.power
                    ) :
                    this._createEquipStatusBadge(
                        container._badgeInfo.equipStatus, 
                        container._badgeInfo.iconRadius,
                        container._badgeInfo.weapon
                    );
                container.addChild(badge);
                delete container._badgeInfo;  // Clean up
            }
        });
    }

    /**
     * Creates an equipment status badge for weapons
     * @param {number} equipStatus - The equipment status value
     * @param {number} iconRadius - The icon radius for sizing
     * @param {Object} weapon - The weapon item
     * @returns {PIXI.Container} The badge container
     * @private
     */
    _createEquipStatusBadge(equipStatus, iconRadius, weapon) {
        const badge = new PIXI.Container();
        const badgeRadius = iconRadius * BADGE.SIZE_RATIO;
        
        // Position badge at top-right corner (overlapping icon edge)
        badge.x = iconRadius - badgeRadius * BADGE.POSITION_OFFSET_RATIO;  // Closer to edge, but not overlapping menu
        badge.y = -iconRadius + badgeRadius * BADGE.POSITION_OFFSET_RATIO;
        
        // Get user-selected background color
        const bgColor = getEquipmentBadgeBgColor();
        const bgTint = parseInt(bgColor.replace("#", ""), MATH.HEX_PARSE_BASE);
        
        // Create circular background
        const bg = new PIXI.Graphics();
        bg.beginFill(bgTint, BADGE.BG_ALPHA);
        const circleRadius = badgeRadius * BADGE.CIRCLE_SIZE_MULTIPLIER;
        bg.drawCircle(0, 0, circleRadius);
        bg.endFill();
        badge.addChild(bg);
        
        // Load icon as sprite
        const iconPath = EQUIP_STATUS.ICON_PATHS[equipStatus];
        if (iconPath) {
            const iconTexture = PIXI.Texture.from(iconPath);
            const icon = new PIXI.Sprite(iconTexture);
            
            // Make icon larger without background
            const iconSize = badgeRadius * BADGE.ICON_SIZE_MULTIPLIER;  // Increased size for better visibility
            icon.width = iconSize;
            icon.height = iconSize;
            icon.anchor.set(GRAPHICS.CENTER_ANCHOR);
            
            // Check for state-based coloring first
            let badgeColor = null;
            if (weapon) {
                badgeColor = getEquipmentStateColor(weapon);
            }
            
            // Fall back to default badge color if no state color
            if (!badgeColor) {
                badgeColor = getEquipmentBadgeColor();
            }
            
            // Apply color tint
            if (badgeColor) {
                const tintValue = parseInt(badgeColor.replace("#", ""), MATH.HEX_PARSE_BASE);
                icon.tint = tintValue;
                debug("Applied equipment badge tint", { color: badgeColor, tint: tintValue, isStateColor: !!weapon });
            }
            
            badge.addChild(icon);
        } else {
            // Fallback to text if no icon available
            const fallback = new PIXI.Text('?', {
                fontFamily: 'Arial',
                fontSize: badgeRadius * BADGE.TEXT_SIZE_MULTIPLIER,
                fill: EQUIP_STATUS.BADGE.ICON_COLOR,
                fontWeight: 'bold'
            });
            fallback.anchor.set(GRAPHICS.CENTER_ANCHOR);
            badge.addChild(fallback);
        }
        
        return badge;
    }

    /**
     * Creates a favorite status badge for powers
     * @param {boolean} isFavorited - Whether the power is favorited
     * @param {number} iconRadius - Radius of the weapon icon for positioning
     * @param {Object} power - The power item
     * @returns {PIXI.Container} The badge container
     */
    _createPowerStatusBadge(isFavorited, iconRadius, power) {
        const badge = new PIXI.Container();
        const badgeRadius = iconRadius * BADGE.SIZE_RATIO;
        
        // Position badge at top-right corner (overlapping icon edge)
        badge.x = iconRadius - badgeRadius * BADGE.POSITION_OFFSET_RATIO;  // Closer to edge, but not overlapping menu
        badge.y = -iconRadius + badgeRadius * BADGE.POSITION_OFFSET_RATIO;
        
        // Get user-selected background color
        const bgColor = getEquipmentBadgeBgColor();
        const bgTint = parseInt(bgColor.replace("#", ""), MATH.HEX_PARSE_BASE);
        
        // Create circular background
        const bg = new PIXI.Graphics();
        bg.beginFill(bgTint, BADGE.BG_ALPHA);
        const circleRadius = badgeRadius * BADGE.CIRCLE_SIZE_MULTIPLIER;
        bg.drawCircle(0, 0, circleRadius);
        bg.endFill();
        badge.addChild(bg);
        
        // Load star icon as sprite
        const iconPath = isFavorited ? 
            POWER_STATUS.ICON_PATHS.FAVORITED : 
            POWER_STATUS.ICON_PATHS.UNFAVORITED;
            
        if (iconPath) {
            const iconTexture = PIXI.Texture.from(iconPath);
            const icon = new PIXI.Sprite(iconTexture);
            
            // Make icon larger without background (same as equipment badges)
            const iconSize = badgeRadius * BADGE.ICON_SIZE_MULTIPLIER;  // Increased size for better visibility
            icon.width = iconSize;
            icon.height = iconSize;
            icon.anchor.set(GRAPHICS.CENTER_ANCHOR);
            
            // Check for state-based coloring first
            let badgeColor = null;
            if (power) {
                badgeColor = getEquipmentStateColor(power);
            }
            
            // Fall back to default badge color if no state color
            if (!badgeColor) {
                badgeColor = getEquipmentBadgeColor();
            }
            
            // Apply color tint
            if (badgeColor) {
                const tintValue = parseInt(badgeColor.replace("#", ""), MATH.HEX_PARSE_BASE);
                icon.tint = tintValue;
                debug("Applied power badge tint", { color: badgeColor, tint: tintValue, isStateColor: !!power });
            }
            
            badge.addChild(icon);
        } else {
            // Fallback to text if no icon available
            const fallback = new PIXI.Text(isFavorited ? '★' : '☆', {
                fontFamily: 'Arial',
                fontSize: badgeRadius * BADGE.TEXT_SIZE_MULTIPLIER,
                fill: POWER_STATUS.BADGE.ICON_COLOR,
                fontWeight: 'bold'
            });
            fallback.anchor.set(GRAPHICS.CENTER_ANCHOR);
            badge.addChild(fallback);
        }
        
        return badge;
    }

    _createFallbackText(weapon, container) {
        const fallbackText = new PIXI.Text(weapon.name.charAt(0), {
            fontSize: this.fontSize,
            fill: COLORS.TEXT_FILL,
            align: 'center'
        });
        fallbackText.anchor.set(GRAPHICS.CENTER_ANCHOR);
        container.addChild(fallbackText);
    }

    /**
     * Checks if expand button should be added for section
     * @param {Array} section
     * @param {Array} expandButtonItems
     * @param {number} expandButtonIndex
     * @returns {Object|null}
     * @private
     */
    _shouldAddExpandButton(section, expandButtonItems, expandButtonIndex) {
        if (expandButtonIndex >= expandButtonItems.length) return null;

        const expandButton = expandButtonItems[expandButtonIndex];
        const sectionType = section[0]?.type;
        const buttonBelongsToSection = 
            (sectionType === "weapon" && expandButton.section === "weapons") ||
            (sectionType === "power" && expandButton.section === "powers");

        return buttonBelongsToSection ? expandButton : null;
    }

    /**
     * Creates an expand button
     * @param {Object} expandButton
     * @param {number} menuWidth
     * @param {number} yOffset
     * @param {number} sectionRows
     * @param {Object} options
     * @returns {PIXI.Container}
     * @private
     */
    _createExpandButton(expandButton, menuWidth, yOffset, sectionRows, options) {
        const container = this._createExpandButtonBase(expandButton);
        
        // Position on the right side
        container.x = menuWidth / MATH.CENTER_DIVISOR - this.baseIconSize * EXPAND_BUTTON.X_OFFSET_RATIO;
        const lastRowIndex = sectionRows - 1;
        const currentSectionYOffset = yOffset - (sectionRows * this.baseIconSize);
        container.y = currentSectionYOffset + (lastRowIndex * this.baseIconSize) + (this.baseIconSize / MATH.CENTER_DIVISOR);

        return container;
    }

    /**
     * Creates remaining expand button
     * @param {Object} expandButton
     * @param {number} menuWidth
     * @param {number} yOffset
     * @param {Object} options
     * @returns {PIXI.Container}
     * @private
     */
    _createRemainingExpandButton(expandButton, menuWidth, yOffset, options) {
        const container = this._createExpandButtonBase(expandButton);
        container.x = menuWidth / MATH.CENTER_DIVISOR - this.baseIconSize * EXPAND_BUTTON.X_OFFSET_RATIO;
        container.y = yOffset - this.baseIconSize / MATH.CENTER_DIVISOR;
        return container;
    }

    /**
     * Creates base expand button container
     * @param {Object} expandButton
     * @returns {PIXI.Container}
     * @private
     */
    _createExpandButtonBase(expandButton) {
        const container = new PIXI.Container();
        container.name = `expand-button-${expandButton.section}`;
        container.interactive = true;
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.buttonSection = expandButton.section;
        container.isExpanded = expandButton.expanded;

        // Draw pipe
        const pipe = new PIXI.Graphics();
        const pipeHeight = this.baseIconSize * EXPAND_BUTTON.HEIGHT_RATIO;
        const pipeWidth = EXPAND_BUTTON.PIPE_WIDTH;
        const pipeAlpha = expandButton.expanded ? UI_ANIMATION.EXPAND_BUTTON.NORMAL_ALPHA_EXPANDED : UI_ANIMATION.EXPAND_BUTTON.NORMAL_ALPHA_COLLAPSED;

        pipe.beginFill(COLORS.EXPAND_BUTTON_TEXT, pipeAlpha);
        pipe.drawRect(-pipeWidth/MATH.CENTER_DIVISOR, -pipeHeight/MATH.CENTER_DIVISOR, pipeWidth, pipeHeight);
        pipe.endFill();
        container.addChild(pipe);
        container.buttonGraphics = pipe;

        // Add hit area
        const hitArea = new PIXI.Graphics();
        hitArea.beginFill(HEX_COLOR.WHITE, EXPAND_BUTTON.HIT_AREA_ALPHA);
        hitArea.drawRect(-this.baseIconSize * EXPAND_BUTTON.HIT_AREA_SIZE_RATIO, -this.baseIconSize * EXPAND_BUTTON.HIT_AREA_SIZE_RATIO, 
                         this.baseIconSize * EXPAND_BUTTON.HIT_AREA_SIZE_RATIO * MATH.DIMENSION_MULTIPLIER, this.baseIconSize * EXPAND_BUTTON.HIT_AREA_SIZE_RATIO * MATH.DIMENSION_MULTIPLIER);
        hitArea.endFill();
        container.addChild(hitArea);

        return container;
    }

    /**
     * Creates a separator line
     * @param {number} menuWidth
     * @param {number} yPosition
     * @returns {PIXI.Container}
     * @private
     */
    _createSeparator(menuWidth, yPosition) {
        const separatorContainer = new PIXI.Container();
        separatorContainer.x = 0;
        separatorContainer.y = yPosition;

        const separatorLine = new PIXI.Graphics();
        const separatorHeight = this.baseIconSize * SIZES.SEPARATOR_HEIGHT_RATIO;
        
        separatorLine.lineStyle(GRAPHICS.DEFAULT_LINE_WIDTH, COLORS.SEPARATOR_LINE, COLORS.SEPARATOR_LINE_ALPHA);
        separatorLine.moveTo(-menuWidth/MATH.CENTER_DIVISOR + UI.SEPARATOR_MARGIN, separatorHeight / MATH.CENTER_DIVISOR);
        separatorLine.lineTo(menuWidth/MATH.CENTER_DIVISOR - UI.SEPARATOR_MARGIN, separatorHeight / MATH.CENTER_DIVISOR);
        separatorContainer.addChild(separatorLine);

        return separatorContainer;
    }
}