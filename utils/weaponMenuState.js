import { debug, debugWarn, debugError } from "./debug.js";

/**
 * State machine for weapon menu lifecycle management
 * Ensures valid state transitions and prevents race conditions in menu operations
 * 
 * @class WeaponMenuStateMachine
 * @description Implements a finite state machine to manage the weapon menu's lifecycle.
 * This prevents invalid operations like opening a menu that's already opening or closing
 * a menu that's already closed.
 * 
 * @example State flow diagram:
 * ```
 *   CLOSED ──────> OPENING ──────> OPEN
 *     ↑               │              │
 *     │               ↓              ↓
 *     └─── ERROR <───┴──────── CLOSING
 * ```
 * 
 * @property {string} state - Current state of the menu
 * @property {Object} transitions - Valid state transitions map
 * @property {Function[]} stateChangeCallbacks - Registered state change listeners
 */
export class WeaponMenuStateMachine {
    constructor() {
        this.state = 'CLOSED';
        this.transitions = {
            CLOSED: ['OPENING'],
            OPENING: ['OPEN', 'ERROR', 'CLOSING'],
            OPEN: ['CLOSING'],
            CLOSING: ['CLOSED', 'ERROR'],
            ERROR: ['CLOSED']
        };
        this.stateChangeCallbacks = [];
    }
    
    /**
     * Get current state of the menu
     * @returns {string} Current state ('CLOSED', 'OPENING', 'OPEN', 'CLOSING', or 'ERROR')
     */
    getState() {
        return this.state;
    }
    
    /**
     * Check if a transition to the specified state is valid
     * @param {string} toState - Target state to transition to
     * @returns {boolean} True if transition is allowed from current state
     */
    canTransition(toState) {
        return this.transitions[this.state]?.includes(toState);
    }
    
    /**
     * Transition to a new state
     * @param {string} toState - Target state to transition to
     * @returns {boolean} True if transition was successful, false if invalid
     * @fires WeaponMenuStateMachine#stateChange
     */
    transition(toState) {
        if (!this.canTransition(toState)) {
            debugWarn(`Invalid weapon menu transition from ${this.state} to ${toState}`);
            return false;
        }
        
        const fromState = this.state;
        this.state = toState;
        
        // Set up timeout recovery for transition states
        if ((toState === 'OPENING' || toState === 'CLOSING') && canvas?.app?.ticker) {
            // Clear any existing timeout ticker
            if (this._timeoutTicker) {
                canvas.app.ticker.remove(this._timeoutTicker);
                this._timeoutTicker = null;
            }
            
            // Start new timeout ticker
            const startTime = Date.now();
            const timeoutMs = 2000; // 2 seconds timeout
            
            this._timeoutTicker = () => {
                if (Date.now() - startTime > timeoutMs) {
                    // Remove this ticker
                    canvas.app.ticker.remove(this._timeoutTicker);
                    this._timeoutTicker = null;
                    
                    // Check if still stuck in transition state
                    if (this.state === toState) {
                        debugWarn(`State machine stuck in ${toState} for ${timeoutMs}ms, forcing ERROR state`);
                        this.state = 'ERROR';
                        
                        // Notify listeners about the error transition
                        this.stateChangeCallbacks.forEach(callback => {
                            callback(toState, 'ERROR');
                        });
                    }
                }
            };
            
            canvas.app.ticker.add(this._timeoutTicker);
        } else if (this._timeoutTicker && canvas?.app?.ticker) {
            // Clear timeout ticker when transitioning to stable states
            canvas.app.ticker.remove(this._timeoutTicker);
            this._timeoutTicker = null;
        }
        
        // Notify listeners
        this.stateChangeCallbacks.forEach(callback => {
            callback(fromState, toState);
        });
        
        return true;
    }
    
    /**
     * Register a callback to be called when state changes
     * @param {Function} callback - Function called with (fromState, toState) when state changes
     * @example
     * stateMachine.onStateChange((from, to) => {
     *     debug(`Menu transitioned from ${from} to ${to}`);
     * });
     */
    onStateChange(callback) {
        this.stateChangeCallbacks.push(callback);
    }
    
    /**
     * Check if menu is in a stable state (not transitioning)
     * @returns {boolean} True if in CLOSED or OPEN state
     */
    isStable() {
        return this.state === 'CLOSED' || this.state === 'OPEN';
    }
    
    /**
     * Check if menu is currently transitioning between states
     * @returns {boolean} True if in OPENING or CLOSING state
     */
    isTransitioning() {
        return this.state === 'OPENING' || this.state === 'CLOSING';
    }
    
    /**
     * Check if menu is active (visible or becoming visible)
     * @returns {boolean} True if in OPEN or OPENING state
     */
    isActive() {
        return this.state === 'OPEN' || this.state === 'OPENING';
    }
    
    /**
     * Force reset to closed state (emergency recovery)
     * @description Use this only when normal state transitions fail, such as after
     * an error or when the menu gets stuck in an invalid state
     */
    reset() {
        debugWarn('Weapon menu state machine reset');
        
        // Clear any timeout ticker if it exists
        if (this._timeoutTicker && canvas?.app?.ticker) {
            canvas.app.ticker.remove(this._timeoutTicker);
            this._timeoutTicker = null;
        }
        
        this.state = 'CLOSED';
    }
}

/**
 * Operation queue to prevent race conditions in asynchronous menu operations
 * 
 * @class OperationQueue
 * @description Ensures menu operations (render, close, etc.) are processed sequentially
 * to prevent conflicts such as trying to open a menu while it's closing or vice versa.
 * This is critical because PIXI operations and state transitions are asynchronous.
 * 
 * @example
 * const queue = new OperationQueue();
 * 
 * // Multiple rapid clicks won't cause issues
 * await queue.enqueue(async () => await menu.render(), 'render');
 * await queue.enqueue(async () => await menu.close(), 'close');
 * 
 * @property {Array} queue - Pending operations waiting to be processed
 * @property {boolean} processing - Whether an operation is currently being processed
 * @property {Object|null} currentOperation - Currently executing operation
 */
export class OperationQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.currentOperation = null;
    }
    
    /**
     * Add operation to queue
     * @param {Function} operation - Async function to execute
     * @param {string} debugName - Name for debugging purposes
     * @returns {Promise} Resolves when operation completes
     */
    async enqueue(operation, debugName = 'unnamed') {
        debug(`OperationQueue: Enqueuing operation '${debugName}'`, {
            queueLength: this.queue.length,
            processing: this.processing,
            currentOp: this.currentOperation?.debugName
        });
        
        return new Promise((resolve, reject) => {
            this.queue.push({ 
                operation, 
                resolve, 
                reject, 
                debugName,
                timestamp: Date.now()
            });
            this.process();
        });
    }
    
    /**
     * Process queued operations sequentially
     * @private
     * @description Executes operations one at a time, using PIXI ticker to avoid stack overflow
     * on recursive calls.
     */
    async process() {
        if (this.processing || this.queue.length === 0) {
            debug(`OperationQueue: Skipping process`, {
                processing: this.processing,
                queueLength: this.queue.length
            });
            return;
        }
        
        this.processing = true;
        this.currentOperation = this.queue.shift();
        const { operation, resolve, reject, debugName } = this.currentOperation;
        
        debug(`OperationQueue: Processing operation '${debugName}'`);
        
        // Use promise chaining for error handling without try-catch
        operation()
            .then(result => {
                debug(`OperationQueue: Operation '${debugName}' completed successfully`);
                resolve(result);
                this.currentOperation = null;
                this.processing = false;
                // Process next operation using ticker to avoid stack overflow
                if (this.queue.length > 0) {
                    debug(`OperationQueue: Scheduling next operation, ${this.queue.length} remaining`);
                    canvas.app.ticker.addOnce(() => this.process());
                }
            })
            .catch(error => {
                debugError(`OperationQueue: Operation '${debugName}' failed:`, error);
                reject(error);
                this.currentOperation = null;
                this.processing = false;
                // Continue processing queue even after error
                if (this.queue.length > 0) {
                    debug(`OperationQueue: Scheduling next operation after error, ${this.queue.length} remaining`);
                    canvas.app.ticker.addOnce(() => this.process());
                }
            });
    }
    
    /**
     * Clear all pending operations
     * @description Cancels all queued operations by rejecting their promises.
     * Use this when you need to abort all pending operations, such as during cleanup.
     */
    clear() {
        // Reject all pending operations
        this.queue.forEach(({ reject, debugName }) => {
            reject(new Error(`Operation cancelled: ${debugName}`));
        });
        this.queue = [];
    }
    
    /**
     * Get current queue status for debugging
     * @returns {Object} Status object containing:
     * @returns {boolean} .processing - Whether currently processing an operation
     * @returns {number} .queueLength - Number of pending operations
     * @returns {string|null} .currentOperation - Name of current operation or null
     */
    getStatus() {
        const status = {
            processing: this.processing,
            queueLength: this.queue.length,
            currentOperation: this.currentOperation?.debugName || null,
            pendingOperations: this.queue.map(op => op.debugName)
        };
        debug(`OperationQueue: Current status`, status);
        return status;
    }
}

/**
 * Container verification utilities
 * Provides safe methods for PIXI container manipulation
 * Prevents errors from destroyed or detached containers
 */
export class ContainerVerification {
    /**
     * Check if PIXI container is valid and attached
     * @param {PIXI.Container} container - The container to check
     * @returns {boolean} True if container is valid and can be safely used
     */
    static isValid(container) {
        return container && 
               !container.destroyed && 
               container.parent && 
               !container.parent.destroyed;
    }
    
    /**
     * Safely remove container from parent
     * @param {PIXI.Container} container - The container to remove
     * @returns {boolean} True if successfully removed
     */
    static safeRemove(container) {
        try {
            if (this.isValid(container)) {
                container.parent.removeChild(container);
                return true;
            }
        } catch (error) {
            debugWarn('Failed to remove weapon menu container', error);
        }
        return false;
    }
    
    /**
     * Safely destroy container and children
     * Recursively cleans up all children and listeners
     * @param {PIXI.Container} container - The container to destroy
     */
    static safeDestroy(container) {
        try {
            if (container && !container.destroyed) {
                // Remove all listeners first
                container.removeAllListeners();
                
                // Recursively clean children
                while (container.children.length > 0) {
                    const child = container.children[0];
                    if (child.removeAllListeners) {
                        child.removeAllListeners();
                    }
                    container.removeChild(child);
                    if (child.destroy) {
                        child.destroy({ children: true });
                    }
                }
                
                // Destroy container
                container.destroy({ children: true });
            }
        } catch (error) {
            debugWarn('Failed to destroy weapon menu container', error);
        }
    }
}