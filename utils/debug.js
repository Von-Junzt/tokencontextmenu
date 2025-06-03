/**
 * @file Debug utilities for the weapon menu system
 * @description Provides centralized debug logging that can be toggled via settings
 */

import { isDebugEnabled } from "../settings/settings.js";

/**
 * Log debug information if debug mode is enabled
 * @param {string} message - The debug message
 * @param {...any} args - Additional arguments to log
 */
export function debug(message, ...args) {
    if (isDebugEnabled()) {
        console.log(`VJ TCM: ${message}`, ...args);
    }
}

/**
 * Log warning information if debug mode is enabled
 * @param {string} message - The warning message
 * @param {...any} args - Additional arguments to log
 */
export function debugWarn(message, ...args) {
    if (isDebugEnabled()) {
        console.warn(`VJ TCM: ${message}`, ...args);
    }
}