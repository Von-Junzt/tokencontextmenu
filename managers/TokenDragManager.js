import { CleanupManager } from "./CleanupManager.js";
import { DRAG } from "../utils/constants.js";

/**
 * Manages token drag states for the weapon menu system
 * 
 * @class TokenDragManager
 * @extends {CleanupManager}
 * @description Tracks pointer/mouse movements on tokens to distinguish between clicks
 * and drags. This is essential for determining when to show the weapon menu (click)
 * versus when to hide it (drag). Uses WeakMap to automatically clean up when tokens
 * are destroyed.
 * 
 * @example
 * // Initialize tracking for a token
 * const dragState = tokenDragManager.initializeDragState(token);
 * 
 * // Start tracking on pointer down
 * tokenDragManager.startDrag(token, {x: event.x, y: event.y});
 * 
 * // Update on pointer move
 * const hasMoved = tokenDragManager.updateDragMovement(token, {x: event.x, y: event.y}, 5);
 * if (hasMoved) {
 *     console.log('Token is being dragged');
 * }
 * 
 * @property {WeakMap} dragStates - Maps tokens to their drag state objects
 */
class TokenDragManager extends CleanupManager {
    constructor() {
        super();
        
        // WeakMap to store drag state per token without memory leaks
        this.dragStates = new WeakMap();
        
        // Note: No state to track with StateManager since we use WeakMap
        // which auto-cleans when tokens are garbage collected
        
        this._setupHooks();
    }
    
    /**
     * Set up hooks for drag tracking
     * @private
     */
    _setupHooks() {
        // No additional hooks needed - handleCanvasReady is automatic
    }
    
    /**
     * Override handleCanvasReady from CleanupManager
     */
    handleCanvasReady() {
        this.clearAll();
    }
    
    /**
     * Initialize drag state for a token
     * @param {Token} token - The token to initialize
     * @returns {Object} The drag state object
     */
    initializeDragState(token) {
        if (!this.dragStates.has(token)) {
            this.dragStates.set(token, {
                isDragging: false,
                startCoords: null,
                hasMoved: false,
                _listenersSetup: false
            });
        }
        return this.dragStates.get(token);
    }
    
    /**
     * Get drag state for a token
     * @param {Token} token - The token to get state for
     * @returns {Object|undefined} The drag state or undefined
     */
    getDragState(token) {
        return this.dragStates.get(token);
    }
    
    /**
     * Update drag state for a token
     * @param {Token} token 
     * @param {Object} changes 
     */
    updateDragState(token, changes) {
        const state = this.dragStates.get(token);
        if (state) {
            Object.assign(state, changes);
        }
    }
    
    /**
     * Start dragging for a token
     * @param {Token} token 
     * @param {Object} startCoords 
     */
    startDrag(token, startCoords) {
        const state = this.initializeDragState(token);
        state.isDragging = true;
        state.startCoords = startCoords;
        state.hasMoved = false;
    }
    
    /**
     * Update drag movement
     * @param {Token} token 
     * @param {Object} currentCoords 
     * @param {number} threshold 
     * @returns {boolean} Whether token has moved beyond threshold
     */
    updateDragMovement(token, currentCoords, threshold = DRAG.DEFAULT_THRESHOLD) {
        const state = this.dragStates.get(token);
        if (!state || !state.isDragging || !state.startCoords) return false;
        
        const distance = Math.sqrt(
            Math.pow(currentCoords.x - state.startCoords.x, 2) +
            Math.pow(currentCoords.y - state.startCoords.y, 2)
        );
        
        if (distance > threshold) {
            state.hasMoved = true;
        }
        
        return state.hasMoved;
    }
    
    /**
     * End dragging for a token
     * @param {Token} token 
     * @returns {boolean} Whether the token moved during drag
     */
    endDrag(token) {
        const state = this.dragStates.get(token);
        if (!state) return false;
        
        const hasMoved = state.hasMoved;
        this.resetDragState(token);
        return hasMoved;
    }
    
    /**
     * Reset drag state for a token
     * @param {Token} token 
     */
    resetDragState(token) {
        const state = this.dragStates.get(token);
        if (state) {
            state.isDragging = false;
            state.hasMoved = false;
            state.startCoords = null;
        }
    }
    
    /**
     * Check if token is currently being dragged
     * @param {Token} token 
     * @returns {boolean}
     */
    isDragging(token) {
        const state = this.dragStates.get(token);
        return state?.isDragging || false;
    }
    
    /**
     * Check if token has moved during current drag
     * @param {Token} token 
     * @returns {boolean}
     */
    hasMoved(token) {
        const state = this.dragStates.get(token);
        return state?.hasMoved || false;
    }
    
    /**
     * Clear all drag states
     */
    clearAll() {
        this.dragStates = new WeakMap();
    }
    
    /**
     * Get debug info for a token
     * @param {Token} token 
     * @returns {Object|null}
     */
    getDebugInfo(token) {
        const state = this.dragStates.get(token);
        if (!state) return null;
        
        return {
            isDragging: state.isDragging,
            hasMoved: state.hasMoved,
            hasStartCoords: !!state.startCoords
        };
    }
    
    /**
     * Cleanup when module is disabled
     */
    cleanup() {
        // Clear all drag states
        this.clearAll();
        
        // Call parent cleanup
        super.cleanup();
    }
}

// Export singleton instance
export const tokenDragManager = new TokenDragManager();