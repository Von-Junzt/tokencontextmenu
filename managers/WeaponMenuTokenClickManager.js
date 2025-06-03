import { weaponSystemCoordinator } from "./WeaponSystemCoordinator.js";
import { tokenDragManager } from "./TokenDragManager.js";
import { shouldShowWeaponMenuOnSelection } from "../settings/settings.js";
import { TIMING } from "../utils/constants.js";
import { debug } from "../utils/debug.js";

/**
 * Centralized manager for all token click interactions related to weapon menus
 * Consolidates logic from tokenEventHandlers.js and prevents race conditions
 */
export class WeaponMenuTokenClickManager {
    constructor() {
        this.instanceId = Math.random().toString(36).substr(2, 9);
        debug('Creating WeaponMenuTokenClickManager instance:', this.instanceId);
        this.state = {
            // Interaction tracking
            lastInteractionTime: 0,
            lastInteractionToken: null,
            lastInteractionType: null,

            // Click debouncing
            clickDebounceMs: TIMING.MENU_CLICK_DEBOUNCE,

            // Drag detection threshold
            dragThresholdPixels: TIMING.DRAG_THRESHOLD_PIXELS,

            // Event handler references for cleanup
            canvasClickHandler: null,
            isCanvasHandlerSetup: false,
            
            // Mouse state tracking
            lastMouseButton: null,
            
            // Token selection tracking
            lastSelectedToken: null
        };

        // Don't setup handlers in constructor - let the calling code decide when
        this.boundHandlers = {
            handleTokenSelection: this.handleTokenSelection.bind(this),
            handleCanvasClick: this.handleCanvasClick.bind(this)
        };
    }

    /**
     * Initialize all event handlers - call this from the main init
     * Sets up both token selection hooks and canvas click handlers
     */
    setupEventHandlers() {
        if (this.boundHandlers.handleTokenSelection) {
            Hooks.on("controlToken", this.boundHandlers.handleTokenSelection);
        }

        // Don't setup canvas click handler - causes mouse up/down conflicts
        // this.setupCanvasClickHandler();
        this.setupTokenClickWrapper();
        
        // Clear last selected token on scene changes
        // But don't clear it on every render - only on actual scene changes
        let currentSceneId = canvas.scene?.id;
        Hooks.on('canvasReady', () => {
            const newSceneId = canvas.scene?.id;
            if (currentSceneId !== newSceneId) {
                debug('Scene changed, clearing last selected token');
                this.state.lastSelectedToken = null;
                currentSceneId = newSceneId;
            } else {
                debug('Canvas ready but same scene, keeping state');
            }
        });
    }

    /**
     * Setup canvas click handler with proper scene change handling
     * Ensures the handler persists through scene changes
     * @private
     */
    setupCanvasClickHandler() {
        if (this.state.isCanvasHandlerSetup) return;

        const setupHandler = () => {
            if (this.state.canvasClickHandler) {
                canvas.stage.off("pointertap", this.state.canvasClickHandler);
            }

            this.state.canvasClickHandler = this.boundHandlers.handleCanvasClick;
            canvas.stage.on("pointertap", this.state.canvasClickHandler);
            this.state.isCanvasHandlerSetup = true;
        };

        // Setup immediately if canvas is ready
        if (canvas.stage) setupHandler();

        // Re-setup on scene changes
        Hooks.on('canvasReady', setupHandler);
    }

    /**
     * Setup libWrapper to intercept token clicks before selection
     * This captures mouse button info before Foundry processes the selection
     * @private
     */
    setupTokenClickWrapper() {
        // Use libWrapper to intercept Token._onClickLeft
        libWrapper.register('tokencontextmenu', 'Token.prototype._onClickLeft', function(wrapped, event) {
            // Store the actual click event data before selection happens
            const manager = weaponMenuTokenClickManager;
            const token = this;
            manager.state.lastMouseButton = 0; // Left click
            
            debug('Token Left Click Intercepted:', {
                token: this.name,
                button: 0,
                controlled: this.controlled,
                lastSelectedToken: manager.state.lastSelectedToken?.name,
                isSameAsLast: manager.state.lastSelectedToken === this,
                tokenId: this.id,
                lastTokenId: manager.state.lastSelectedToken?.id
            });
            
            // If token is already controlled and selected, set up drag detection
            // We'll handle the menu toggle on mouse up to avoid showing menu during drags
            if (this.controlled && canvas.tokens.controlled.length === 1 && 
                manager.state.lastSelectedToken === this) {
                
                debug('Setting up drag detection for already selected token');
                
                // Store that we're tracking this token for potential menu toggle
                manager._pendingMenuToggle = {
                    token: token,
                    startX: event.data.global.x,
                    startY: event.data.global.y,
                    isDragging: false
                };
                
                const checkDrag = (e) => {
                    if (!manager._pendingMenuToggle) return;
                    const dx = Math.abs(e.data.global.x - manager._pendingMenuToggle.startX);
                    const dy = Math.abs(e.data.global.y - manager._pendingMenuToggle.startY);
                    if (dx > TIMING.DRAG_THRESHOLD_PIXELS || dy > TIMING.DRAG_THRESHOLD_PIXELS) {
                        manager._pendingMenuToggle.isDragging = true;
                        
                        // Close menu immediately when drag is detected
                        if (weaponSystemCoordinator.isMenuOpen()) {
                            debug('Drag detected, closing menu immediately');
                            manager.closeWeaponMenu();
                        }
                    }
                };
                
                const handleMouseUp = (e) => {
                    debug('Mouse up detected', {
                        hasPendingToggle: !!manager._pendingMenuToggle,
                        isDragging: manager._pendingMenuToggle?.isDragging,
                        token: token.name
                    });
                    
                    token.off('pointermove', checkDrag);
                    token.off('pointerup', handleMouseUp);
                    token.off('pointerupoutside', handleMouseUp);
                    
                    // Toggle menu if we didn't drag
                    if (manager._pendingMenuToggle && !manager._pendingMenuToggle.isDragging) {
                        debug('Click (not drag) on already selected token, toggling menu');
                        if (weaponSystemCoordinator.isMenuOpen()) {
                            manager.closeWeaponMenu();
                        } else {
                            manager.openWeaponMenu(token);
                        }
                    } else {
                        debug('Not toggling menu', {
                            reason: !manager._pendingMenuToggle ? 'no pending toggle' : 'was dragging'
                        });
                    }
                    
                    manager._pendingMenuToggle = null;
                };
                
                // Use the token's event handlers instead of canvas stage
                this.on('pointermove', checkDrag);
                this.on('pointerup', handleMouseUp);
                this.on('pointerupoutside', handleMouseUp);
            }
            
            // Continue with normal token selection
            return wrapped.call(this, event);
        }, 'WRAPPER');
        
        // Also intercept right clicks to distinguish them
        libWrapper.register('tokencontextmenu', 'Token.prototype._onClickRight', function(wrapped, event) {
            // Store right click info
            const manager = weaponMenuTokenClickManager;
            manager.state.lastMouseButton = 2; // Right click
            
            debug('Token Right Click Intercepted:', {
                token: this.name,
                button: 2
            });
            
            // Continue with normal right-click behavior
            return wrapped.call(this, event);
        }, 'WRAPPER');
    }


    /**
     * Handle token selection events (from controlToken hook)
     * Uses mouse button tracking to distinguish left/right clicks
     * @param {Token} token - The token being selected/deselected
     * @param {boolean} controlled - Whether the token is now controlled
     */
    async handleTokenSelection(token, controlled) {
        debug('handleTokenSelection called:', { 
            token: token.name, 
            controlled,
            instanceId: this.instanceId,
            currentLastSelected: this.state.lastSelectedToken?.name
        });
        
        if (!controlled) {
            // Handle deselection - don't close menu here
            // Let the canvas click handler or new selection handle menu closing
            return;
        } else if (controlled && token.isOwner && canvas.tokens.controlled.length === 1) {
            // Handle selection - check if we should show menu
            const wasLeftClick = this.state.lastMouseButton === 0;
            const settingEnabled = shouldShowWeaponMenuOnSelection();
            
            debug('Token Selection Debug:', {
                token: token.name,
                wasLeftClick,
                settingEnabled,
                lastMouseButton: this.state.lastMouseButton,
                lastSelectedToken: this.state.lastSelectedToken?.name,
                isSameAsLast: this.state.lastSelectedToken === token,
                menuOpen: weaponSystemCoordinator.isMenuOpen()
            });
            
            // Handle based on whether it's a new selection or click on already selected
            if (wasLeftClick) {
                // Check if this is the same token we just processed
                const isSameToken = this.state.lastSelectedToken === token;
                
                if (!isSameToken) {
                    // New token selection
                    // Close existing menu if open
                    if (weaponSystemCoordinator.isMenuOpen()) {
                        await this.closeWeaponMenu();
                    }
                    
                    // Only open menu if setting is enabled
                    if (settingEnabled) {
                        await this.openWeaponMenu(token);
                    }
                } else {
                    // Click on already selected token - always toggle menu regardless of setting
                    debug('Toggling menu for already selected token');
                    if (weaponSystemCoordinator.isMenuOpen()) {
                        debug('Closing menu');
                        await this.closeWeaponMenu();
                    } else {
                        debug('Opening menu');
                        await this.openWeaponMenu(token);
                    }
                }
            }
            
            // Update last selected token
            this.state.lastSelectedToken = token;
            debug('Updated lastSelectedToken to:', token.name, 'State now:', {
                lastSelectedToken: this.state.lastSelectedToken?.name,
                instanceId: this.instanceId
            });
        }
    }

    /**
     * Handle direct canvas clicks (from pointertap event)
     * Only processes left-clicks on tokens
     * @param {PIXI.InteractionEvent} event - The PIXI interaction event
     */
    async handleCanvasClick(event) {
        // Only left-button, no modifiers
        const orig = event.data.originalEvent;
        if (orig.button !== 0 || orig.shiftKey || orig.ctrlKey || orig.altKey) return;

        // Skip if we're processing a selection event
        if (weaponSystemCoordinator.isProcessingSelection()) return;

        // Find the Token sprite under the pointer
        let clickedToken = event.target;
        while (clickedToken && !(clickedToken instanceof Token)) {
            clickedToken = clickedToken.parent;
        }

        // Must be a valid token owned by the user
        if (!(clickedToken instanceof Token && clickedToken.isOwner)) {
            return;
        }

        // Only handle clicks on already controlled tokens
        // Selection is handled by handleTokenSelection
        if (!clickedToken.controlled) {
            return;
        }
        
        // Only proceed if this is the only controlled token
        if (canvas.tokens.controlled.length !== 1) {
            return;
        }

        const interactionData = {
            type: 'click',
            token: clickedToken,
            timestamp: Date.now(),
            event: event
        };

        await this.processTokenInteraction(interactionData);
    }

    /**
     * Central processing logic for all token interactions
     * Coordinates between drag detection, action determination, and execution
     * @param {Object} interactionData - The interaction data
     * @param {string} interactionData.type - Type of interaction ('selection' or 'click')
     * @param {Token} interactionData.token - The token involved
     * @param {number} interactionData.timestamp - When the interaction occurred
     * @private
     */
    async processTokenInteraction(interactionData) {
        const { type, token, timestamp } = interactionData;

        // Initialize drag detection for this token
        this.initializeDragDetection(token);

        // Determine what action to take
        const actionData = this.determineAction(interactionData);

        if (actionData.action === 'ignore') {
            debug('Click Manager - Interaction ignored:', actionData.reason);
            return;
        }

        // Execute the determined action
        await this.executeAction(actionData);

        // Update state tracking
        this.updateInteractionState(interactionData);
    }

    /**
     * Determine what action should be taken based on the interaction
     * Implements complex decision logic for menu behavior
     * @param {Object} interactionData - The interaction data
     * @returns {Object} Action data with action type and parameters
     * @private
     */
    determineAction(interactionData) {
        const { type, token, timestamp } = interactionData;

        // Check for race conditions between selection and click events
        if (weaponSystemCoordinator.isProcessingSelection() && type === 'click') {
            return {
                action: 'ignore',
                reason: 'selection in progress',
                type: type
            };
        }

        // Check debounce window
        if (weaponSystemCoordinator.isWithinDebounceWindow()) {
            return {
                action: 'ignore',
                reason: 'within debounce window',
                type: type
            };
        }

        // Check if this was a drag operation
        if (this.wasDragging(token)) {
            return {
                action: 'close_and_cleanup_drag',
                token: token,
                reason: 'was dragging',
                type: type
            };
        }

        // Check basic conditions
        if (!token.controlled ||
            !token.isOwner ||
            canvas.tokens.controlled.length !== 1 ||
            canvas.hud.token.rendered) {
            return {
                action: 'ignore',
                reason: 'basic conditions not met',
                type: type
            };
        }

        const showOnSelection = shouldShowWeaponMenuOnSelection();

        // Handle selection events
        if (type === 'selection') {
            if (!showOnSelection) {
                return {
                    action: 'ignore',
                    reason: 'show on selection disabled',
                    type: type
                };
            }

            return {
                action: 'open_after_close',
                token: token,
                type: type
            };
        }

        // Handle click events (always work regardless of setting)
        if (type === 'click') {
            if (weaponSystemCoordinator.isMenuOpen()) {
                return {
                    action: 'close',
                    token: token,
                    type: type
                };
            } else {
                return {
                    action: 'open',
                    token: token,
                    type: type
                };
            }
        }

        return {
            action: 'ignore',
            reason: 'no matching conditions',
            type: type
        };
    }

    /**
     * Execute the determined action
     * Handles menu opening, closing, and state transitions
     * @param {Object} actionData - The action to execute
     * @param {string} actionData.action - Action type ('open', 'close', etc.)
     * @param {Token} actionData.token - The token involved
     * @param {string} actionData.type - Original interaction type
     * @private
     */
    async executeAction(actionData) {
        const { action, token, type } = actionData;

        switch (action) {
            case 'open':
                await this.openWeaponMenu(token);
                break;

            case 'open_after_close':
                // Mark selection processing ONLY for selection events
                if (type === 'selection') {
                    weaponSystemCoordinator.startSelectionProcessing();
                }

                if (weaponSystemCoordinator.isMenuOpen()) {
                    await this.closeWeaponMenu();
                }

                // Open menu immediately without delay
                await this.openWeaponMenu(token);
                
                // Clear selection processing after menu opens
                if (type === 'selection') {
                    weaponSystemCoordinator.clearSelectionProcessing();
                }
                break;

            case 'close':
                await this.closeWeaponMenu();
                break;

            case 'close_and_cleanup_drag':
                this.resetDragState(token);
                await this.closeWeaponMenu();
                this.stopTokenMovementTracker(token);
                break;

            default:
                console.warn('Token Context Menu: Click Manager - Unknown action:', action);
        }

        // Always reset drag state after processing
        this.resetDragState(token);
    }

    /**
     * Open weapon menu - delegates to existing system
     * Uses dynamic import to avoid circular dependencies
     * @param {Token} token - The token to show the menu for
     * @private
     */
    async openWeaponMenu(token) {
        // Import here to avoid circular dependencies
        const { showWeaponMenuUnderToken } = await import("../utils/weaponMenuDisplay.js");
        await showWeaponMenuUnderToken(token);
    }

    /**
     * Close weapon menu - delegates to centralized closer
     * @private
     */
    async closeWeaponMenu() {
        const { closeWeaponMenu } = await import("../utils/weaponMenuCloser.js");
        return closeWeaponMenu({ reason: 'token-click-manager' });
    }

    /**
     * Initialize drag detection for a token
     * Sets up PIXI event listeners for drag tracking
     * @param {Token} token - The token to track drag for
     * @returns {Object} The drag state object
     * @private
     */
    initializeDragDetection(token) {
        const dragState = tokenDragManager.initializeDragState(token);
        
        // Set up listeners once per token
        if (dragState._listenersSetup) return dragState;
        dragState._listenersSetup = true;

        token.on('pointerdown', (event) => {
            tokenDragManager.startDrag(token, {
                x: event.data.global.x,
                y: event.data.global.y
            });
        });

        token.on('pointermove', (event) => {
            tokenDragManager.updateDragMovement(token, {
                x: event.data.global.x,
                y: event.data.global.y
            }, this.state.dragThresholdPixels);
        });

        token.on('pointerup', () => {
            tokenDragManager.endDrag(token);
        });

        return dragState;
    }

    /**
     * Check if token was being dragged
     * @param {Token} token - The token to check
     * @returns {boolean} True if the token was dragged
     * @private
     */
    wasDragging(token) {
        return tokenDragManager.isDragging(token);
    }

    /**
     * Reset drag state for a token
     * @param {Token} token - The token to reset
     * @private
     */
    resetDragState(token) {
        tokenDragManager.resetDragState(token);
    }

    /**
     * Update interaction state tracking
     * @param {Object} interactionData - The interaction data to track
     * @private
     */
    updateInteractionState(interactionData) {
        this.state.lastInteractionTime = interactionData.timestamp;
        this.state.lastInteractionToken = interactionData.token;
        this.state.lastInteractionType = interactionData.type;
    }

    /**
     * Stop movement tracker for a token (delegates to existing system)
     * @param {Token} token - The token to stop tracking
     * @private
     */
    stopTokenMovementTracker(token) {
        const tickerId = `menu-reshow-${token.id}`;
        weaponSystemCoordinator.removeMovementTracker(tickerId);
    }

    /**
     * Cleanup all event handlers
     * Call this when the module is disabled or during scene teardown
     */
    cleanup() {
        if (this.boundHandlers.handleTokenSelection) {
            Hooks.off("controlToken", this.boundHandlers.handleTokenSelection);
        }

        if (this.state.canvasClickHandler) {
            canvas.stage?.off("pointertap", this.state.canvasClickHandler);
        }

        // Unregister libWrapper hooks
        libWrapper.unregister('tokencontextmenu', 'Token.prototype._onClickLeft');
        libWrapper.unregister('tokencontextmenu', 'Token.prototype._onClickRight');

        // Clear state
        this.state.isCanvasHandlerSetup = false;
        this.state.lastSelectedToken = null;
        this.state.lastMouseButton = null;
    }

    /**
     * Get debug information about current state
     * @returns {Object} Debug information about the manager's state
     */
    getDebugInfo() {
        return {
            lastInteraction: {
                time: this.state.lastInteractionTime,
                token: this.state.lastInteractionToken?.name,
                type: this.state.lastInteractionType
            },
            canvasHandlerSetup: this.state.isCanvasHandlerSetup
        };
    }
}

// Export singleton instance
export const weaponMenuTokenClickManager = new WeaponMenuTokenClickManager();

// Export for debugging
window.tokenContextMenuClickManager = weaponMenuTokenClickManager;