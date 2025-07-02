import { getWeaponMenuIconScale, getWeaponMenuItemsPerRow, shouldShowDetailedTooltips } from "../settings/settings.js";
import { handleWeaponSelection, handleWeaponEdit } from "../utils/weaponHandlers.js";
import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { tickerDelay, timestamps } from "../utils/timingUtils.js";
import { TIMING, SIZES, COLORS, UI, Z_INDEX } from "../utils/constants.js";
import { WeaponMenuStateMachine, OperationQueue, ContainerVerification } from "../utils/weaponMenuState.js";
import { debug, debugWarn, debugError } from "../utils/debug.js";

/**
 * PIXI-based weapon menu for canvas rendering
 * This is not an HTML Application - it renders directly on the canvas using PIXI
 */
export class WeaponMenuApplication {
    constructor(token, weapons, options = {}) {
        this.token = token;
        this.weapons = weapons;
        this.options = options;
        this.container = null;
        this.weaponContainers = [];
        this.clickOutsideHandler = null;
        this.rightClickHandler = null;
        this.keyHandler = null;
        this.contextMenuHandler = null;
        this._currentTooltipUpdate = null;
        
        // Extract metadata from options
        this.itemMetadata = options.metadata || new Map();
        
        // Expansion state
        this.expandedSections = {
            weapons: false,
            powers: false
        };
        
        // Equipment mode state
        this.equipmentMode = false;
        
        // Load settings if available
        if (game?.ready) {
            this.expandedSections.weapons = game.settings.get("tokencontextmenu", "expandWeaponsByDefault") ?? false;
            this.expandedSections.powers = game.settings.get("tokencontextmenu", "expandPowersByDefault") ?? false;
        }
        
        // Store expand button references
        this.expandButtons = new Map();
        
        // State management
        this.stateMachine = new WeaponMenuStateMachine();
        this.operationQueue = new OperationQueue();
        
        // Listen to state changes for debugging
        this.stateMachine.onStateChange((from, to) => {
            debug(`Weapon menu state: ${from} -> ${to}`);
        });
    }

    get rendered() {
        return this.stateMachine.isActive();
    }

    /**
     * Render the weapon menu on the canvas
     * @param {boolean} force - Force re-render
     * @param {Object} options - Render options
     * @returns {Promise<WeaponMenuApplication>} This application instance
     */
    async render(force = false, options = {}) {
        // Queue the render operation to prevent race conditions
        return this.operationQueue.enqueue(async () => {
            // Check if we can transition to OPENING
            if (!this.stateMachine.canTransition('OPENING')) {
                debugWarn(`Cannot open weapon menu in state: ${this.stateMachine.getState()}`);
                return this;
            }
            
            // Transition to OPENING
            this.stateMachine.transition('OPENING');
            
            try {
                // Check if another menu is already open and close it
                const existingMenu = weaponSystemCoordinator.getMenuApp();
                if (existingMenu && existingMenu !== this) {
                    // If it's for the same token, don't create a new one
                    if (existingMenu.token?.id === this.token?.id) {
                        this.stateMachine.transition('CLOSED');
                        return existingMenu;
                    }
                    await existingMenu.close();
                }

                // Register with state manager
                weaponSystemCoordinator.setMenuApp(this);
                weaponSystemCoordinator.updateMenuState({
                    currentToken: this.token,
                    currentMenuApp: this
                });
                weaponSystemCoordinator.updateOpenTime();

                // Create the PIXI container
                await this._createPIXIContainer();
                
                // Verify container was created successfully
                if (!ContainerVerification.isValid(this.container)) {
                    throw new Error('Failed to create valid PIXI container');
                }
                
                // Set up event handling
                this._setupEventListeners();

                // Transition to OPEN state
                this.stateMachine.transition('OPEN');

                // Call hook after state transition
                tickerDelay.delay(() => {
                    Hooks.call('tokencontextmenu.weaponMenuRendered');
                }, TIMING.MENU_RENDER_HOOK_DELAY, 'weaponMenuRendered');

                return this;
                
            } catch (error) {
                debugError('Failed to render weapon menu', error);
                this.stateMachine.transition('ERROR');
                // Clean up on error
                this._emergencyCleanup();
                throw error;
            }
        }, 'render');
    }

    /**
     * Creates the PIXI container with weapon icons
     * Builds the visual menu structure with proper layout
     * @returns {Promise<void>}
     * @private
     */
    async _createPIXIContainer() {
        // Debug the weapons array
        debug(`Creating PIXI container with weapons:`, {
            totalItems: this.weapons.length,
            expandButtons: this.weapons.filter(w => w.type === "expandButton"),
            weapons: this.weapons.filter(w => w.type === "weapon").length,
            powers: this.weapons.filter(w => w.type === "power").length
        });
        this.container = new PIXI.Container();
        this.container.name = "tokencontextmenu-weapon-menu";

        this.container.x = this.token.x + (this.token.w / 2);
        this.container.y = this.token.y + this.token.h + UI.MENU_Y_OFFSET;

        const gridSize = canvas.grid.size;
        const iconScale = getWeaponMenuIconScale();
        const baseIconSize = gridSize * iconScale;
        const iconRadius = baseIconSize * SIZES.ICON_RADIUS_RATIO;
        const spriteSize = baseIconSize * SIZES.SPRITE_SIZE_RATIO;
        const fontSize = baseIconSize * SIZES.FONT_SIZE_RATIO;

        const background = new PIXI.Graphics();
        const itemsPerRow = getWeaponMenuItemsPerRow();

        const sections = [];
        let current = [];
        const expandButtons = [];
        
        for (const w of this.weapons) {
            if (w.type === "separator") {
                if (current.length > 0) {
                    sections.push(current);
                    current = [];
                }
            } else if (w.type === "expandButton") {
                // Store expand buttons separately
                expandButtons.push(w);
                // Don't create a new section for expand buttons
            } else {
                current.push(w);
            }
        }
        if (current.length > 0) {
            sections.push(current);
        }

        const rows = sections.map(sec => Math.ceil(sec.length / itemsPerRow));
        const sepCount = Math.max(0, sections.length - 1);
        const sepHeight = baseIconSize * SIZES.SEPARATOR_HEIGHT_RATIO;
        const menuHeight = rows.reduce((sum, r) => sum + (r * baseIconSize), 0) + (sepCount * sepHeight);
        const widths = sections.map(sec => Math.min(sec.length, itemsPerRow) * baseIconSize);
        // Add minimal space for expand button on the right if needed
        const expandButtonSpace = expandButtons.length > 0 ? baseIconSize * 0.3 : 0;
        const menuWidth = Math.max(...widths, baseIconSize) + expandButtonSpace;

        background.beginFill(COLORS.MENU_BACKGROUND, COLORS.MENU_BACKGROUND_ALPHA);
        background.lineStyle(1, COLORS.MENU_BORDER);
        background.drawRoundedRect(-menuWidth/2, 0, menuWidth, menuHeight, UI.MENU_CORNER_RADIUS);
        background.endFill();
        this.container.addChild(background);

        let yOffset = 0;
        let sectionIndex = 0;
        let expandButtonIndex = 0;

        for (const section of sections) {
            if (section.length > 0) {
                for (let i = 0; i < section.length; i++) {
                    const weapon = section[i];
                    const weaponContainer = await this._createWeaponIconWithSection(
                        weapon, i, section.length, itemsPerRow, menuWidth,
                        baseIconSize, iconRadius, spriteSize, fontSize, yOffset
                    );
                    this.container.addChild(weaponContainer);
                    this.weaponContainers.push(weaponContainer);
                }

                const sectionRows = Math.ceil(section.length / itemsPerRow);
                yOffset += sectionRows * baseIconSize;

                // Check if there's an expand button for this section
                if (expandButtonIndex < expandButtons.length) {
                    const expandButton = expandButtons[expandButtonIndex];
                    // Check if this button belongs to the current section
                    const sectionType = section[0]?.type; // Get type from first item in section
                    const buttonBelongsToSection = 
                        (sectionType === "weapon" && expandButton.section === "weapons") ||
                        (sectionType === "power" && expandButton.section === "powers");
                    
                    debug(`Checking expand button for section ${sectionIndex}:`, {
                        expandButton,
                        sectionType,
                        buttonBelongsToSection,
                        sectionItems: section.length,
                        expandButtonIndex
                    });
                    
                    if (buttonBelongsToSection) {
                        const buttonContainer = this._createExpandButton(
                            expandButton.section,
                            expandButton.expanded,
                            menuWidth,
                            yOffset - baseIconSize / 2,
                            baseIconSize
                        );
                        
                        // Position on the right side with reduced spacing
                        buttonContainer.x = menuWidth / 2 - baseIconSize * 0.2;  // Reduced from 0.3 to take less space
                        // Position on the last row of items
                        const lastRowIndex = Math.floor((section.length - 1) / itemsPerRow);
                        const currentSectionYOffset = yOffset - (sectionRows * baseIconSize);
                        buttonContainer.y = currentSectionYOffset + (lastRowIndex * baseIconSize) + (baseIconSize / 2);
                        
                        this.container.addChild(buttonContainer);
                        this.expandButtons.set(expandButton.section, buttonContainer);
                        expandButtonIndex++;
                    }
                }

                if (sectionIndex < sections.length - 1) {
                    const separatorContainer = this._createSeparator(
                        { type: "separator" }, menuWidth, yOffset, sepHeight
                    );
                    this.container.addChild(separatorContainer);
                    yOffset += sepHeight;
                }

                sectionIndex++;
            }
        }

        // Handle any remaining expand buttons (e.g., powers-only case)
        while (expandButtonIndex < expandButtons.length) {
            const expandButton = expandButtons[expandButtonIndex];
            debug(`Processing remaining expand button:`, expandButton);
            
            const buttonContainer = this._createExpandButton(
                expandButton.section,
                expandButton.expanded,
                menuWidth,
                yOffset - baseIconSize / 2,
                baseIconSize
            );
            
            // Position on the right side
            buttonContainer.x = menuWidth / 2 - baseIconSize * 0.2;
            // Position at the current yOffset
            buttonContainer.y = yOffset - baseIconSize / 2;
            
            this.container.addChild(buttonContainer);
            this.expandButtons.set(expandButton.section, buttonContainer);
            expandButtonIndex++;
        }

        canvas.tokens.addChild(this.container);
    }

    /**
     * Creates a single weapon icon container with proper positioning
     * @param {Object} weapon - The weapon/power item data
     * @param {number} indexInSection - Position within the section
     * @param {number} totalInSection - Total items in this section
     * @param {number} itemsPerRow - Max items per row
     * @param {number} menuWidth - Total menu width
     * @param {number} baseIconSize - Base icon size
     * @param {number} iconRadius - Icon background radius
     * @param {number} spriteSize - Sprite image size
     * @param {number} fontSize - Fallback text font size
     * @param {number} yOffset - Vertical offset for sections
     * @returns {Promise<PIXI.Container>} The weapon container
     * @private
     */
    async _createWeaponIconWithSection(weapon, indexInSection, totalInSection, itemsPerRow, menuWidth, baseIconSize, iconRadius, spriteSize, fontSize, yOffset = 0) {
        // Add debugging
        if (!weapon || typeof weapon !== 'object') {
            debugError(`Invalid weapon object passed to _createWeaponIconWithSection:`, weapon);
            throw new Error(`Invalid weapon object: ${weapon}`);
        }
        
        const row = Math.floor(indexInSection / itemsPerRow);
        const col = indexInSection % itemsPerRow;

        const startX = -menuWidth / 2;
        const x = startX + (col * baseIconSize) + (baseIconSize / 2);
        const y = (row * baseIconSize) + (baseIconSize / 2) + yOffset;

        const weaponContainer = new PIXI.Container();
        weaponContainer.x = x;
        weaponContainer.y = y;
        weaponContainer.interactive = true;
        weaponContainer.eventMode = 'static';  // Enable PIXI v7 event mode
        weaponContainer.cursor = 'pointer';     // Modern cursor property
        weaponContainer.weapon = weapon;

        const iconBg = new PIXI.Graphics();
        
        // Check metadata for carried/unfavorited/stored items
        const metadata = this.itemMetadata.get(weapon.id);
        const isCarriedOrUnfavorited = metadata?.isCarried || metadata?.isUnfavorited || metadata?.isStored;
        
        // Use desaturated colors for carried/unfavorited/stored items
        const bgColor = isCarriedOrUnfavorited ? COLORS.CARRIED_BACKGROUND :
                       (weapon.type === "power" ? COLORS.POWER_BACKGROUND : COLORS.WEAPON_BACKGROUND);
        const borderColor = isCarriedOrUnfavorited ? COLORS.CARRIED_BORDER : 
                          (weapon.type === "power" ? COLORS.POWER_BORDER : COLORS.WEAPON_BORDER);

        iconBg.beginFill(bgColor);
        iconBg.lineStyle(1, borderColor);
        iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * 2, iconRadius * 2, UI.ICON_CORNER_RADIUS);
        iconBg.endFill();
        weaponContainer.addChild(iconBg);

        // Check if weapon has a valid image
        if (!weapon.img) {
            debugWarn(`No image for weapon: ${weapon.name}`);
            const fallbackText = new PIXI.Text(weapon.name.charAt(0), {
                fontSize: fontSize,
                fill: COLORS.TEXT_FILL,
                align: 'center'
            });
            fallbackText.anchor.set(0.5);
            weaponContainer.addChild(fallbackText);
            this._setupWeaponEvents(weaponContainer, iconBg, iconRadius);
            return weaponContainer;
        }

        // Load weapon texture using PIXI.Texture.fromURL (Foundry v12)
        PIXI.Texture.fromURL(weapon.img).then(texture => {
            const sprite = new PIXI.Sprite(texture);
            sprite.width = spriteSize;
            sprite.height = spriteSize;
            sprite.anchor.set(0.5);

            const spriteMask = new PIXI.Graphics();
            spriteMask.beginFill(COLORS.SPRITE_MASK);
            spriteMask.drawRoundedRect(-spriteSize/2, -spriteSize/2, spriteSize, spriteSize, UI.ICON_CORNER_RADIUS);
            spriteMask.endFill();

            sprite.mask = spriteMask;
            
            // Apply transparency for carried/unfavorited items
            if (isCarriedOrUnfavorited) {
                sprite.alpha = 0.5;  // More transparent for better distinction
            }

            weaponContainer.addChild(spriteMask);
            weaponContainer.addChild(sprite);
        }).catch(error => {
            debugWarn(`Failed to load weapon texture for ${weapon.name}:`, error);
            const fallbackText = new PIXI.Text(weapon.name.charAt(0), {
                fontSize: fontSize,
                fill: COLORS.TEXT_FILL,
                align: 'center'
            });
            fallbackText.anchor.set(0.5);
            weaponContainer.addChild(fallbackText);
        });

        this._setupWeaponEvents(weaponContainer, iconBg, iconRadius);
        return weaponContainer;
    }

    /**
     * Creates a visual separator between weapon and power sections
     * @param {Object} separator - Separator object
     * @param {number} menuWidth - Menu width for line drawing
     * @param {number} yPosition - Vertical position
     * @param {number} separatorHeight - Height of separator area
     * @returns {PIXI.Container} The separator container
     * @private
     */
    _createSeparator(separator, menuWidth, yPosition, separatorHeight) {
        const separatorContainer = new PIXI.Container();
        separatorContainer.x = 0;
        separatorContainer.y = yPosition;

        const separatorLine = new PIXI.Graphics();
        separatorLine.lineStyle(1, COLORS.SEPARATOR_LINE, COLORS.SEPARATOR_LINE_ALPHA);
        separatorLine.moveTo(-menuWidth/2 + UI.SEPARATOR_MARGIN, separatorHeight / 2);
        separatorLine.lineTo(menuWidth/2 - UI.SEPARATOR_MARGIN, separatorHeight / 2);
        separatorContainer.addChild(separatorLine);

        return separatorContainer;
    }

    /**
     * Sets up interactive events for weapon icons
     * Handles hover effects, tooltips, and click actions
     * @param {PIXI.Container} weaponContainer - The weapon container
     * @param {PIXI.Graphics} iconBg - The background graphics object
     * @param {number} iconRadius - Icon background radius
     * @private
     */
    _setupWeaponEvents(weaponContainer, iconBg, iconRadius) {
        weaponContainer.on('pointerover', (event) => {
            weaponContainer.scale.set(1.1);
            iconBg.clear();

            const weapon = weaponContainer.weapon;
            const metadata = this.itemMetadata.get(weapon.id);
            const isCarriedOrUnfavorited = metadata?.isCarried || metadata?.isUnfavorited || metadata?.isStored;
            
            // Use desaturated hover colors for carried/unfavorited/stored items
            const hoverColor = isCarriedOrUnfavorited ? COLORS.CARRIED_HOVER_BACKGROUND :
                             (weapon.type === "power" ? COLORS.POWER_HOVER_BACKGROUND : COLORS.WEAPON_HOVER_BACKGROUND);
            const hoverBorder = isCarriedOrUnfavorited ? COLORS.CARRIED_HOVER_BORDER :
                              (weapon.type === "power" ? COLORS.POWER_HOVER_BORDER : COLORS.WEAPON_HOVER_BORDER);

            iconBg.beginFill(hoverColor);
            iconBg.lineStyle(1, hoverBorder);
            iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * 2, iconRadius * 2, UI.ICON_CORNER_RADIUS);
            iconBg.endFill();

            // Build tooltip content
            let tooltipContent = weapon.name;
            
            // Add status indicators
            if (metadata?.isCarried) {
                tooltipContent += " [Carried - Click to equip]";
            } else if (metadata?.isStored) {
                // Only stored template weapons are shown
                tooltipContent += " [Stored Template - Click to carry]";
            } else if (metadata?.isUnfavorited) {
                tooltipContent += " [Click to favorite]";
            }
            
            // Add ammo count if applicable
            if (weapon.type === "weapon" && weapon.system?.currentShots !== undefined && weapon.system?.shots !== undefined &&
                (weapon.system.currentShots > 0 || weapon.system.shots > 0)) {
                tooltipContent += ` (${weapon.system.currentShots}/${weapon.system.shots})`;
            }
            
            // Check if detailed tooltips are enabled - read fresh from settings
            const showDetailed = shouldShowDetailedTooltips();
            
            // Add detailed stats for both weapons and powers if setting is enabled
            if (showDetailed && weapon.system && (weapon.type === "weapon" || weapon.type === "power")) {
                // Collect stat lines
                const statLines = [];
                
                // Damage
                if (weapon.system.damage) {
                    // add damage modifier if available
                    const damageMod = (weapon.system.actions.dmgMod !== '0')? weapon.system.actions.dmgMod : '';
                    statLines.push(`🗲 Damage: ${weapon.system.damage} ${damageMod}`);
                }
                
                // Range
                if (weapon.system.range) {
                    statLines.push(`🏹︎ Range: ${weapon.system.range}`);
                }
                
                // AP - show for both weapons and powers
                if (weapon.system.ap !== undefined && weapon.system.ap !== 0) {
                    statLines.push(`⛨ AP: ${weapon.system.ap}`);
                }
                
                // Trait Modifier
                if (weapon.system.actions.traitMod) {
                    statLines.push(`⊕ Trait Mod: ${weapon.system.actions.traitMod}`);
                }
                
                // Power Points - only for powers
                if (weapon.type === "power" && weapon.system.pp !== undefined && weapon.system.pp !== 0) {
                    statLines.push(`◈ PP: ${weapon.system.pp}`);
                }
                
                // Only add stats section if we have stats to show
                if (statLines.length > 0) {
                    // Use HTML with proper line separators
                    tooltipContent = `<div class="tokencontextmenu-weapon-tooltip">
                        <div class="tooltip-header">${tooltipContent}</div>
                        <hr class="tooltip-separator">
                        ${statLines.map(line => `<div class="tooltip-stat">${line}</div>`).join('')}
                        <hr class="tooltip-separator">
                    </div>`;
                } else {
                    // For non-weapon items, keep it simple
                    tooltipContent = `<div class="tokencontextmenu-weapon-tooltip">${tooltipContent}</div>`;
                }
            } else {
                // Simple tooltip - just wrap in div for consistent styling
                tooltipContent = `<div class="tokencontextmenu-weapon-tooltip">${tooltipContent}</div>`;
            }

            this._showTooltip(tooltipContent, event);
        });

        weaponContainer.on('pointerout', () => {
            weaponContainer.scale.set(1.0);
            iconBg.clear();

            const weapon = weaponContainer.weapon;
            const metadata = this.itemMetadata.get(weapon.id);
            const isCarriedOrUnfavorited = metadata?.isCarried || metadata?.isUnfavorited || metadata?.isStored;
            
            // Use desaturated colors for carried/unfavorited/stored items
            const bgColor = isCarriedOrUnfavorited ? COLORS.CARRIED_BACKGROUND :
                           (weapon.type === "power" ? COLORS.POWER_BACKGROUND : COLORS.WEAPON_BACKGROUND);
            const borderColor = isCarriedOrUnfavorited ? COLORS.CARRIED_BORDER : 
                              (weapon.type === "power" ? COLORS.POWER_BORDER : COLORS.WEAPON_BORDER);

            iconBg.beginFill(bgColor);
            iconBg.lineStyle(1, borderColor);
            iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * 2, iconRadius * 2, UI.ICON_CORNER_RADIUS);
            iconBg.endFill();

            this._hideTooltip();
        });

        weaponContainer.on('pointerdown', async (event) => {
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }

            this._hideTooltip();

            if (event.data.button === 0) {
                await this._handleWeaponSelection(weaponContainer.weapon.id);
            } else if (event.data.button === 2) {
                await this._handleWeaponEdit(weaponContainer.weapon.id);
            }
        });

        // Add dedicated right-click handler as backup
        weaponContainer.on('rightdown', async (event) => {
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }

            this._hideTooltip();
            await this._handleWeaponEdit(weaponContainer.weapon.id);
        });
    }

    /**
     * Handle weapon selection (left-click)
     * @param {string} weaponId - The ID of the selected weapon
     * @private
     */
    async _handleWeaponSelection(weaponId) {
        const metadata = this.itemMetadata.get(weaponId);
        const weapon = this.token.actor.items.get(weaponId);
        
        // Check if we're in equipment mode
        if (this.equipmentMode && weapon?.type === "weapon") {
            // Check permissions before any modifications
            if (!this.token.actor.isOwner) {
                ui.notifications.warn("You don't have permission to modify this token");
                return;
            }
            
            const weaponName = weapon.name.toLowerCase();
            const isSpecialWeapon = weaponName.includes('unarmed attack') || weaponName.includes('claws');
            const hasTemplateAOE = weapon.system?.templates &&
                Object.values(weapon.system.templates).some(v => v === true);
            
            if (isSpecialWeapon) {
                // Special weapons (unarmed, claws) cannot be stored
                debug(`Special weapon in equipment mode: ${weapon.name}, current status: ${weapon.system.equipStatus}`);
                if (weapon.system.equipStatus > 1) {
                    // Equipped -> Carry it
                    await weapon.update({ "system.equipStatus": 1 });
                } else {
                    // Carried -> Equip it (status 4)
                    await weapon.update({ "system.equipStatus": 4 });
                }
            } else if (hasTemplateAOE) {
                // Template weapons toggle between carried (1) and stored (0), never equipped
                debug(`Template weapon in equipment mode: ${weapon.name}, current status: ${weapon.system.equipStatus}`);
                if (weapon.system.equipStatus >= 2) {
                    // Incorrectly equipped -> Move to carried
                    await weapon.update({ "system.equipStatus": 1 });
                } else if (weapon.system.equipStatus === 1) {
                    // Carried -> Store it
                    await weapon.update({ "system.equipStatus": 0 });
                } else if (weapon.system.equipStatus === 0) {
                    // Stored -> Carry it
                    await weapon.update({ "system.equipStatus": 1 });
                }
            } else {
                // Normal weapons toggle between equipped and carried
                if (weapon.system.equipStatus > 1) {
                    // Weapon is equipped, unequip it
                    const { handleWeaponUnequip } = await import("../utils/weaponHandlers.js");
                    await handleWeaponUnequip(this.token.actor, weaponId);
                } else {
                    // Weapon is carried, equip it
                    const { handleWeaponEquip } = await import("../utils/weaponHandlers.js");
                    await handleWeaponEquip(this.token.actor, weaponId);
                }
            }
            await this._updateMenuDisplay(); // Refresh the menu
            return;
        }
        
        // Check if powers are expanded and this is a favorited power
        if (this.expandedSections.powers && weapon?.type === "power" && weapon.system.favorite === true) {
            // Toggle favorite off
            const { handlePowerFavoriteToggle } = await import("../utils/weaponHandlers.js");
            await handlePowerFavoriteToggle(this.token.actor, weaponId);
            await this._updateMenuDisplay(); // Refresh to show unfavorited
            return;
        }
        
        // Normal behavior when not in equipment mode
        if (metadata?.isCarried) {
            // Import and use the equip handler
            const { handleWeaponEquip } = await import("../utils/weaponHandlers.js");
            await handleWeaponEquip(this.token.actor, weaponId);
            await this._updateMenuDisplay(); // Refresh to show equipped
        } else if (metadata?.isUnfavorited) {
            // Import and use the favorite toggle handler
            const { handlePowerFavoriteToggle } = await import("../utils/weaponHandlers.js");
            await handlePowerFavoriteToggle(this.token.actor, weaponId);
            await this._updateMenuDisplay(); // Refresh to show favorited
        } else {
            // Normal use
            await handleWeaponSelection(this.token, weaponId, () => this.close());
        }
    }

    /**
     * Handle weapon editing (right-click)
     * @param {string} weaponId - The ID of the weapon to edit
     * @private
     */
    async _handleWeaponEdit(weaponId) {
        await handleWeaponEdit(this.token, weaponId, () => this.close());
    }

    /**
     * Set up event listeners for menu interaction
     * Handles click-outside and escape key for closing
     * @private
     */
    _setupEventListeners() {
        this.clickOutsideHandler = (event) => {
            // Defensive checks
            if (!ContainerVerification.isValid(this.container)) return;
            if (this.stateMachine.getState() !== 'OPEN') return;
            
            // Check debounce timing
            if (!timestamps.hasElapsed('weaponMenuOpened', TIMING.MENU_CLICK_DEBOUNCE)) {
                return;
            }

            try {
                const bounds = this.container.getBounds();
                const clickPoint = event.data.global;

                if (!bounds.contains(clickPoint.x, clickPoint.y)) {
                    this.close();
                }
            } catch (error) {
                debugWarn('Error in click outside handler', error);
            }
        };

        // Handle right-click outside menu
        this.rightClickHandler = (event) => {
            if (!ContainerVerification.isValid(this.container)) return;
            if (this.stateMachine.getState() !== 'OPEN') return;
            
            try {
                const bounds = this.container.getBounds();
                const clickPoint = event.data.global;

                if (!bounds.contains(clickPoint.x, clickPoint.y)) {
                    this.close();
                }
            } catch (error) {
                debugWarn('Error in right-click handler', error);
            }
        };

        this.keyHandler = (event) => {
            if (event.key === 'Escape' && this.stateMachine.getState() === 'OPEN') {
                this.close();
            }
        };

        // Prevent context menu on canvas while menu is open
        this.contextMenuHandler = (event) => {
            if (this.stateMachine.getState() === 'OPEN') {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        // Mark timestamp for debouncing
        timestamps.mark('weaponMenuOpened');
        
        // Set up event listeners with defensive check
        if (this.stateMachine.isActive() && canvas.stage) {
            canvas.stage.on('pointerdown', this.clickOutsideHandler);
            canvas.stage.on('rightdown', this.rightClickHandler);
            document.addEventListener('keydown', this.keyHandler);
            canvas.app.view.addEventListener('contextmenu', this.contextMenuHandler);
        }
    }


    /**
     * Show tooltip with weapon information
     * @param {string} content - HTML content for tooltip
     * @param {PIXI.InteractionEvent} event - The interaction event
     * @private
     */
    _showTooltip(content, event) {
        this._hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'tokencontextmenu-immediate-tooltip';
        tooltip.innerHTML = content;
        tooltip.id = 'weapon-menu-tooltip';
        tooltip.style.display = 'block';
        tooltip.style.zIndex = Z_INDEX.TOOLTIP;
        document.body.appendChild(tooltip);

        const updateTooltipPosition = (e) => {
            const tooltip = document.getElementById('weapon-menu-tooltip');
            if (tooltip) {
                const rect = canvas.app.view.getBoundingClientRect();
                const x = e.clientX || (rect.left + event.data.global.x);
                const y = e.clientY || (rect.top + event.data.global.y);

                tooltip.style.left = (x - tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = (y + 25) + 'px';
            }
        };

        updateTooltipPosition(event.data.originalEvent);
        this._currentTooltipUpdate = updateTooltipPosition;
        document.addEventListener('mousemove', updateTooltipPosition);
    }

    /**
     * Hide and clean up tooltip
     * @private
     */
    _hideTooltip() {
        const tooltip = document.getElementById('weapon-menu-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
        if (this._currentTooltipUpdate) {
            document.removeEventListener('mousemove', this._currentTooltipUpdate);
            this._currentTooltipUpdate = null;
        }
    }

    /**
     * Close the weapon menu with proper cleanup
     * Uses state machine to ensure valid transitions
     * @param {Object} options - Close options
     * @returns {Promise<void>}
     * @override
     */
    async close(options = {}) {
        // Queue the close operation
        return this.operationQueue.enqueue(async () => {
            // Check if we can transition to CLOSING
            if (!this.stateMachine.canTransition('CLOSING')) {
                debug(`Cannot close weapon menu in state: ${this.stateMachine.getState()}`);
                // If we're already closed or closing, just return
                if (this.stateMachine.getState() === 'CLOSED' || this.stateMachine.getState() === 'CLOSING') {
                    return;
                }
                // If we're in ERROR state, do emergency cleanup
                if (this.stateMachine.getState() === 'ERROR') {
                    this._emergencyCleanup();
                    return;
                }
            }
            
            // Transition to CLOSING
            this.stateMachine.transition('CLOSING');
            
            try {
                // Hide tooltip
                this._hideTooltip();

                // Clean up event listeners
                if (this.clickOutsideHandler && canvas.stage) {
                    canvas.stage.off('pointerdown', this.clickOutsideHandler);
                    this.clickOutsideHandler = null;
                }
                if (this.rightClickHandler && canvas.stage) {
                    canvas.stage.off('rightdown', this.rightClickHandler);
                    this.rightClickHandler = null;
                }
                if (this.keyHandler) {
                    document.removeEventListener('keydown', this.keyHandler);
                    this.keyHandler = null;
                }
                if (this.contextMenuHandler && canvas.app?.view) {
                    canvas.app.view.removeEventListener('contextmenu', this.contextMenuHandler);
                    this.contextMenuHandler = null;
                }

                // Clean up weapon containers
                this.weaponContainers.forEach(wc => {
                    if (wc && !wc.destroyed) {
                        wc.removeAllListeners();
                    }
                });
                this.weaponContainers = [];

                // Clean up PIXI container
                if (this.container) {
                    ContainerVerification.safeRemove(this.container);
                    ContainerVerification.safeDestroy(this.container);
                    this.container = null;
                }

                // Clear state manager reference if this is the current menu
                if (weaponSystemCoordinator.getMenuApp() === this) {
                    weaponSystemCoordinator.updateMenuState({
                        currentToken: null,
                        currentMenuApp: null
                    });
                }

                // Transition to CLOSED
                this.stateMachine.transition('CLOSED');

                // Call hook after successful close
                Hooks.call('tokencontextmenu.weaponMenuClosed');
                
            } catch (error) {
                debugError('Error during weapon menu close', error);
                this.stateMachine.transition('ERROR');
                this._emergencyCleanup();
            }
        }, 'close');
    }
    
    /**
     * Emergency cleanup when normal close fails
     * Forces cleanup of all resources without state checks
     * @private
     */
    _emergencyCleanup() {
        debugWarn('Performing emergency weapon menu cleanup');
        
        // Force remove all event listeners
        try {
            if (this.clickOutsideHandler && canvas.stage) {
                canvas.stage.off('pointerdown', this.clickOutsideHandler);
            }
            if (this.rightClickHandler && canvas.stage) {
                canvas.stage.off('rightdown', this.rightClickHandler);
            }
            if (this.keyHandler) {
                document.removeEventListener('keydown', this.keyHandler);
            }
            if (this.contextMenuHandler && canvas.app?.view) {
                canvas.app.view.removeEventListener('contextmenu', this.contextMenuHandler);
            }
        } catch (e) {}
        
        // Force hide tooltip
        try {
            this._hideTooltip();
        } catch (e) {}
        
        // Force destroy container
        try {
            if (this.container) {
                ContainerVerification.safeDestroy(this.container);
            }
        } catch (e) {}
        
        // Clear all references
        this.container = null;
        this.weaponContainers = [];
        this.clickOutsideHandler = null;
        this.rightClickHandler = null;
        this.keyHandler = null;
        this.contextMenuHandler = null;
        this._currentTooltipUpdate = null;
        
        // Reset state machine
        this.stateMachine.reset();
        
        // Clear state manager
        if (weaponSystemCoordinator.getMenuApp() === this) {
            weaponSystemCoordinator.setMenuApp(null);
        }
    }
    
    /**
     * Get current menu status for debugging
     * @returns {Object} Status object with state information
     */
    getStatus() {
        return {
            state: this.stateMachine.getState(),
            containerValid: ContainerVerification.isValid(this.container),
            tokenId: this.token?.id,
            operationQueue: this.operationQueue.getStatus(),
            hasEventListeners: !!(this.clickOutsideHandler || this.keyHandler)
        };
    }

    
    /**
     * Creates an expand/collapse button for showing additional items
     * @param {string} section - The section this button controls (weapons/powers)
     * @param {boolean} isExpanded - Current expansion state
     * @param {number} menuWidth - Menu width for positioning
     * @param {number} yPosition - Vertical position
     * @param {number} baseIconSize - Base size for scaling
     * @returns {PIXI.Container} The button container
     * @private
     */
    _createExpandButton(section, isExpanded, menuWidth, yPosition, baseIconSize) {
        const container = new PIXI.Container();
        container.name = `expand-button-${section}`;
        container.interactive = true;
        container.eventMode = 'static';
        container.cursor = 'pointer';
        
        // Store button metadata
        container.buttonSection = section;
        container.isExpanded = isExpanded;
        
        // Draw a simple vertical pipe
        const pipe = new PIXI.Graphics();
        const pipeHeight = baseIconSize * 0.6;
        const pipeWidth = 2;
        
        // Different opacity based on expanded state
        const pipeAlpha = isExpanded ? 0.9 : 0.5;
        
        pipe.beginFill(COLORS.EXPAND_BUTTON_TEXT, pipeAlpha);
        pipe.drawRect(-pipeWidth/2, -pipeHeight/2, pipeWidth, pipeHeight);
        pipe.endFill();
        
        container.addChild(pipe);
        
        // Store reference for updates
        container.buttonGraphics = pipe;
        
        // Add a larger invisible hit area for easier clicking
        const hitArea = new PIXI.Graphics();
        hitArea.beginFill(0xFFFFFF, 0.01);  // Nearly invisible
        hitArea.drawRect(-baseIconSize/4, -baseIconSize/4, baseIconSize/2, baseIconSize/2);
        hitArea.endFill();
        container.addChild(hitArea);
        
        // Simple hover effects - brighten on hover
        container.on('pointerover', () => {
            pipe.alpha = isExpanded ? 1 : 0.8;
        });
        
        container.on('pointerout', () => {
            pipe.alpha = isExpanded ? 0.9 : 0.5;
        });
        
        container.on('pointerdown', async (event) => {
            debug(`Expand button clicked!`, { section, event });
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }
            await this._handleExpandToggle(section);
        });
        
        return container;
    }
    
    /**
     * Handle expand/collapse toggle for a section
     * @param {string} section - The section to toggle (weapons/powers)
     * @private
     */
    async _handleExpandToggle(section) {
        debug(`Expand button clicked for section: ${section}`, {
            menuState: this.stateMachine.getState()
        });
        
        return this.operationQueue.enqueue(async () => {
            debug(`Starting expand toggle operation for: ${section}`);
            
            // For equipment section, toggle both weapons and powers
            if (section === 'equipment') {
                const currentState = this.expandedSections.weapons || this.expandedSections.powers;
                const newState = !currentState;
                
                this.expandedSections.weapons = newState;
                this.expandedSections.powers = newState;
                this.equipmentMode = newState;
                
                debug(`Toggled equipment mode to: ${newState}`, {
                    weapons: this.expandedSections.weapons,
                    powers: this.expandedSections.powers,
                    equipmentMode: this.equipmentMode
                });
            }
            
            // Update display
            debug(`Calling _updateMenuDisplay...`);
            await this._updateMenuDisplay();
            debug(`_updateMenuDisplay completed`);
            
            // Call hook
            Hooks.call('tokencontextmenu.sectionToggled', {
                section,
                expanded: this.expandedSections[section],
                token: this.token
            });
        }, 'toggleExpand');
    }
    
    /**
     * Update menu display without closing/reopening
     * Re-fetches items and rebuilds the menu content
     * @private
     */
    async _updateMenuDisplay() {
        debug(`_updateMenuDisplay called`, {
            expandedSections: this.expandedSections,
            menuState: this.stateMachine.getState()
        });
        
        // Import getMenuItems
        const { getMenuItems } = await import("../utils/weaponMenuDisplay.js");
        
        // Get updated items
        const { items, metadata } = getMenuItems(this.token, {
            expandWeapons: this.expandedSections.weapons,
            expandPowers: this.expandedSections.powers
        });
        
        // Update stored data
        this.weapons = items;
        this.itemMetadata = metadata;
        
        // Rebuild display
        if (ContainerVerification.isValid(this.container)) {
            // Clear existing content
            while (this.container.children.length > 0) {
                const child = this.container.children[0];
                if (child && !child.destroyed) {
                    if (child.removeAllListeners) {
                        child.removeAllListeners();
                    }
                    this.container.removeChild(child);
                    if (child.destroy) {
                        child.destroy();
                    }
                }
            }
            
            // Clear weapon containers array
            this.weaponContainers = [];
            this.expandButtons.clear();
            
            debug(`Container cleared, calling _rebuildMenuContent...`);
            // Rebuild the menu content
            await this._rebuildMenuContent();
            debug(`_rebuildMenuContent completed`);
        } else {
            debugWarn(`Container not valid for update:`, {
                container: !!this.container,
                destroyed: this.container?.destroyed
            });
        }
    }
    
    /**
     * Rebuild menu content without closing/reopening
     * @private
     */
    async _rebuildMenuContent() {
        // Defensive check for canvas
        if (!canvas?.grid?.size) {
            debugWarn('Canvas grid not available for menu rebuild');
            return;
        }
        const gridSize = canvas.grid.size;
        const iconScale = getWeaponMenuIconScale();
        const baseIconSize = gridSize * iconScale;
        const iconRadius = baseIconSize * SIZES.ICON_RADIUS_RATIO;
        const spriteSize = baseIconSize * SIZES.SPRITE_SIZE_RATIO;
        const fontSize = baseIconSize * SIZES.FONT_SIZE_RATIO;

        const background = new PIXI.Graphics();
        const itemsPerRow = getWeaponMenuItemsPerRow();

        const sections = [];
        let current = [];
        const expandButtons = [];
        
        for (const w of this.weapons) {
            if (w.type === "separator") {
                if (current.length > 0) {
                    sections.push(current);
                    current = [];
                }
            } else if (w.type === "expandButton") {
                // Store expand buttons separately
                expandButtons.push(w);
                // Don't create a new section for expand buttons
            } else {
                current.push(w);
            }
        }
        if (current.length > 0) {
            sections.push(current);
        }

        const rows = sections.map(sec => Math.ceil(sec.length / itemsPerRow));
        const sepCount = Math.max(0, sections.length - 1);
        const sepHeight = baseIconSize * SIZES.SEPARATOR_HEIGHT_RATIO;
        const menuHeight = rows.reduce((sum, r) => sum + (r * baseIconSize), 0) + (sepCount * sepHeight);
        const widths = sections.map(sec => Math.min(sec.length, itemsPerRow) * baseIconSize);
        // Add minimal space for expand button on the right if needed
        const expandButtonSpace = expandButtons.length > 0 ? baseIconSize * 0.3 : 0;
        const menuWidth = Math.max(...widths, baseIconSize) + expandButtonSpace;

        background.beginFill(COLORS.MENU_BACKGROUND, COLORS.MENU_BACKGROUND_ALPHA);
        background.lineStyle(1, COLORS.MENU_BORDER);
        background.drawRoundedRect(-menuWidth/2, 0, menuWidth, menuHeight, UI.MENU_CORNER_RADIUS);
        background.endFill();
        this.container.addChild(background);

        let yOffset = 0;
        let sectionIndex = 0;
        let expandButtonIndex = 0;

        for (const section of sections) {
            if (section.length > 0) {
                for (let i = 0; i < section.length; i++) {
                    const weapon = section[i];
                    const weaponContainer = await this._createWeaponIconWithSection(
                        weapon, i, section.length, itemsPerRow, menuWidth,
                        baseIconSize, iconRadius, spriteSize, fontSize, yOffset
                    );
                    this.container.addChild(weaponContainer);
                    this.weaponContainers.push(weaponContainer);
                }

                const sectionRows = Math.ceil(section.length / itemsPerRow);
                yOffset += sectionRows * baseIconSize;

                // Check if there's an expand button for this section
                if (expandButtonIndex < expandButtons.length) {
                    const expandButton = expandButtons[expandButtonIndex];
                    // Check if this button belongs to the current section
                    const sectionType = section[0]?.type; // Get type from first item in section
                    const buttonBelongsToSection = 
                        (sectionType === "weapon" && expandButton.section === "weapons") ||
                        (sectionType === "power" && expandButton.section === "powers");
                    
                    debug(`Checking expand button for section ${sectionIndex}:`, {
                        expandButton,
                        sectionType,
                        buttonBelongsToSection,
                        sectionItems: section.length,
                        expandButtonIndex
                    });
                    
                    if (buttonBelongsToSection) {
                        const buttonContainer = this._createExpandButton(
                            expandButton.section,
                            expandButton.expanded,
                            menuWidth,
                            yOffset - baseIconSize / 2,
                            baseIconSize
                        );
                        
                        // Position on the right side with reduced spacing
                        buttonContainer.x = menuWidth / 2 - baseIconSize * 0.2;  // Reduced from 0.3 to take less space
                        // Position on the last row of items
                        const lastRowIndex = Math.floor((section.length - 1) / itemsPerRow);
                        const currentSectionYOffset = yOffset - (sectionRows * baseIconSize);
                        buttonContainer.y = currentSectionYOffset + (lastRowIndex * baseIconSize) + (baseIconSize / 2);
                        
                        this.container.addChild(buttonContainer);
                        this.expandButtons.set(expandButton.section, buttonContainer);
                        expandButtonIndex++;
                    }
                }

                if (sectionIndex < sections.length - 1) {
                    const separatorContainer = this._createSeparator(
                        { type: "separator" }, menuWidth, yOffset, sepHeight
                    );
                    this.container.addChild(separatorContainer);
                    yOffset += sepHeight;
                }

                sectionIndex++;
            }
        }
        
        // Handle any remaining expand buttons (e.g., powers-only case)
        while (expandButtonIndex < expandButtons.length) {
            const expandButton = expandButtons[expandButtonIndex];
            debug(`Processing remaining expand button in update:`, expandButton);
            
            const buttonContainer = this._createExpandButton(
                expandButton.section,
                expandButton.expanded,
                menuWidth,
                yOffset - baseIconSize / 2,
                baseIconSize
            );
            
            // Position on the right side
            buttonContainer.x = menuWidth / 2 - baseIconSize * 0.2;
            // Position at the current yOffset
            buttonContainer.y = yOffset - baseIconSize / 2;
            
            this.container.addChild(buttonContainer);
            this.expandButtons.set(expandButton.section, buttonContainer);
            expandButtonIndex++;
        }
    }
}