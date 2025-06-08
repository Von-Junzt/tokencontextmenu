import { weaponSystemCoordinator } from "./WeaponSystemCoordinator.js";
import { tokenDragManager } from "./TokenDragManager.js";
import { shouldShowWeaponMenuOnSelection } from "../settings/settings.js";
import { TIMING } from "../utils/constants.js";
import { debug } from "../utils/debug.js";
import { tickerDelay } from "../utils/timingUtils.js";

/**
 * Centralized manager for all token click interactions related to weapon menus
 * Consolidates logic from tokenEventHandlers.js and prevents race conditions
 */
export class WeaponMenuTokenClickManager {
    constructor() {
        this.instanceId = Math.random().toString(36).substr(2, 9);
        // Log instance creation to help debug singleton issues
        console.warn(`[VJ TCM] WeaponMenuTokenClickManager instance created: ${this.instanceId}`);
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
            isCanvasHandlerSetup: false,
            
            // Token selection tracking - for cleanup only
            controlledTokens: new Set(),
            
            // Active drag tracking
            activeDrags: new WeakMap(),
            
            // Track token event listeners added by interaction setup
            interactionListeners: new WeakMap(),
            
            // Menu delay ID for cancellation
            menuDelayId: null
        };

        // Track token event listeners for cleanup
        this._tokenListeners = new WeakMap();

        // Don't setup handlers in constructor - let the calling code decide when
        this.boundHandlers = {
            handleTokenSelection: this.handleTokenSelection.bind(this)
        };
    }

    /**
     * Initialize all event handlers - call this from the main init
     * 
     * ARCHITECTURE NOTE: This module uses a hybrid event handling approach:
     * - libWrapper for left-clicks (required - Foundry consumes these events)
     * - PIXI for right-clicks (optimal - these propagate normally)
     * 
     * This is NOT a workaround but the optimal solution for Foundry VTT.
     * See docs/EVENT_HANDLING.md for detailed explanation.
     * 
     * @public
     */
    setupEventHandlers() {
        debug('Setting up all event handlers', { instanceId: this.instanceId });
        
        // Use controlToken hook only for cleanup tracking
        if (this.boundHandlers.handleTokenSelection) {
            Hooks.on("controlToken", this.boundHandlers.handleTokenSelection);
            debug('Registered controlToken hook');
        }

        // Setup optimized click detection:
        // - PIXI for right-clicks (works reliably)  
        // - libWrapper for left-clicks (PIXI doesn't catch these)
        this.setupPixiClickHandlers();
        this.setupTokenInterceptors();
        
        debug('Event handlers setup complete');
        
        // Store the current scene ID on the instance to persist between handler calls
        this._currentSceneId = canvas?.scene?.id || null;
        
        // Store hook handler references for cleanup
        this._canvasReadyHandler = () => {
            const newSceneId = canvas?.scene?.id;
            const wasSceneChange = this._currentSceneId !== null && this._currentSceneId !== newSceneId;
            
            debug('Canvas ready handler:', {
                previousSceneId: this._currentSceneId,
                newSceneId: newSceneId,
                wasSceneChange: wasSceneChange,
                instanceId: this.instanceId
            });
            
            if (wasSceneChange) {
                debug('Scene changed, clearing state');
                this.state.controlledTokens.clear();
                this.state.activeDrags.clear();
                // Cancel any pending menu open
                if (this.state.menuDelayId) {
                    tickerDelay.cancel(this.state.menuDelayId);
                    this.state.menuDelayId = null;
                }
                // Clean up all token listeners on scene change
                if (canvas?.tokens?.placeables) {
                    canvas.tokens.placeables.forEach(token => {
                        this.cleanupTokenListeners(token);
                    });
                }
            } else {
                debug('Canvas ready but same scene or initial load, keeping state');
            }
            
            // Always update the current scene ID
            this._currentSceneId = newSceneId;
        };
        
        this._deleteTokenHandler = (tokenDocument) => {
            const token = tokenDocument.object;
            if (token) {
                this.cleanupTokenListeners(token);
                this.state.controlledTokens.delete(token);
                this.state.activeDrags.delete(token);
            }
        };
        
        // Register the hooks
        Hooks.on('canvasReady', this._canvasReadyHandler);
        Hooks.on('deleteToken', this._deleteTokenHandler);
    }

    /**
     * Setup PIXI-based click handlers for right-clicks only
     * 
     * Why this approach:
     * - Right-clicks propagate through PIXI reliably because Foundry doesn't consume them
     * - Left-clicks MUST use libWrapper because Token._onClickLeft consumes the event
     * - This hybrid approach is the most performant solution
     * 
     * @private
     */
    setupPixiClickHandlers() {
        if (this.state.isCanvasHandlerSetup || !canvas?.stage) return;

        debug('setupPixiClickHandlers: Setting up PIXI right-click handler');

        const tokensLayer = canvas.tokens;
        if (!tokensLayer) {
            debug('Tokens layer not ready, deferring setup');
            return;
        }

        // Right click handler - PIXI works reliably for right-clicks
        // This is more efficient than libWrapper for right-clicks since
        // we can handle it at the layer level rather than per-token
        this._handleRightDown = (event) => {
            // Check if the event target is a token or child of a token
            let token = null;
            if (event.target instanceof Token) {
                token = event.target;
            } else if (event.target?.parent instanceof Token) {
                token = event.target.parent;
            } else {
                // Walk up the parent chain to find a token (for deep children)
                let parent = event.target?.parent;
                while (parent && !(parent instanceof Token)) {
                    parent = parent.parent;
                }
                if (parent instanceof Token) {
                    token = parent;
                }
            }
            
            if (!token || !token.isOwner) return;
            
            debug('Right-click intercepted via PIXI', { token: token.name });
            
            // Cancel any pending menu operations
            if (this.state.menuDelayId) {
                tickerDelay.cancel(this.state.menuDelayId);
                this.state.menuDelayId = null;
            }
            
            // Close menu if open
            if (weaponSystemCoordinator.isMenuOpen()) {
                this.closeWeaponMenu();
            }
        };

        // Only register right-click handler at the layer level
        // This is more efficient than adding listeners to individual tokens
        tokensLayer.interactiveChildren = true;
        tokensLayer.on('rightdown', this._handleRightDown);
        this.state.isCanvasHandlerSetup = true;
        
        debug('setupPixiClickHandlers: PIXI right-click handler attached');

        // Re-setup on scene changes
        if (!this._canvasReadyResetHandler) {
            this._canvasReadyResetHandler = () => {
                this.state.isCanvasHandlerSetup = false;
                this.setupPixiClickHandlers();
            };
            Hooks.on('canvasReady', this._canvasReadyResetHandler);
        }
    }

    // Removed _getTokenFromEvent - token detection now handled inline in event handlers
    
    /**
     * Setup libWrapper for left-click interception
     * PIXI doesn't catch left-clicks reliably on tokens due to Foundry's event consumption,
     * so we use libWrapper for those. This is the most performant approach.
     * @private
     */
    setupTokenInterceptors() {
        const manager = this;
        
        debug('setupTokenInterceptors: Registering libWrapper for left-clicks only');
        
        // Only intercept left clicks - right clicks are handled reliably by PIXI
        // This is necessary because Foundry's Token._onClickLeft consumes the event
        // before PIXI listeners can process it
        libWrapper.register('tokencontextmenu', 'Token.prototype._onClickLeft', function(wrapped, event) {
            const token = this;
            
            // Early exit if not owner to reduce overhead
            if (!token.isOwner) {
                return wrapped.call(this, event);
            }
            
            debug('Left-click intercepted via libWrapper', { token: token.name });
            
            // Set up our interaction handling
            manager._setupTokenInteraction(token, event, 'libWrapper');
            
            // Continue with normal Foundry selection
            // This ensures we don't break Foundry's selection logic
            return wrapped.call(this, event);
        }, 'WRAPPER');
        
        debug('Token interceptors registered successfully');
    }

    /**
     * Setup interaction handling for a token on left click
     * @private
     * @param {Token} token - The token to set up interaction for
     * @param {PIXI.InteractionEvent} event - The click event
     * @param {string} [source='unknown'] - The source of the call (PIXI or libWrapper)
     */
    _setupTokenInteraction(token, event, source = 'unknown') {
        const startX = event.data.global.x;
        const startY = event.data.global.y;
        const isAlreadySelected = token.controlled && 
                                weaponSystemCoordinator.isOnlyControlledToken(token);
        
        debug('Setting up token interaction', {
            token: token.name,
            isAlreadySelected,
            startX,
            startY,
            source
        });
        
        // Store drag tracking info
        const dragInfo = {
            token: token,
            startX: startX,
            startY: startY,
            isDragging: false,
            isAlreadySelected: isAlreadySelected,
            timestamp: Date.now()
        };
        
        this.state.activeDrags.set(token, dragInfo);
        
        const checkDrag = (e) => {
            const dx = Math.abs(e.data.global.x - startX);
            const dy = Math.abs(e.data.global.y - startY);
            if (dx > TIMING.DRAG_THRESHOLD_PIXELS || dy > TIMING.DRAG_THRESHOLD_PIXELS) {
                dragInfo.isDragging = true;
                
                // Close menu immediately when drag is detected on already selected token
                if (isAlreadySelected && weaponSystemCoordinator.isMenuOpen()) {
                    debug('DRAG DETECTED: Closing menu immediately', {
                        dragDistance: { dx: dx, dy: dy },
                        threshold: TIMING.DRAG_THRESHOLD_PIXELS
                    });
                    this.closeWeaponMenu();
                }
                
                // Cancel any pending menu open
                if (this.state.menuDelayId) {
                    tickerDelay.cancel(this.state.menuDelayId);
                    this.state.menuDelayId = null;
                }
            }
        };
        
        const handleMouseUp = async (e) => {
            const wasAlreadySelected = dragInfo.isAlreadySelected;
            const isCurrentlySelected = token.controlled && 
                                      weaponSystemCoordinator.isOnlyControlledToken(token);
            
            debug('Mouse up detected - evaluating action', {
                token: token.name,
                isDragging: dragInfo.isDragging,
                wasAlreadySelected,
                isCurrentlySelected,
                menuOpen: weaponSystemCoordinator.isMenuOpen(),
                setting: shouldShowWeaponMenuOnSelection()
            });
            
            token.off('pointermove', checkDrag);
            token.off('pointerup', handleMouseUp);
            token.off('pointerupoutside', handleMouseUp);
            
            // Handle interaction based on state
            if (!dragInfo.isDragging) {
                if (wasAlreadySelected && isCurrentlySelected) {
                    // Click on already selected token - toggle menu
                    debug('ACTION: Toggle menu on already selected token', {
                        currentMenuState: weaponSystemCoordinator.isMenuOpen() ? 'open' : 'closed',
                        newMenuState: weaponSystemCoordinator.isMenuOpen() ? 'closing' : 'opening'
                    });
                    if (weaponSystemCoordinator.isMenuOpen()) {
                        await this.closeWeaponMenu();
                    } else {
                        await this.openWeaponMenu(token);
                    }
                } else if (!wasAlreadySelected && isCurrentlySelected && shouldShowWeaponMenuOnSelection()) {
                    // New selection with setting enabled - open menu after delay
                    debug('ACTION: New selection - will open menu after drag check', {
                        delayMs: TIMING.DRAG_DETECTION_DELAY,
                        settingEnabled: true
                    });
                    this.state.menuDelayId = tickerDelay.delay(async () => {
                        if (!dragInfo.isDragging && 
                            weaponSystemCoordinator.getControlledTokens().includes(token)) {
                            debug('ACTION: Opening menu - no drag detected during delay');
                            await this.openWeaponMenu(token);
                        }
                        this.state.menuDelayId = null;
                    }, TIMING.DRAG_DETECTION_DELAY, 'menuOpenDelay');
                }
            }
            
            // Clear drag tracking
            this.state.activeDrags.delete(token);
        };
        
        // Use the token's event handlers
        token.on('pointermove', checkDrag);
        token.on('pointerup', handleMouseUp);
        token.on('pointerupoutside', handleMouseUp);
        
        // Store listeners for cleanup
        this.state.interactionListeners.set(token, {
            pointermove: checkDrag,
            pointerup: handleMouseUp,
            pointerupoutside: handleMouseUp
        });
    }


    /**
     * Handle token selection events (from controlToken hook)
     * Now only used for tracking controlled tokens for cleanup
     * @param {Token} token - The token being selected/deselected
     * @param {boolean} controlled - Whether the token is now controlled
     */
    async handleTokenSelection(token, controlled) {
        debug('handleTokenSelection called:', { 
            token: token.name, 
            controlled,
            instanceId: this.instanceId
        });
        
        if (!controlled) {
            // Handle deselection - clean up
            this.state.controlledTokens.delete(token);
            this.cleanupTokenListeners(token);
            
            // Close menu if no tokens are selected
            if (this.state.controlledTokens.size === 0 && weaponSystemCoordinator.isMenuOpen()) {
                await this.closeWeaponMenu();
            }
        } else {
            // Track controlled token
            this.state.controlledTokens.add(token);
            
            // Close menu if multiple tokens are selected
            if (this.state.controlledTokens.size > 1 && weaponSystemCoordinator.isMenuOpen()) {
                await this.closeWeaponMenu();
            }
        }
    }

    // Note: Removed handleTokenLeftClick and handleTokenRightClick methods
    // These were intended for a different architecture and are not called anywhere

    // Removed processTokenInteraction, determineAction, and executeAction methods
    // These are no longer needed with PIXI-first approach

    /**
     * Open weapon menu - delegates to existing system
     * Uses dynamic import to avoid circular dependencies
     * @param {Token} token - The token to show the menu for
     * @private
     */
    async openWeaponMenu(token) {
        debug('openWeaponMenu called', { token: token.name });
        // Import here to avoid circular dependencies
        const { showWeaponMenuUnderToken } = await import("../utils/weaponMenuDisplay.js");
        await showWeaponMenuUnderToken(token);
    }

    /**
     * Close weapon menu - delegates to centralized closer
     * @private
     */
    async closeWeaponMenu() {
        debug('closeWeaponMenu called from token-click-manager');
        const { closeWeaponMenu } = await import("../utils/weaponMenuCloser.js");
        return closeWeaponMenu({ reason: 'token-click-manager' });
    }

    // Removed drag detection methods - now handled inline in PIXI handlers

    /**
     * Clean up event listeners from a specific token
     * @param {Token} token - The token to clean up
     */
    cleanupTokenListeners(token) {
        // Clean up old-style listeners
        const listeners = this._tokenListeners.get(token);
        if (listeners) {
            Object.entries(listeners).forEach(([event, handler]) => {
                token.off(event, handler);
            });
            this._tokenListeners.delete(token);
        }
        
        // Clean up interaction listeners
        const interactionListeners = this.state.interactionListeners.get(token);
        if (interactionListeners) {
            Object.entries(interactionListeners).forEach(([event, handler]) => {
                token.off(event, handler);
            });
            this.state.interactionListeners.delete(token);
        }
        
        if (listeners || interactionListeners) {
            debug('Cleaned up listeners for token:', token.name);
        }
    }

    /**
     * Cleanup all event handlers
     * Call this when the module is disabled or during scene teardown
     */
    cleanup() {
        // Remove hook handlers
        if (this.boundHandlers.handleTokenSelection) {
            Hooks.off("controlToken", this.boundHandlers.handleTokenSelection);
        }
        
        if (this._canvasReadyHandler) {
            Hooks.off('canvasReady', this._canvasReadyHandler);
            this._canvasReadyHandler = null;
        }
        
        if (this._deleteTokenHandler) {
            Hooks.off('deleteToken', this._deleteTokenHandler);
            this._deleteTokenHandler = null;
        }

        // Note: Removed old canvasClickHandler cleanup - no longer used

        // Cancel any pending menu operations
        if (this.state.menuDelayId) {
            tickerDelay.cancel(this.state.menuDelayId);
            this.state.menuDelayId = null;
        }

        // Clean up all token listeners
        if (canvas?.tokens?.placeables) {
            canvas.tokens.placeables.forEach(token => {
                this.cleanupTokenListeners(token);
            });
        }

        // Remove PIXI event listeners
        if (canvas?.tokens && this._handleRightDown) {
            canvas.tokens.off('rightdown', this._handleRightDown);
            this._handleRightDown = null;
        }
        
        // Remove canvas ready handler for PIXI re-setup
        if (this._canvasReadyResetHandler) {
            Hooks.off('canvasReady', this._canvasReadyResetHandler);
            this._canvasReadyResetHandler = null;
        }
        
        // Unregister libWrapper hooks
        libWrapper.unregister('tokencontextmenu', 'Token.prototype._onClickLeft');

        // Clear state
        this.state.isCanvasHandlerSetup = false;
        this.state.controlledTokens.clear();
        this.state.activeDrags.clear();
        this.state.interactionListeners = new WeakMap();
    }

    /**
     * Get debug information about current state
     * @returns {Object} Debug information about the manager's state
     */
    getDebugInfo() {
        return {
            instanceId: this.instanceId,
            controlledTokens: Array.from(this.state.controlledTokens).map(t => ({
                name: t.name,
                id: t.id
            })),
            activeDrags: Array.from(this.state.activeDrags.entries()).map(([token, drag]) => ({
                token: token.name,
                isDragging: drag.isDragging,
                timestamp: drag.timestamp
            })),
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
window.tokenContextMenuDebug = () => weaponMenuTokenClickManager.getDebugInfo();