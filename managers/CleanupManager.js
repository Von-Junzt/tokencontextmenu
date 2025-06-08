/**
 * @file Base cleanup manager for consistent resource management
 * @description Provides automatic tracking and cleanup of hooks, event listeners, and tickers
 * for all manager classes in the token context menu module
 */

/**
 * Base class for managers that need automatic cleanup functionality
 * 
 * @class CleanupManager
 * @description Automatically tracks and cleans up:
 * - Foundry hooks registered with registerHook()
 * - Event listeners registered with registerListener()
 * - Tickers/timers registered with registerTicker()
 * - Custom cleanup callbacks registered with onCleanup()
 * 
 * Subclasses should:
 * 1. Call super() in constructor
 * 2. Override handleCanvasReady() if scene change handling is needed
 * 3. Call super.cleanup() in their cleanup method
 * 
 * @example
 * class MyManager extends CleanupManager {
 *     constructor() {
 *         super();
 *         this._setupHooks();
 *     }
 *     
 *     _setupHooks() {
 *         this.registerHook('updateToken', this._handleTokenUpdate);
 *     }
 *     
 *     cleanup() {
 *         // Custom cleanup first
 *         this.myCustomCleanup();
 *         // Then parent cleanup
 *         super.cleanup();
 *     }
 * }
 */
export class CleanupManager {
    constructor() {
        /**
         * @type {Map<string, {hookName: string, handler: Function}>}
         * @private
         */
        this._hooks = new Map();
        
        /**
         * @type {Map<string, {target: EventTarget, event: string, handler: Function, options?: any}>}
         * @private
         */
        this._listeners = new Map();
        
        /**
         * @type {Map<string, any>}
         * @private
         */
        this._tickers = new Map();
        
        /**
         * @type {Function[]}
         * @private
         */
        this._cleanupCallbacks = [];
        
        // Defer base hook setup to next tick to allow subclass constructor to complete
        Promise.resolve().then(() => this._setupBaseHooks());
    }
    
    /**
     * Register a Foundry hook with automatic cleanup tracking
     * @param {string} hookName - Name of the Foundry hook
     * @param {Function} handler - Handler function (will be bound to this)
     * @returns {Function} The bound handler function
     */
    registerHook(hookName, handler) {
        const boundHandler = handler.bind(this);
        const key = `${hookName}_${this._hooks.size}`;
        this._hooks.set(key, { hookName, handler: boundHandler });
        Hooks.on(hookName, boundHandler);
        return boundHandler;
    }
    
    /**
     * Register an event listener with automatic cleanup tracking
     * @param {EventTarget} target - DOM element or other event target
     * @param {string} event - Event name
     * @param {Function} handler - Handler function (will be bound to this)
     * @param {Object} options - addEventListener options
     * @returns {Function} The bound handler function
     */
    registerListener(target, event, handler, options) {
        const boundHandler = handler.bind(this);
        const key = `${target.id || target.constructor.name}_${event}_${this._listeners.size}`;
        this._listeners.set(key, { target, event, handler: boundHandler, options });
        
        // Support both DOM and PIXI event systems
        if (target.addEventListener) {
            target.addEventListener(event, boundHandler, options);
        } else if (target.on) {
            target.on(event, boundHandler);
        }
        
        return boundHandler;
    }
    
    /**
     * Register a ticker/timer with automatic cleanup tracking
     * @param {string} id - Unique identifier for this ticker
     * @param {Object} ticker - Ticker object with stop() method
     * @returns {Object} The ticker object
     */
    registerTicker(id, ticker) {
        this._tickers.set(id, ticker);
        return ticker;
    }
    
    /**
     * Add a callback to be called during cleanup
     * @param {Function} callback - Cleanup callback (will be bound to this)
     */
    onCleanup(callback) {
        this._cleanupCallbacks.push(callback.bind(this));
    }
    
    /**
     * Setup base hooks - called after constructor
     * @private
     */
    _setupBaseHooks() {
        // Only register canvasReady if subclass implements handleCanvasReady
        if (this.handleCanvasReady && typeof this.handleCanvasReady === 'function') {
            this.registerHook('canvasReady', this.handleCanvasReady);
        }
    }
    
    /**
     * Base cleanup method - removes all tracked resources
     * Subclasses should call super.cleanup() in their cleanup method
     */
    cleanup() {
        // Remove all hooks
        for (const [key, { hookName, handler }] of this._hooks) {
            Hooks.off(hookName, handler);
        }
        this._hooks.clear();
        
        // Remove all event listeners
        for (const { target, event, handler, options } of this._listeners.values()) {
            if (!target) continue;
            
            // Support both DOM and PIXI event systems
            if (target.removeEventListener) {
                target.removeEventListener(event, handler, options);
            } else if (target.off) {
                target.off(event, handler);
            }
        }
        this._listeners.clear();
        
        // Stop all tickers
        for (const ticker of this._tickers.values()) {
            if (ticker && typeof ticker.stop === 'function') {
                ticker.stop();
            }
        }
        this._tickers.clear();
        
        // Run cleanup callbacks
        for (const callback of this._cleanupCallbacks) {
            callback();
        }
        this._cleanupCallbacks = [];
    }
    
    /**
     * Handle canvas ready hook - override in subclasses
     * Default implementation does nothing
     * @param {Canvas} canvas - The ready canvas
     */
    handleCanvasReady(canvas) {
        // Override in subclasses if needed
        // Common pattern is to call this.reset() here
    }
}