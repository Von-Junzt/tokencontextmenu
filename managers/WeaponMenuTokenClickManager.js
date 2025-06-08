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
     * Sets up PIXI-based click detection and token cleanup hooks
     */
    setupEventHandlers() {
        debug('Setting up all event handlers', { instanceId: this.instanceId });
        
        // Use controlToken hook only for cleanup tracking
        if (this.boundHandlers.handleTokenSelection) {
            Hooks.on("controlToken", this.boundHandlers.handleTokenSelection);
            debug('Registered controlToken hook');
        }

        // Setup PIXI-based click detection
        this.setupPixiClickHandlers();
        
        // Also setup token-level interceptors as backup
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
     * Setup PIXI-based click handlers for direct token interaction
     * Handles both left and right clicks without relying on Foundry's selection system
     * @private
     */
    setupPixiClickHandlers() {
        if (this.state.isCanvasHandlerSetup || !canvas?.stage) {
            debug('Skipping PIXI setup', { 
                isAlreadySetup: this.state.isCanvasHandlerSetup, 
                hasCanvas: !!canvas?.stage 
            });
            return;
        }

        debug('setupPixiClickHandlers: Starting PIXI event setup');

        // We need to add listeners to the tokens layer, not the stage
        // The stage is too high level and events get consumed by tokens
        const tokensLayer = canvas.tokens;
        if (!tokensLayer) {
            debug('Tokens layer not ready, deferring setup');
            return;
        }

        // Left click handler - use interactive mode
        this._handlePointerDown = (event) => {
            // Only handle events that originate from tokens
            if (event.target instanceof Token || event.target?.parent instanceof Token) {
                const token = event.target instanceof Token ? event.target : event.target.parent;
                if (!token || !token.isOwner) return;

                const button = event.data.button;
                debug('Click intercepted via PIXI pointerdown', { token: token.name, button, method: 'PIXI' });
                
                if (button === 0) {
                    // Left click - set up drag detection and potential menu handling
                    this._setupTokenInteraction(token, event);
                }
                // Right click (button 2) - let Foundry handle selection, no menu
            }
        };

        // Right click specific handler
        this._handleRightDown = (event) => {
            if (event.target instanceof Token || event.target?.parent instanceof Token) {
                const token = event.target instanceof Token ? event.target : event.target.parent;
                if (!token || !token.isOwner) return;
                
                debug('Right-click intercepted via PIXI rightdown', { token: token.name, method: 'PIXI' });
                
                // Cancel any pending menu operations
                if (this.state.menuDelayId) {
                    tickerDelay.cancel(this.state.menuDelayId);
                    this.state.menuDelayId = null;
                }
                
                // Close menu if open
                if (weaponSystemCoordinator.isMenuOpen()) {
                    this.closeWeaponMenu();
                }
            }
        };

        // Add listeners to tokens layer with interactive children enabled
        tokensLayer.interactiveChildren = true;
        tokensLayer.on('pointerdown', this._handlePointerDown);
        tokensLayer.on('rightdown', this._handleRightDown);
        this.state.isCanvasHandlerSetup = true;
        
        debug('setupPixiClickHandlers: PIXI event handlers attached to tokens layer');

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
     * Setup token-level click interceptors using libWrapper
     * This ensures we catch clicks even if PIXI events don't propagate properly
     * @private
     */
    setupTokenInterceptors() {
        const manager = this;  // Capture reference for use in wrapped functions
        
        debug('setupTokenInterceptors: Registering libWrapper hooks for Token click methods');
        
        // Intercept Token._onClickLeft to handle left clicks
        libWrapper.register('tokencontextmenu', 'Token.prototype._onClickLeft', function(wrapped, event) {
            const token = this;
            debug('Click intercepted via libWrapper Token._onClickLeft', { token: token.name, method: 'libWrapper' });
            
            // Set up our interaction handling
            manager._setupTokenInteraction(token, event);
            
            // Continue with normal Foundry selection
            return wrapped.call(this, event);
        }, 'WRAPPER');
        
        // Intercept Token._onClickRight to handle right clicks
        libWrapper.register('tokencontextmenu', 'Token.prototype._onClickRight', function(wrapped, event) {
            const token = this;
            debug('Right-click intercepted via libWrapper Token._onClickRight', { token: token.name, method: 'libWrapper' });
            
            // Cancel any pending menu operations
            if (manager.state.menuDelayId) {
                tickerDelay.cancel(manager.state.menuDelayId);
                manager.state.menuDelayId = null;
            }
            
            // Close menu if open
            if (weaponSystemCoordinator.isMenuOpen()) {
                manager.closeWeaponMenu();
            }
            
            // Continue with normal right-click behavior
            return wrapped.call(this, event);
        }, 'WRAPPER');
        
        debug('Token interceptors registered successfully');
    }

    /**
     * Setup interaction handling for a token on left click
     * @private
     */
    _setupTokenInteraction(token, event) {
        const startX = event.data.global.x;
        const startY = event.data.global.y;
        const isAlreadySelected = token.controlled && 
                                weaponSystemCoordinator.isOnlyControlledToken(token);
        
        debug('Setting up token interaction', {
            token: token.name,
            isAlreadySelected,
            startX,
            startY,
            source: 'Called from click handler'
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
        if (canvas?.tokens) {
            if (this._handlePointerDown) {
                canvas.tokens.off('pointerdown', this._handlePointerDown);
                this._handlePointerDown = null;
            }
            if (this._handleRightDown) {
                canvas.tokens.off('rightdown', this._handleRightDown);
                this._handleRightDown = null;
            }
        }
        
        // Remove canvas ready handler for PIXI re-setup
        if (this._canvasReadyResetHandler) {
            Hooks.off('canvasReady', this._canvasReadyResetHandler);
            this._canvasReadyResetHandler = null;
        }
        
        // Unregister libWrapper hooks - libWrapper handles cases where hooks aren't registered
        libWrapper.unregister('tokencontextmenu', 'Token.prototype._onClickLeft');
        libWrapper.unregister('tokencontextmenu', 'Token.prototype._onClickRight');

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