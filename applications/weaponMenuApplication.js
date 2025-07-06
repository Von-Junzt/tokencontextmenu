import { getWeaponMenuIconScale, getWeaponMenuItemsPerRow, shouldShowDetailedTooltips, shouldZoomOnEquipmentMode, getEquipmentModeZoomLevel, getEquipmentModeZoomDuration, shouldBlurOnEquipmentMode } from "../settings/settings.js";
import { handleWeaponSelection, handleWeaponEdit } from "../utils/weaponHandlers.js";
import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { equipmentModeHandler } from "../managers/EquipmentModeHandler.js";
import { weaponMenuTooltipManager } from "../managers/WeaponMenuTooltipManager.js";
import { blurFilterManager } from "../managers/BlurFilterManager.js";
import { WeaponMenuBuilder } from "../utils/WeaponMenuBuilder.js";
import { tickerDelay, timestamps } from "../utils/timingUtils.js";
import { COLORS, SIZES, UI, GRAPHICS, TIMING, MOUSE_BUTTON, MATH, CONTAINER, UI_ANIMATION, EQUIPMENT_ZOOM } from "../utils/constants.js";
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
        
        // Initialize new components
        this.menuBuilder = new WeaponMenuBuilder();
        this.tooltipManager = weaponMenuTooltipManager;
        
        // Extract metadata from options
        this.itemMetadata = options.metadata || new Map();
        
        // Expansion state
        this.expandedSections = {
            weapons: false,
            powers: false
        };
        
        // Equipment mode state
        this.equipmentMode = false;
        
        // Store expand button references
        this.expandButtons = new Map();
        
        // Canvas zoom state for equipment mode
        this.originalCanvasState = null;
        
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
        this.container.x = this.token.x + (this.token.w / MATH.CENTER_DIVISOR);
        this.container.y = this.token.y + this.token.h + UI.MENU_Y_OFFSET;
        
        // Use the menu builder to create the menu
        const { weaponContainers } = this.menuBuilder.buildMenu(
            this.container, 
            this.weapons, 
            this.expandButtons,
            {
                itemMetadata: this.itemMetadata,
                onWeaponHover: (container, event) => this._setupWeaponEvents(container, container.getChildByName('background'), this.menuBuilder.iconRadius),
                onExpandClick: (section) => this._handleExpandToggle(section)
            }
        );
        
        this.weaponContainers = weaponContainers;
        
        // Set up events for all weapon containers
        this.weaponContainers.forEach(container => {
            this._setupWeaponEvents(container, container.getChildByName('background'), this.menuBuilder.iconRadius);
        });
        
        // Set up events for expand buttons
        this.expandButtons.forEach((button, section) => {
            this._setupExpandButtonEvents(button);
        });
        
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
    /**
     * Sets up events for expand buttons
     * @param {PIXI.Container} button - The expand button container
     * @private
     */
    _setupExpandButtonEvents(button) {
        const pipe = button.buttonGraphics;
        const isExpanded = button.isExpanded;
        
        button.on('pointerover', () => {
            pipe.alpha = isExpanded ? UI_ANIMATION.EXPAND_BUTTON.HOVER_ALPHA_EXPANDED : UI_ANIMATION.EXPAND_BUTTON.HOVER_ALPHA_COLLAPSED;
        });
        
        button.on('pointerout', () => {
            pipe.alpha = isExpanded ? UI_ANIMATION.EXPAND_BUTTON.NORMAL_ALPHA_EXPANDED : UI_ANIMATION.EXPAND_BUTTON.NORMAL_ALPHA_COLLAPSED;
        });
        
        button.on('pointerdown', async (event) => {
            debug(`Expand button clicked!`, { section: button.buttonSection });
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }
            await this._handleExpandToggle(button.buttonSection);
        });
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
            weaponContainer.scale.set(UI_ANIMATION.HOVER_SCALE);
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
            iconBg.lineStyle(GRAPHICS.DEFAULT_LINE_WIDTH, hoverBorder);
            iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * MATH.DIMENSION_MULTIPLIER, iconRadius * MATH.DIMENSION_MULTIPLIER, UI.ICON_CORNER_RADIUS);
            iconBg.endFill();

            // Check if detailed tooltips are enabled
            const showDetailed = shouldShowDetailedTooltips();
            
            // Build tooltip content using tooltip manager
            const tooltipContent = this.tooltipManager.buildTooltipContent(
                weapon, 
                metadata, 
                showDetailed
            );

            this._showTooltip(tooltipContent, event);
        });

        weaponContainer.on('pointerout', () => {
            weaponContainer.scale.set(UI_ANIMATION.NORMAL_SCALE);
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
            iconBg.lineStyle(GRAPHICS.DEFAULT_LINE_WIDTH, borderColor);
            iconBg.drawRoundedRect(-iconRadius, -iconRadius, iconRadius * MATH.DIMENSION_MULTIPLIER, iconRadius * MATH.DIMENSION_MULTIPLIER, UI.ICON_CORNER_RADIUS);
            iconBg.endFill();

            this._hideTooltip();
        });

        weaponContainer.on('pointerdown', async (event) => {
            event.stopPropagation();
            if (event.data?.originalEvent) {
                event.data.originalEvent.stopPropagation();
            }

            this._hideTooltip();

            if (event.data.button === MOUSE_BUTTON.LEFT) {
                await this._handleWeaponSelection(weaponContainer.weapon.id);
            } else if (event.data.button === MOUSE_BUTTON.RIGHT) {
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
            
            // Use cycling logic for equipment mode
            const newStatus = equipmentModeHandler.cycleEquipmentStatus(weapon);
            debug(`Cycling weapon ${weapon.name} from status ${weapon.system.equipStatus} to ${newStatus}`);
            
            await weapon.update({ "system.equipStatus": newStatus });
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
        this.tooltipManager.show(content, event);
    }

    /**
     * Hide and clean up tooltip
     * @private
     */
    _hideTooltip() {
        this.tooltipManager.hide();
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
            
            // Restore zoom if in equipment mode
            if (this.equipmentMode && this.originalCanvasState) {
                this._restoreCanvasZoom(); // Don't await - let zoom out happen in background
            }
            
            // Clear blur if in equipment mode
            if (this.equipmentMode && shouldBlurOnEquipmentMode()) {
                blurFilterManager.clearEquipmentModeBlur();
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
        
        // Restore canvas zoom without animation
        if (this.originalCanvasState && canvas?.ready) {
            // Use immediate pan without animation in emergency
            canvas.pan({
                x: this.originalCanvasState.x,
                y: this.originalCanvasState.y,
                scale: this.originalCanvasState.scale
            });
        }
        this.originalCanvasState = null;
        
        // Force clear blur filters
        try {
            blurFilterManager.clearEquipmentModeBlur();
        } catch (e) {
            debugWarn('Failed to clear blur filters during emergency cleanup', e);
        }
        
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
                
                // Handle zoom if enabled
                if (shouldZoomOnEquipmentMode() && canvas?.ready) {
                    if (newState && !this.originalCanvasState) {
                        // Store current canvas state
                        this.originalCanvasState = {
                            x: canvas.stage.pivot.x,
                            y: canvas.stage.pivot.y,
                            scale: canvas.stage.scale.x
                        };
                        
                        // Calculate grid-aware zoom
                        const gridSize = canvas.grid.size || EQUIPMENT_ZOOM.REFERENCE_GRID_SIZE;
                        const userZoomLevel = getEquipmentModeZoomLevel();
                        const gridScale = EQUIPMENT_ZOOM.REFERENCE_GRID_SIZE / gridSize;
                        const adjustedZoom = userZoomLevel * gridScale;
                        
                        // Ensure zoom stays within reasonable bounds
                        const finalZoom = Math.max(EQUIPMENT_ZOOM.MIN_SCALE, 
                                                  Math.min(adjustedZoom, EQUIPMENT_ZOOM.MAX_SCALE));
                        
                        const duration = getEquipmentModeZoomDuration();
                        canvas.animatePan({
                            x: this.token.center.x,
                            y: this.token.center.y,
                            scale: finalZoom,
                            duration: duration
                        }); // Don't await - let zoom happen in background so menu opens immediately
                        
                        debug("Zoomed to token for equipment mode", {
                            token: this.token.name,
                            gridSize: gridSize,
                            userZoomLevel: userZoomLevel,
                            gridScale: gridScale,
                            adjustedZoom: adjustedZoom,
                            finalZoom: finalZoom
                        });
                    } else if (!newState && this.originalCanvasState) {
                        // Restore original view
                        this._restoreCanvasZoom(); // Don't await - let zoom out happen in background
                    }
                }
                
                // Handle blur if enabled
                if (shouldBlurOnEquipmentMode() && canvas?.ready) {
                    if (newState) {
                        // Apply blur to canvas elements except current token
                        blurFilterManager.applyEquipmentModeBlur(this.token);
                        debug("Applied blur filter for equipment mode");
                    } else {
                        // Remove blur filters
                        blurFilterManager.clearEquipmentModeBlur();
                        debug("Cleared blur filter after equipment mode");
                    }
                }
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
                const child = this.container.children[CONTAINER.FIRST_CHILD_INDEX];
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
        
        // Clear expand buttons before rebuild
        this.expandButtons.clear();
        
        // Use the menu builder to rebuild the menu
        const { weaponContainers } = this.menuBuilder.buildMenu(
            this.container, 
            this.weapons, 
            this.expandButtons,
            {
                itemMetadata: this.itemMetadata,
                onWeaponHover: (container, event) => this._setupWeaponEvents(container, container.getChildByName('background'), this.menuBuilder.iconRadius),
                onExpandClick: (section) => this._handleExpandToggle(section)
            }
        );
        
        this.weaponContainers = weaponContainers;
        
        // Set up events for all weapon containers
        this.weaponContainers.forEach(container => {
            this._setupWeaponEvents(container, container.getChildByName('background'), this.menuBuilder.iconRadius);
        });
        
        // Set up events for expand buttons
        this.expandButtons.forEach((button, section) => {
            this._setupExpandButtonEvents(button);
        });
    }
    
    /**
     * Restore the canvas to its original zoom state
     * @private
     */
    _restoreCanvasZoom() {
        if (!this.originalCanvasState || !canvas?.ready) return;
        
        debug("Restoring original canvas zoom");
        
        const duration = getEquipmentModeZoomDuration();
        canvas.animatePan({
            x: this.originalCanvasState.x,
            y: this.originalCanvasState.y,
            scale: this.originalCanvasState.scale,
            duration: duration
        });
        
        this.originalCanvasState = null;
    }
}