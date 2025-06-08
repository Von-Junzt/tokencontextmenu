import { getWeaponMenuIconScale, getWeaponMenuItemsPerRow } from "../settings/settings.js";
import { handleWeaponSelection, handleWeaponEdit } from "../utils/weaponHandlers.js";
import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { tickerDelay, timestamps } from "../utils/timingUtils.js";
import { TIMING, SIZES, COLORS, UI, Z_INDEX } from "../utils/constants.js";
import { WeaponMenuStateMachine, OperationQueue, ContainerVerification } from "../utils/weaponMenuState.js";

/**
 * Application class for the canvas-based weapon menu
 */
export class WeaponMenuApplication extends Application {
    constructor(token, weapons, options = {}) {
        super(options);
        this.token = token;
        this.weapons = weapons;
        this.container = null;
        this.weaponContainers = [];
        this.clickOutsideHandler = null;
        this.rightClickHandler = null;
        this.keyHandler = null;
        this.contextMenuHandler = null;
        this._currentTooltipUpdate = null;
        
        // New state management
        this.stateMachine = new WeaponMenuStateMachine();
        this.operationQueue = new OperationQueue();
        
        // Listen to state changes for debugging
        this.stateMachine.onStateChange((from, to) => {
            console.debug(`tokencontextmenu | Weapon menu state: ${from} -> ${to}`);
        });
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "weapon-menu",
            classes: ["tokencontextmenu-weapon-menu"],
            template: null,
            popOut: false,
            minimizable: false,
            resizable: false,
            title: "Weapon Menu"
        });
    }

    get rendered() {
        return this.stateMachine.isActive();
    }

    /**
     * Render the weapon menu
     * Overrides Application._render with queue-based state management
     * @param {boolean} force - Force re-render
     * @param {Object} options - Render options
     * @returns {Promise<WeaponMenuApplication>} This application instance
     * @override
     */
    async _render(force, options) {
        // Queue the render operation to prevent race conditions
        return this.operationQueue.enqueue(async () => {
            // Check if we can transition to OPENING
            if (!this.stateMachine.canTransition('OPENING')) {
                console.warn(`tokencontextmenu | Cannot open weapon menu in state: ${this.stateMachine.getState()}`);
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
                console.error('tokencontextmenu | Failed to render weapon menu', error);
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
        for (const w of this.weapons) {
            if (w.type === "separator") {
                if (current.length > 0) {
                    sections.push(current);
                    current = [];
                }
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
        const menuWidth = Math.max(...widths, baseIconSize);

        background.beginFill(COLORS.MENU_BACKGROUND, COLORS.MENU_BACKGROUND_ALPHA);
        background.lineStyle(1, COLORS.MENU_BORDER);
        background.drawRoundedRect(-menuWidth/2, 0, menuWidth, menuHeight, UI.MENU_CORNER_RADIUS);
        background.endFill();
        this.container.addChild(background);

        let yOffset = 0;
        let sectionIndex = 0;

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
        const bgColor = weapon.type === "power" ? COLORS.POWER_BACKGROUND : COLORS.WEAPON_BACKGROUND;
        const borderColor = weapon.type === "power" ? COLORS.POWER_BORDER : COLORS.WEAPON_BORDER;

        iconBg.beginFill(bgColor);
        iconBg.lineStyle(1, borderColor);
        iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * 2, iconRadius * 2, UI.ICON_CORNER_RADIUS);
        iconBg.endFill();
        weaponContainer.addChild(iconBg);

        try {
            const texture = await PIXI.Texture.fromURL(weapon.img);
            const sprite = new PIXI.Sprite(texture);
            sprite.width = spriteSize;
            sprite.height = spriteSize;
            sprite.anchor.set(0.5);

            const spriteMask = new PIXI.Graphics();
            spriteMask.beginFill(COLORS.SPRITE_MASK);
            spriteMask.drawRoundedRect(-spriteSize/2, -spriteSize/2, spriteSize, spriteSize, UI.ICON_CORNER_RADIUS);
            spriteMask.endFill();

            sprite.mask = spriteMask;

            weaponContainer.addChild(spriteMask);
            weaponContainer.addChild(sprite);
        } catch (error) {
            console.warn(`Failed to load weapon texture for ${weapon.name}:`, error);
            const fallbackText = new PIXI.Text(weapon.name.charAt(0), {
                fontSize: fontSize,
                fill: COLORS.TEXT_FILL,
                align: 'center'
            });
            fallbackText.anchor.set(0.5);
            weaponContainer.addChild(fallbackText);
        }

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
            const hoverColor = weapon.type === "power" ? COLORS.POWER_HOVER_BACKGROUND : COLORS.WEAPON_HOVER_BACKGROUND;
            const hoverBorder = weapon.type === "power" ? COLORS.POWER_HOVER_BORDER : COLORS.WEAPON_HOVER_BORDER;

            iconBg.beginFill(hoverColor);
            iconBg.lineStyle(1, hoverBorder);
            iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * 2, iconRadius * 2, UI.ICON_CORNER_RADIUS);
            iconBg.endFill();

            // Build tooltip content
            let tooltipContent = weapon.name;
            
            // Add ammo count if applicable
            if (weapon.type === "weapon" && weapon.system?.currentShots !== undefined && weapon.system?.shots !== undefined &&
                (weapon.system.currentShots > 0 || weapon.system.shots > 0)) {
                tooltipContent += ` (${weapon.system.currentShots}/${weapon.system.shots})`;
            }
            
            // Check if detailed tooltips are enabled - read fresh from settings
            const showDetailed = game.settings.get("tokencontextmenu", "detailedWeaponTooltips");
            
            // Add detailed stats for both weapons and powers if setting is enabled
            if (showDetailed && weapon.system && (weapon.type === "weapon" || weapon.type === "power")) {
                // Collect stat lines
                const statLines = [];
                
                // Damage
                if (weapon.system.damage) {
                    // add damage modifier if available
                    const damageMod = weapon.system.actions.dmgMod || '';
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
            const bgColor = weapon.type === "power" ? COLORS.POWER_BACKGROUND : COLORS.WEAPON_BACKGROUND;
            const borderColor = weapon.type === "power" ? COLORS.POWER_BORDER : COLORS.WEAPON_BORDER;

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
        await handleWeaponSelection(this.token, weaponId, () => this.close());
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
                console.warn('tokencontextmenu | Error in click outside handler', error);
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
                console.warn('tokencontextmenu | Error in right-click handler', error);
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
                console.debug(`tokencontextmenu | Cannot close weapon menu in state: ${this.stateMachine.getState()}`);
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

                // Call parent close
                await super.close(options);
                
            } catch (error) {
                console.error('tokencontextmenu | Error during weapon menu close', error);
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
        console.warn('tokencontextmenu | Performing emergency weapon menu cleanup');
        
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
}