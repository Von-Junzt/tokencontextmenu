/**
 * @file State management mixin for consistent state handling
 * @description Provides state initialization, reset, and update functionality
 * for manager classes that need to maintain state
 */

/**
 * Mixin for state management functionality
 * 
 * @mixin StateManager
 * @description Provides consistent state management patterns:
 * - Deep cloning of initial state for reset functionality
 * - Safe state updates with Foundry's mergeObject
 * - State reset to initial values
 * 
 * Usage:
 * 1. Apply mixin to class: Object.assign(MyClass.prototype, StateManager)
 * 2. Call initializeState() in constructor with initial state
 * 3. Use updateState() for partial updates
 * 4. Use resetState() to restore initial state
 * 
 * @example
 * class MyManager extends CleanupManager {
 *     constructor() {
 *         super();
 *         this.initializeState({
 *             isActive: false,
 *             currentToken: null,
 *             settings: { autoOpen: true }
 *         });
 *     }
 *     
 *     activate(token) {
 *         this.updateState({
 *             isActive: true,
 *             currentToken: token
 *         });
 *     }
 *     
 *     reset() {
 *         this.resetState();
 *     }
 * }
 * Object.assign(MyManager.prototype, StateManager);
 */
export const StateManager = {
    /**
     * Initialize state with deep cloned initial values
     * Should be called in constructor
     * @param {Object} initialState - Initial state object
     */
    initializeState(initialState) {
        // Store deep clone of initial state for reset
        this._initialState = foundry.utils.deepClone(initialState);
        // Set current state to deep clone
        this.state = foundry.utils.deepClone(initialState);
    },
    
    /**
     * Reset state to initial values
     * Useful for scene changes or cleanup
     */
    resetState() {
        this.state = foundry.utils.deepClone(this._initialState);
    },
    
    /**
     * Update state with partial changes
     * Uses Foundry's mergeObject for safe deep merging
     * @param {Object} changes - Partial state changes to apply
     * @param {Object} options - Merge options
     * @param {boolean} options.insertKeys - Whether to insert new keys (default: true)
     * @param {boolean} options.insertValues - Whether to insert new array values (default: true)
     * @param {boolean} options.overwrite - Whether to overwrite existing values (default: true)
     * @param {boolean} options.recursive - Whether to merge recursively (default: true)
     * @param {boolean} options.inplace - Whether to modify in place (default: true)
     */
    updateState(changes, options = {}) {
        const defaults = {
            insertKeys: true,
            insertValues: true,
            overwrite: true,
            recursive: true,
            inplace: true
        };
        foundry.utils.mergeObject(this.state, changes, { ...defaults, ...options });
    },
    
    /**
     * Get a deep clone of current state
     * Useful when you need to pass state without risk of modification
     * @returns {Object} Deep clone of current state
     */
    getStateCopy() {
        return foundry.utils.deepClone(this.state);
    },
    
    /**
     * Check if state has a specific value at a path
     * @param {string} path - Dot-notation path (e.g., "settings.autoOpen")
     * @param {*} value - Value to check for
     * @returns {boolean} True if value at path equals provided value
     */
    hasStateValue(path, value) {
        const current = foundry.utils.getProperty(this.state, path);
        return current === value;
    },
    
    /**
     * Get a specific value from state by path
     * @param {string} path - Dot-notation path (e.g., "settings.autoOpen")
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} Value at path or default
     */
    getStateValue(path, defaultValue = undefined) {
        return foundry.utils.getProperty(this.state, path) ?? defaultValue;
    },
    
    /**
     * Set a specific value in state by path
     * @param {string} path - Dot-notation path (e.g., "settings.autoOpen")
     * @param {*} value - Value to set
     */
    setStateValue(path, value) {
        foundry.utils.setProperty(this.state, path, value);
    }
};