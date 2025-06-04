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
    
    // Selection processing
    SELECTION_TIMEOUT: 500,                  // Timeout for selection processing
    
    // Movement tracking
    MOVEMENT_CHECK_FRAMES: 30,               // Frames to wait before considering token stationary
    MOVEMENT_THRESHOLD: 0.5,                 // Pixel threshold for movement detection
    
    // Drag detection
    DRAG_THRESHOLD_PIXELS: 5,                // Pixels to move before considering it a drag
    DRAG_DETECTION_DELAY: 150,               // Delay before opening menu to check for drag
};

/**
 * Z-index constants for proper UI layering
 */
export const Z_INDEX = {
    TOOLTIP: 100000,
};

/**
 * Size constants relative to grid size
 */
export const SIZES = {
    ICON_RADIUS_RATIO: 0.43,                 // Icon radius as ratio of base size
    SPRITE_SIZE_RATIO: 0.8,                  // Sprite size as ratio of base size
    FONT_SIZE_RATIO: 0.53,                   // Font size as ratio of base size
    SEPARATOR_HEIGHT_RATIO: 0.1              // Separator height as ratio of base size
};

/**
 * Color constants for UI elements (PIXI hex format)
 */
export const COLORS = {
    // Menu background and borders
    MENU_BACKGROUND: 0x000000,               // Menu background color
    MENU_BACKGROUND_ALPHA: 0.6,              // Menu background opacity
    MENU_BORDER: 0x2d2d2e,                   // Menu border color
    
    // Weapon icon colors
    WEAPON_BACKGROUND: 0x333333,             // Weapon icon background
    WEAPON_BORDER: 0x2d2d2e,                 // Weapon icon border
    WEAPON_HOVER_BACKGROUND: 0x444444,       // Weapon hover background
    WEAPON_HOVER_BORDER: 0xcccccc,           // Weapon hover border
    
    // Power icon colors
    POWER_BACKGROUND: 0x2d2d4d,              // Power icon background
    POWER_BORDER: 0x4a4a7a,                  // Power icon border
    POWER_HOVER_BACKGROUND: 0x4a4a7a,        // Power hover background
    POWER_HOVER_BORDER: 0x6a6aaa,            // Power hover border
    
    // Other UI elements
    SEPARATOR_LINE: 0x444444,                // Separator line color
    SEPARATOR_LINE_ALPHA: 0.6,               // Separator line opacity
    SPRITE_MASK: 0xffffff,                   // Sprite mask color
    TEXT_FILL: 0xffffff,                     // Text color
};

/**
 * UI positioning and layout constants
 */
export const UI = {
    MENU_Y_OFFSET: 10,                       // Pixels below token for menu placement
    MENU_CORNER_RADIUS: 5,                   // Menu background corner radius
    ICON_CORNER_RADIUS: 3,                   // Icon background corner radius
    SEPARATOR_MARGIN: 10,                    // Horizontal margin for separator lines
};

/**
 * Weapon sorting priority constants
 */
export const WEAPON_PRIORITY = {
    // Equipment status priorities (lower number = higher priority)
    EQUIPMENT: {
        TWO_HANDED: 0,        // Equip status 5: Two-handed weapons
        ONE_HANDED: 1,        // Equip status 4: One-handed weapons  
        OFF_HAND: 2,          // Equip status 2: Off-hand weapons
        CARRIED: 3,           // Equip status 1: Carried weapons
        STORED: 4             // Equip status 0: Stored weapons
    },
    
    // Special weapon type priorities
    SPECIAL: {
        CLAWS: 98,
        UNARMED: 99
    },
    
    // Other item type priorities
    POWER: 95,                // Powers
    DEFAULT: 50,              // Default priority
    OTHER: 100                // Other items
};