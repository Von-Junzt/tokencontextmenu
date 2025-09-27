import { weaponSystemCoordinator } from "./WeaponSystemCoordinator.js";
import { shouldShowWeaponMenuOnSelection } from "../settings/settings.js";
import { TIMING } from "../utils/constants.js";
import { debug, debugWarn } from "../utils/debug.js";
import { CleanupManager } from "./CleanupManager.js";

/**
 * Centralized handler for all token interactions (Phase 1 refactoring)
 *
 * This class implements the new event handling architecture as specified in
 * docs/REFACTORING_PLAN.md Phase 1. It provides:
 * - Selection-epoch guard (prevents first pointerup after selection from opening menu)
 * - Drag detection using distance-only threshold (5px)
 * - Unified event handling via libWrapper (left-clicks) and PIXI (right-clicks)
 *
 * When enabled via feature flag, this replaces the event handling logic
 * in WeaponMenuTokenClickManager while keeping all visual behavior identical.
 *
 * @extends CleanupManager
 */
export class TokenInteractionHandler extends CleanupManager {
    constructor() {
        super();

        this.instanceId = Math.random().toString(36).substr(2, 9);
        debug(`TokenInteractionHandler instance created: ${this.instanceId}`);

        // Selection epoch tracking - prevents immediate menu open after selection
        // Key: Token, Value: { consumed: boolean, timestamp: number }
        this.selectionEpochs = new WeakMap();

        // Drag detection tracking
        // Key: Token, Value: { startX, startY, isDragging, pointerDownTime }
        this.dragTracking = new WeakMap();

        // Track if handlers are set up
        this.isSetup = false;

        // Store scene ID for change detection
        this._currentSceneId = null;

        // Bound handlers for cleanup
        this.boundHandlers = {
            handleControlToken: this.handleControlToken.bind(this),
            handleRightDown: this.handleRightDown.bind(this)
        };
    }

    /**
     * Initialize all event handlers
     * Called when the feature flag is enabled
     */
    setupEventHandlers() {
        if (this.isSetup) {
            debug('TokenInteractionHandler already set up, skipping');
            return;
        }

        debug('TokenInteractionHandler: Setting up event handlers', { instanceId: this.instanceId });

        // Hook into token control for selection epoch tracking
        this.registerHook('controlToken', this.boundHandlers.handleControlToken);

        // Setup click handlers
        this.setupLibWrapperHandlers();
        this.setupPixiHandlers();

        // Track scene changes
        this._currentSceneId = canvas?.scene?.id || null;

        this.isSetup = true;
        debug('TokenInteractionHandler: Setup complete');
    }

    /**
     * Setup libWrapper handlers for left-clicks
     * Required because Foundry's Token._onClickLeft consumes these events
     */
    setupLibWrapperHandlers() {
        if (!game.modules.get('lib-wrapper')?.active) {
            debugWarn('lib-wrapper not active, cannot setup left-click handlers');
            return;
        }

        const handler = this;
        libWrapper.register('tokencontextmenu', 'Token.prototype._onClickLeft', function(wrapped, event) {
            const token = this;

            // Only handle tokens we own
            if (!token.isOwner) {
                return wrapped.call(this, event);
            }

            debug('TokenInteractionHandler: Left-click intercepted via libWrapper', {
                token: token.name
            });

            // Set up drag and epoch tracking
            handler._setupInteractionTracking(token, event);

            // Continue with normal Foundry selection
            return wrapped.call(this, event);
        }, 'WRAPPER');

        debug('TokenInteractionHandler: libWrapper handlers registered');
    }

    /**
     * Setup PIXI handlers for right-clicks
     * More efficient for right-clicks since Foundry doesn't consume them
     */
    setupPixiHandlers() {
        if (!canvas?.tokens) {
            debug('Canvas tokens layer not ready, deferring PIXI setup');
            return;
        }

        const tokensLayer = canvas.tokens;

        // Right-click handler at layer level
        tokensLayer.on('rightdown', this.boundHandlers.handleRightDown);

        debug('TokenInteractionHandler: PIXI handlers registered');
    }

    /**
     * Handle right-click events via PIXI
     * @param {PIXI.InteractionEvent} event
     */
    handleRightDown(event) {
        // Find the token from the event target
        let token = null;
        let target = event.target;

        // Check if target is already a token
        if (target instanceof foundry.canvas.placeables.Token) {
            token = target;
        } else {
            // Walk up the parent chain to find a token
            while (target && !token) {
                if (target instanceof foundry.canvas.placeables.Token) {
                    token = target;
                    break;
                }
                target = target.parent;
            }
        }

        if (!token || !token.isOwner) return;

        debug('TokenInteractionHandler: Right-click detected', { token: token.name });

        // Right-click always closes the menu
        if (weaponSystemCoordinator.isMenuOpen()) {
            this.closeWeaponMenu();
        }

        // Clear any epoch for this token since right-click resets interaction state
        if (this.selectionEpochs.has(token)) {
            const epoch = this.selectionEpochs.get(token);
            epoch.consumed = true;
        }
    }

    /**
     * Handle token control changes for selection epoch tracking
     * @param {Token} token - The token being controlled/released
     * @param {boolean} controlled - Whether the token is now controlled
     */
    handleControlToken(token, controlled) {
        if (!token.isOwner) return;

        debug('TokenInteractionHandler: Control token event', {
            token: token.name,
            controlled
        });

        if (controlled) {
            // New selection - create epoch
            this.selectionEpochs.set(token, {
                consumed: false,
                timestamp: Date.now()
            });
            debug('TokenInteractionHandler: Created selection epoch for token', {
                token: token.name
            });
        } else {
            // Token deselected - clean up
            this.selectionEpochs.delete(token);
            this.dragTracking.delete(token);
        }
    }

    /**
     * Set up interaction tracking for a token (drag detection and epoch handling)
     * @private
     * @param {Token} token - The token to track
     * @param {PIXI.InteractionEvent} event - The initial click event
     */
    _setupInteractionTracking(token, event) {
        const startX = event.data.global.x;
        const startY = event.data.global.y;
        const wasAlreadySelected = token.controlled &&
                                  weaponSystemCoordinator.isOnlyControlledToken(token);

        debug('TokenInteractionHandler: Setting up interaction tracking', {
            token: token.name,
            wasAlreadySelected,
            startX,
            startY
        });

        // Store drag tracking info
        const dragInfo = {
            startX,
            startY,
            isDragging: false,
            pointerDownTime: Date.now()
        };
        this.dragTracking.set(token, dragInfo);

        // Drag detection handler
        const handler = this;
        const checkDrag = (e) => {
            if (!handler.dragTracking.has(token)) return;

            const info = handler.dragTracking.get(token);
            const dx = Math.abs(e.data.global.x - info.startX);
            const dy = Math.abs(e.data.global.y - info.startY);

            // Check if drag threshold exceeded (5px as per constants)
            if (dx > TIMING.DRAG_THRESHOLD_PIXELS || dy > TIMING.DRAG_THRESHOLD_PIXELS) {
                info.isDragging = true;

                debug('TokenInteractionHandler: Drag detected', {
                    token: token.name,
                    distance: { dx, dy },
                    threshold: TIMING.DRAG_THRESHOLD_PIXELS
                });

                // Close menu immediately on drag if it's open
                if (weaponSystemCoordinator.isMenuOpen()) {
                    handler.closeWeaponMenu();
                }
            }
        };

        // Pointer up handler
        const handlePointerUp = async (e) => {
            // Remove listeners
            token.off('pointermove', checkDrag);
            token.off('pointerup', handlePointerUp);
            token.off('pointerupoutside', handlePointerUp);

            const dragInfo = handler.dragTracking.get(token);
            if (!dragInfo) return;

            const isDragging = dragInfo.isDragging;
            const isCurrentlySelected = token.controlled &&
                                      weaponSystemCoordinator.isOnlyControlledToken(token);

            debug('TokenInteractionHandler: Pointer up', {
                token: token.name,
                wasAlreadySelected,
                isCurrentlySelected,
                isDragging,
                menuOpen: weaponSystemCoordinator.isMenuOpen()
            });

            // Handle based on state
            if (!isDragging && isCurrentlySelected) {
                if (wasAlreadySelected) {
                    // Click on already selected token - toggle menu
                    debug('TokenInteractionHandler: Toggle menu on already selected token');

                    if (weaponSystemCoordinator.isMenuOpen()) {
                        await handler.closeWeaponMenu();
                    } else {
                        await handler.openWeaponMenu(token);
                    }
                } else {
                    // New selection - check epoch and setting
                    const epoch = handler.selectionEpochs.get(token);

                    if (epoch && !epoch.consumed) {
                        // This is the first pointerup after selection - consume it
                        epoch.consumed = true;
                        debug('TokenInteractionHandler: Consumed selection epoch');

                        // But still open menu if setting is enabled
                        // The epoch only prevents the immediate pointerup from the selection itself
                        // We still want to honor the "show on selection" setting
                        if (shouldShowWeaponMenuOnSelection()) {
                            debug('TokenInteractionHandler: Opening menu on new selection (after epoch consumption)');
                            await handler.openWeaponMenu(token);
                        }
                    }
                }
            }

            // Clean up drag tracking
            handler.dragTracking.delete(token);
        };

        // Attach listeners
        token.on('pointermove', checkDrag);
        token.on('pointerup', handlePointerUp);
        token.on('pointerupoutside', handlePointerUp);
    }

    /**
     * Handle canvas ready (scene changes)
     * @override
     */
    handleCanvasReady() {
        const newSceneId = canvas?.scene?.id;
        const wasSceneChange = this._currentSceneId !== null && this._currentSceneId !== newSceneId;

        debug('TokenInteractionHandler: Canvas ready', {
            previousSceneId: this._currentSceneId,
            newSceneId,
            wasSceneChange
        });

        if (wasSceneChange) {
            // Clear all tracking on scene change
            // WeakMaps will auto-cleanup when tokens are GC'd
            this.selectionEpochs = new WeakMap();
            this.dragTracking = new WeakMap();
        }

        this._currentSceneId = newSceneId;

        // Re-setup PIXI handlers if needed (they may be lost on scene change)
        if (this.isSetup) {
            this.setupPixiHandlers();
        }
    }

    /**
     * Open weapon menu - delegates to display utility
     * Uses dynamic import to avoid circular dependencies
     * @param {Token} token - The token to show the menu for
     * @private
     */
    async openWeaponMenu(token) {
        debug('TokenInteractionHandler: Opening weapon menu', { token: token.name });
        const { showWeaponMenuUnderToken } = await import("../utils/weaponMenuDisplay.js");
        await showWeaponMenuUnderToken(token);
    }

    /**
     * Close weapon menu - delegates to centralized closer
     * @private
     */
    async closeWeaponMenu() {
        debug('TokenInteractionHandler: Closing weapon menu');
        const { closeWeaponMenu } = await import("../utils/weaponMenuCloser.js");
        return closeWeaponMenu({ reason: 'token-interaction-handler' });
    }

    /**
     * Clean up all handlers
     * @override
     */
    cleanup() {
        debug('TokenInteractionHandler: Cleaning up');

        // Remove PIXI handlers
        if (canvas?.tokens && this.boundHandlers.handleRightDown) {
            canvas.tokens.off('rightdown', this.boundHandlers.handleRightDown);
        }

        // Remove libWrapper registration
        if (game.modules.get('lib-wrapper')?.active) {
            libWrapper.unregister('tokencontextmenu', 'Token.prototype._onClickLeft');
        }

        // Call parent cleanup for hooks
        super.cleanup();

        this.isSetup = false;

        debug('TokenInteractionHandler: Cleanup complete');
    }
}

// Export singleton instance
export const tokenInteractionHandler = new TokenInteractionHandler();