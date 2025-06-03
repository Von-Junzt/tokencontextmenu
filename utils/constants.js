/**
 * @file Constants for the weapon menu system
 * @description Defines timing values, sizes, states, and other constants used throughout the module
 */

/**
 * Timing constants for various operations (in milliseconds)
 */
export const TIMING = {
    // Weapon menu timings
    MENU_RENDER_HOOK_DELAY: 50,              // Delay before calling weaponMenuRendered hook
    MENU_CLICK_DEBOUNCE: 75,                 // Debounce for click detection
    MENU_AUTO_CLOSE: 10000,                  // Auto-close menu after 10 seconds
    MENU_SELECTION_CLEAR: 100,               // Delay to clear selection processing
    MENU_OPEN_AFTER_CLOSE: 10,               // Delay between close and reopen
    
    // Selection processing
    SELECTION_TIMEOUT: 500,                  // Timeout for selection processing
    HUD_RENDER_CHECK: 75,                    // Time to wait for HUD render detection
    
    // Movement tracking
    MOVEMENT_CHECK_FRAMES: 30,               // Frames to wait before considering token stationary
    MOVEMENT_THRESHOLD: 0.5,                 // Pixel threshold for movement detection
    
    // Drag detection
    DRAG_THRESHOLD_PIXELS: 5,                // Pixels to move before considering it a drag
    
    // Animation timings
    ANIMATION_FRAME_DURATION: 16.67,         // ~60fps
    DEFAULT_ANIMATION_DURATION: 300,         // Default animation duration
};

/**
 * State management constants for menu lifecycle
 */
export const STATES = {
    MENU: {
        CLOSED: 'closed',
        OPENING: 'opening',
        OPEN: 'open',
        CLOSING: 'closing',
        WAITING_FOR_TARGET: 'waitingForTarget',
        PROCESSING_SELECTION: 'processingSelection'
    }
};

/**
 * Z-index constants for proper UI layering
 */
export const Z_INDEX = {
    WEAPON_MENU: 10000,
    TOOLTIP: 100000,
    TARGET_TOOLTIP: 100001
};

/**
 * Size constants relative to grid size
 */
export const SIZES = {
    ICON_SCALE: 1.0,                         // Default icon scale
    ICON_RADIUS_RATIO: 0.43,                 // Icon radius as ratio of base size
    SPRITE_SIZE_RATIO: 0.8,                  // Sprite size as ratio of base size
    FONT_SIZE_RATIO: 0.53,                   // Font size as ratio of base size
    SEPARATOR_HEIGHT_RATIO: 0.1              // Separator height as ratio of base size
};