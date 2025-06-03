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

/**
 * Log error information (always logs, regardless of debug setting)
 * @param {string} message - The error message
 * @param {...any} args - Additional arguments to log
 */
export function debugError(message, ...args) {
    console.error(`VJ TCM: ${message}`, ...args);
}

/**
 * Log a group of related debug information
 * @param {string} groupName - The name of the debug group
 * @param {Function} callback - Function containing console.log calls
 */
export function debugGroup(groupName, callback) {
    if (isDebugEnabled()) {
        console.group(`VJ TCM: ${groupName}`);
        callback();
        console.groupEnd();
    }
}

/**
 * Log tabular data if debug mode is enabled
 * @param {any} data - The data to display in table format
 * @param {Array<string>} [columns] - Optional columns to display
 */
export function debugTable(data, columns) {
    if (isDebugEnabled()) {
        console.table(data, columns);
    }
}