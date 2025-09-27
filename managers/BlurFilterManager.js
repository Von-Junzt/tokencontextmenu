/**
 * @file Blur filter manager for equipment mode
 * @description Manages blur effects applied to canvas elements during equipment mode
 */

import { CleanupManager } from "./CleanupManager.js";
import { EQUIPMENT_BLUR, ECT_BLUR } from "../utils/constants.js";
import { debug, debugWarn, debugError } from "../utils/debug.js";
import { 
    getEquipmentModeBlurStrength,
    getEquipmentModeBlurQuality
} from "../settings/settings.js";

/**
 * Manages blur filter effects for equipment mode
 * Applies blur to canvas elements (tokens, tiles, background, drawings, notes) except the active token
 * Skips layers that might interfere with UI visibility (effects, foreground, interface)
 * @extends CleanupManager
 */
class BlurFilterManager extends CleanupManager {
    constructor() {
        super();
        
        // Track applied filters for cleanup
        this.appliedFilters = new WeakMap();
        
        // Track blur state
        this.isBlurActive = false;
        
        // Setup hooks for cleanup
        this._setupHooks();
    }
    
    /**
     * Set up hooks for automatic cleanup
     * @private
     */
    _setupHooks() {
        // Clean up on scene change
        this.registerHook('canvasReady', () => {
            if (this.isBlurActive) {
                this.clearEquipmentModeBlur();
            }
        });
    }
    
    /**
     * Apply blur effect to canvas for equipment mode
     * @param {Token} excludeToken - The token to keep in focus
     */
    applyEquipmentModeBlur(excludeToken) {
        if (!canvas?.ready) {
            debugWarn("Cannot apply blur - canvas not ready");
            return;
        }
        
        if (this.isBlurActive) {
            debug("Blur already active, clearing before reapplying");
            this.clearEquipmentModeBlur();
        }
        
        debug("Applying equipment mode blur", {
            excludeTokenId: excludeToken?.id,
            excludeTokenName: excludeToken?.name
        });
        
        // Get blur settings
        const strength = getEquipmentModeBlurStrength();
        const quality = getEquipmentModeBlurQuality();
        
        // Apply blur to different canvas elements
        // We blur: tokens (except active), tiles, background, drawings, and notes
        // We skip: effects (causes token blur), foreground (UI overlays), interface (UI elements)
        this._applyBlurToTokens(excludeToken, strength, quality);
        this._applyBlurToTiles(strength, quality);
        this._applyBlurToBackground(strength, quality);
        this._applyBlurToDrawings(strength, quality);
        this._applyBlurToNotes(strength, quality);
        
        this.isBlurActive = true;
    }
    
    /**
     * Clear all blur filters
     */
    clearEquipmentModeBlur() {
        if (!this.isBlurActive) return;
        
        debug("Clearing equipment mode blur");
        
        // Clear token blurs
        if (canvas?.tokens?.placeables) {
            canvas.tokens.placeables.forEach(token => {
                this._removeBlurFromObject(token.mesh);
            });
        }
        
        // Clear tile blurs
        if (canvas?.tiles?.placeables) {
            canvas.tiles.placeables.forEach(tile => {
                this._removeBlurFromObject(tile.mesh);
            });
        }
        
        // Clear background blur
        if (canvas?.primary?.background) {
            this._removeBlurFromObject(canvas.primary.background);
        }
        
        // Clear drawings blur
        if (canvas?.drawings) {
            this._removeBlurFromObject(canvas.drawings);
        }
        
        // Clear notes blur
        if (canvas?.notes) {
            this._removeBlurFromObject(canvas.notes);
        }
        
        this.isBlurActive = false;
    }
    
    /**
     * Apply blur to all tokens except the excluded one
     * @param {Token} excludeToken - Token to keep in focus
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @private
     */
    _applyBlurToTokens(excludeToken, strength, quality) {
        if (!canvas?.tokens?.placeables) return;
        
        canvas.tokens.placeables.forEach(token => {
            // Skip the excluded token
            if (token.id === excludeToken?.id) {
                debug(`Skipping blur for active token: ${token.name}`);
                return;
            }
            
            // Apply blur to token mesh
            if (token.mesh && !token.mesh.destroyed) {
                this._applyBlurToObject(token.mesh, strength, quality);
            }
        });
    }
    
    /**
     * Apply blur to all tiles
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @private
     */
    _applyBlurToTiles(strength, quality) {
        if (!canvas?.tiles?.placeables) return;
        
        canvas.tiles.placeables.forEach(tile => {
            if (tile.mesh && !tile.mesh.destroyed) {
                this._applyBlurToObject(tile.mesh, strength, quality);
            }
        });
    }
    
    /**
     * Apply blur to canvas background
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @private
     */
    _applyBlurToBackground(strength, quality) {
        if (!canvas?.primary?.background) return;
        
        this._applyBlurToObject(canvas.primary.background, strength, quality);
    }
    
    
    /**
     * Apply blur to drawings layer
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @private
     */
    _applyBlurToDrawings(strength, quality) {
        if (!canvas?.drawings) return;
        
        this._applyBlurToObject(canvas.drawings, strength, quality);
    }
    
    /**
     * Apply blur to notes layer
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @private
     */
    _applyBlurToNotes(strength, quality) {
        if (!canvas?.notes) return;
        
        this._applyBlurToObject(canvas.notes, strength, quality);
    }
    
    /**
     * Apply blur filter to a PIXI display object
     * @param {PIXI.DisplayObject} object - The object to blur
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @private
     */
    _applyBlurToObject(object, strength, quality) {
        if (!object || object.destroyed) return;
        
        // Check if object already has our blur filter
        const hasBlur = object.filters?.some(f => f.name === EQUIPMENT_BLUR.FILTER_NAME);
        if (hasBlur) return;
        
        // Create blur filter
        const blurFilter = this._createBlurFilter(strength, quality);
        
        // Apply filter
        if (!object.filters) {
            object.filters = [blurFilter];
        } else {
            object.filters.push(blurFilter);
        }
        
        // Track for cleanup
        this.appliedFilters.set(object, blurFilter);
        
        debug(`Applied blur to object`, {
            strength,
            quality,
            objectType: object.constructor.name
        });
    }
    
    /**
     * Remove blur filter from a PIXI display object
     * @param {PIXI.DisplayObject} object - The object to unblur
     * @private
     */
    _removeBlurFromObject(object) {
        if (!object || object.destroyed || !object.filters) return;
        
        // Remove our blur filter
        object.filters = object.filters.filter(f => f.name !== EQUIPMENT_BLUR.FILTER_NAME);
        
        // Clean up empty filter array
        if (object.filters.length === 0) {
            object.filters = null;
        }
        
        // Remove from tracking
        this.appliedFilters.delete(object);
    }
    
    /**
     * Apply blur to weapon containers except the active one (for ECT menu)
     * @param {PIXI.Container} activeContainer - The container to keep active
     * @param {Array<PIXI.Container>} allContainers - All weapon containers
     */
    applyECTWeaponBlur(activeContainer, allContainers) {
        if (!allContainers || allContainers.length === 0) return;

        debug("Applying ECT weapon blur", {
            activeContainer: !!activeContainer,
            containerCount: allContainers.length
        });

        allContainers.forEach(container => {
            if (container !== activeContainer && container && !container.destroyed) {
                // Create and apply blur filter
                const blurFilter = this._createBlurFilter(
                    ECT_BLUR.BLUR_STRENGTH,
                    ECT_BLUR.BLUR_QUALITY,
                    ECT_BLUR.FILTER_NAME
                );

                // Create and apply desaturation filter (PixiJS v7+)
                const colorMatrix = new PIXI.ColorMatrixFilter();
                // Use saturate method (0 = no change, negative = desaturate, -1 = grayscale)
                colorMatrix.saturate(-ECT_BLUR.DESATURATION_AMOUNT);
                colorMatrix.name = `${ECT_BLUR.FILTER_NAME}-desaturate`;

                container.filters = container.filters || [];
                container.filters.push(blurFilter, colorMatrix);
                this.appliedFilters.set(container, [blurFilter, colorMatrix]);

                // Store original state
                container._ectBlurState = {
                    wasInteractive: container.interactive,
                    originalAlpha: container.alpha || ECT_BLUR.ACTIVE_ALPHA
                };

                // Apply dimming and disable interaction
                container.alpha = ECT_BLUR.INACTIVE_ALPHA;
                container.interactive = false;
            }
        });
    }

    /**
     * Clear ECT weapon blur effects
     * @param {Array<PIXI.Container>} containers - Containers to restore
     */
    clearECTWeaponBlur(containers) {
        if (!containers) return;

        debug("Clearing ECT weapon blur", {
            containerCount: containers.length
        });

        containers.forEach(container => {
            if (container && container._ectBlurState) {
                // Remove ECT blur and desaturation filters
                if (container.filters) {
                    container.filters = container.filters.filter(f =>
                        f.name !== ECT_BLUR.FILTER_NAME &&
                        f.name !== `${ECT_BLUR.FILTER_NAME}-desaturate`
                    );

                    // Clean up empty filter array
                    if (container.filters.length === 0) {
                        container.filters = null;
                    }
                }

                // Restore original state
                container.alpha = container._ectBlurState.originalAlpha;
                container.interactive = container._ectBlurState.wasInteractive;
                delete container._ectBlurState;
            }
        });
    }

    /**
     * Create a PIXI blur filter (PixiJS v7+)
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @param {string} [filterName] - Optional filter name override
     * @returns {PIXI.BlurFilter} The blur filter
     * @private
     */
    _createBlurFilter(strength, quality, filterName = null) {
        const filter = new PIXI.BlurFilter(strength, quality);
        filter.name = filterName || EQUIPMENT_BLUR.FILTER_NAME;
        return filter;
    }

    /**
     * Clean up resources
     * @override
     */
    destroy() {
        // Clear any active blur
        this.clearEquipmentModeBlur();

        // Clear references
        this.appliedFilters = new WeakMap();

        // Call parent cleanup
        super.destroy();
    }
}

// Export singleton instance
export const blurFilterManager = new BlurFilterManager();