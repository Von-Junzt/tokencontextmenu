/**
 * State machine for weapon menu lifecycle management
 * Ensures valid state transitions and prevents race conditions in menu operations
 * 
 * State flow: CLOSED -> OPENING -> OPEN -> CLOSING -> CLOSED
 * Error recovery: ERROR -> CLOSED
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
     * Get current state
     * @returns {string}
     */
    getState() {
        return this.state;
    }
    
    /**
     * Check if transition is valid
     * @param {string} toState 
     * @returns {boolean}
     */
    canTransition(toState) {
        return this.transitions[this.state]?.includes(toState);
    }
    
    /**
     * Transition to new state
     * @param {string} toState 
     * @throws {Error} If transition is invalid
     */
    transition(toState) {
        if (!this.canTransition(toState)) {
            console.warn(`tokencontextmenu | Invalid weapon menu transition from ${this.state} to ${toState}`);
            return false;
        }
        
        const fromState = this.state;
        this.state = toState;
        
        // Notify listeners
        this.stateChangeCallbacks.forEach(callback => {
            callback(fromState, toState);
        });
        
        return true;
    }
    
    /**
     * Register state change callback
     * @param {Function} callback - Function called with (fromState, toState)
     */
    onStateChange(callback) {
        this.stateChangeCallbacks.push(callback);
    }
    
    /**
     * Check if menu is in a stable state
     * @returns {boolean}
     */
    isStable() {
        return this.state === 'CLOSED' || this.state === 'OPEN';
    }
    
    /**
     * Check if menu is transitioning
     * @returns {boolean}
     */
    isTransitioning() {
        return this.state === 'OPENING' || this.state === 'CLOSING';
    }
    
    /**
     * Check if menu is open or opening
     * @returns {boolean}
     */
    isActive() {
        return this.state === 'OPEN' || this.state === 'OPENING';
    }
    
    /**
     * Reset to closed state (emergency recovery)
     */
    reset() {
        console.warn('tokencontextmenu | Weapon menu state machine reset');
        this.state = 'CLOSED';
    }
}

/**
 * Operation queue to prevent race conditions
 * Ensures menu operations are processed sequentially to avoid conflicts
 * Used for all async menu operations (render, close, etc.)
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
     * Process queued operations
     * Executes operations sequentially to prevent conflicts
     * @private
     */
    async process() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        this.currentOperation = this.queue.shift();
        const { operation, resolve, reject, debugName } = this.currentOperation;
        
        try {
            const result = await operation();
            resolve(result);
        } catch (error) {
            console.error(`tokencontextmenu | Weapon menu operation failed: ${debugName}`, error);
            reject(error);
        } finally {
            this.currentOperation = null;
            this.processing = false;
            // Process next operation using ticker to avoid stack overflow
            if (this.queue.length > 0) {
                canvas.app.ticker.addOnce(() => this.process());
            }
        }
    }
    
    /**
     * Clear all pending operations
     */
    clear() {
        // Reject all pending operations
        this.queue.forEach(({ reject, debugName }) => {
            reject(new Error(`Operation cancelled: ${debugName}`));
        });
        this.queue = [];
    }
    
    /**
     * Get queue status
     * @returns {Object}
     */
    getStatus() {
        return {
            processing: this.processing,
            queueLength: this.queue.length,
            currentOperation: this.currentOperation?.debugName || null
        };
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
            console.warn('tokencontextmenu | Failed to remove weapon menu container', error);
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
            console.warn('tokencontextmenu | Failed to destroy weapon menu container', error);
        }
    }
}