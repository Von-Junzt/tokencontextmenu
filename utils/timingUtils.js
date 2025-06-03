/**
 * @file Timing utilities for the weapon menu system
 * @description Provides ticker-based delays and timestamp management for reliable timing.
 * Uses Foundry's native canvas.app.ticker instead of setTimeout for better integration.
 */

/**
 * Manages delayed callbacks using canvas ticker with proper cleanup
 */
class TickerDelayManager {
    constructor() {
        this.delays = new Map();
        this.nextId = 0;
    }

    /**
     * Schedule a callback after a specified duration
     * @param {Function} callback - Function to execute
     * @param {number} duration - Duration in milliseconds
     * @param {string} [debugName] - Optional name for debugging
     * @returns {number} ID that can be used to cancel
     */
    delay(callback, duration, debugName = 'unnamed') {
        const id = this.nextId++;
        const startTime = performance.now();
        
        // Create a delay object to track state
        const delayObj = {
            debugName,
            callback,
            duration,
            startTime,
            cancelled: false,
            executed: false,
            ticker: null
        };
        
        // Define the ticker function
        delayObj.ticker = (deltaTime) => {
            if (delayObj.cancelled || delayObj.executed) {
                return;
            }
            
            const elapsed = performance.now() - startTime;
            if (elapsed >= duration) {
                delayObj.executed = true;
                // Remove ticker BEFORE executing callback to prevent any recursion
                canvas.app.ticker.remove(delayObj.ticker);
                this.delays.delete(id);
                
                // Execute callback last
                callback();
            }
        };
        
        // Add to ticker
        canvas.app.ticker.add(delayObj.ticker);
        this.delays.set(id, delayObj);
        
        return id;
    }

    /**
     * Cancel a delayed callback
     * @param {number} id - ID returned from delay()
     */
    cancel(id) {
        const delay = this.delays.get(id);
        if (delay && !delay.executed) {
            delay.cancelled = true;
            if (delay.ticker) {
                canvas.app.ticker.remove(delay.ticker);
            }
            this.delays.delete(id);
        }
    }

    /**
     * Cancel all pending delays
     */
    cancelAll() {
        for (const [id, delay] of this.delays) {
            if (!delay.executed) {
                delay.cancelled = true;
                if (delay.ticker) {
                    canvas.app.ticker.remove(delay.ticker);
                }
            }
        }
        this.delays.clear();
    }
}

/**
 * Manages simple timestamp-based timing without continuous tickers
 */
class TimestampManager {
    constructor() {
        this.timestamps = new Map();
    }

    /**
     * Record current timestamp for a given key
     * @param {string} key - Unique identifier
     */
    mark(key) {
        this.timestamps.set(key, Date.now());
    }

    /**
     * Check if enough time has passed since timestamp was marked
     * @param {string} key - Timestamp identifier
     * @param {number} milliseconds - Time to check against
     * @returns {boolean}
     */
    hasElapsed(key, milliseconds) {
        const timestamp = this.timestamps.get(key);
        if (!timestamp) return true;
        return (Date.now() - timestamp) >= milliseconds;
    }

    /**
     * Get elapsed time since timestamp was marked
     * @param {string} key - Timestamp identifier
     * @returns {number|null} Milliseconds elapsed or null if not found
     */
    getElapsed(key) {
        const timestamp = this.timestamps.get(key);
        if (!timestamp) return null;
        return Date.now() - timestamp;
    }

    /**
     * Clear a timestamp
     * @param {string} key - Timestamp identifier
     */
    clear(key) {
        this.timestamps.delete(key);
    }

    /**
     * Clear all timestamps
     */
    clearAll() {
        this.timestamps.clear();
    }
}


// Export singleton instances
export const tickerDelay = new TickerDelayManager();
export const timestamps = new TimestampManager();

// Cleanup on scene change
Hooks.on('canvasReady', () => {
    tickerDelay.cancelAll();
    timestamps.clearAll();
});