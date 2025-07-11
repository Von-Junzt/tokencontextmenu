/**
 * @file Blur filter manager for equipment mode
 * @description Manages blur effects applied to canvas elements during equipment mode
 */

import { CleanupManager } from "./CleanupManager.js";
import { EQUIPMENT_BLUR } from "../utils/constants.js";
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
     * Create a PIXI blur filter
     * @param {number} strength - Blur strength
     * @param {number} quality - Blur quality
     * @returns {PIXI.filters.BlurFilter} The blur filter
     * @private
     */
    _createBlurFilter(strength, quality) {
        const filter = new PIXI.filters.BlurFilter(strength, quality);
        filter.name = EQUIPMENT_BLUR.FILTER_NAME;
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