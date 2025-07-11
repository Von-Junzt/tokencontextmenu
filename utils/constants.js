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
    
    // Carried/Unfavorited items (very desaturated)
    CARRIED_BACKGROUND: 0x0d0d0d,            // Almost black background for carried/unfavorited
    CARRIED_BORDER: 0x333333,                // Very dark gray border for carried weapons and unfavorited powers
    CARRIED_HOVER_BACKGROUND: 0x1a1a1a,      // Very dark gray hover for carried/unfavorited
    CARRIED_HOVER_BORDER: 0x4a4a4a,          // Dark gray hover border for carried/unfavorited
    
    // Expand button colors
    EXPAND_BUTTON_BORDER: 0x666666,          // Expand button border
    EXPAND_BUTTON_TEXT: 0x666666,            // Darker gray for pipe color
    
    // Other UI elements
    SEPARATOR_LINE: 0x444444,                // Separator line color
    SEPARATOR_LINE_ALPHA: 0.6,               // Separator line opacity
    SPRITE_MASK: 0xffffff,                   // Sprite mask color
    TEXT_FILL: 0xffffff,                     // Text color
    
    // Equipment badge colors
    EQUIPMENT_BADGE_DEFAULT: 0x000000,       // Default equipment badge color (black)
    EQUIPMENT_BADGE_BG_DEFAULT: 0xff2929,    // Default equipment badge background (red)
    EQUIPMENT_BADGE_FALLBACK: 0xffa500,      // Fallback badge color when game not ready (orange)
    EQUIPMENT_BADGE_BG_FALLBACK: 0x000000,   // Fallback badge background when game not ready (black)
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
    
    // Weapon type grouping (added to base priority)
    WEAPON_TYPE_GROUP: {
        NORMAL: 0,            // Regular weapons (0-29)
        TEMPLATE: 30,         // Template/AOE weapons (30-59)
        SPECIAL: 900          // Special weapons - appear at end
    },
    
    // Special weapon identifiers (checked as substrings in weapon names)
    SPECIAL_WEAPONS: ['unarmed attack', 'claws', 'knife'],
    
    // Other item type priorities
    POWER: 95,                // Powers
    DEFAULT: 50,              // Default priority
    OTHER: 100                // Other items
};

/**
 * Power favorite status constants
 */
export const POWER_STATUS = {
    // Icon file paths for power badges
    ICON_PATHS: {
        FAVORITED: 'modules/tokencontextmenu/icons/equipment/star-solid.png',
        UNFAVORITED: 'modules/tokencontextmenu/icons/equipment/star-regular.png'
    },
    
    // Note: Badge styling uses the shared BADGE constants below
};

/**
 * Equipment status constants for SWADE system
 */
export const EQUIP_STATUS = {
    // Status values (reuse from WEAPON_PRIORITY)
    STORED: 0,
    CARRIED: 1,
    OFF_HAND: 2,
    MAIN_HAND: 4,
    TWO_HANDED: 5,
    
    // Font Awesome icons for each status
    ICONS: {
        0: 'fas fa-archive',      // Stored in backpack/storage
        1: 'fas fa-toolbox',      // Carried but not equipped
        2: 'fas fa-hand-paper',   // Equipped in off-hand
        4: 'fas fa-fist-raised',  // Equipped in main hand
        5: 'fas fa-hands'         // Equipped with both hands
    },
    
    // Font Awesome Unicode characters for PIXI rendering (kept for reference)
    FA_UNICODE: {
        0: '\uf187',  // fa-archive
        1: '\uf552',  // fa-toolbox
        2: '\uf256',  // fa-hand-paper
        4: '\uf6de',  // fa-fist-raised
        5: '\uf2b5'   // fa-hands
    },
    
    // Icon file paths for equipment status badges
    ICON_PATHS: {
        0: 'modules/tokencontextmenu/icons/equipment/stored.png',
        1: 'modules/tokencontextmenu/icons/equipment/carried.png',
        2: 'modules/tokencontextmenu/icons/equipment/offhand.png',
        4: 'modules/tokencontextmenu/icons/equipment/mainhand.png',
        5: 'modules/tokencontextmenu/icons/equipment/twohanded.png'
    },
    
    // Valid cycle order for equipment status
    CYCLE_ORDER: [0, 1, 2, 4, 5],
    
    // Human-readable labels for equipment status
    LABELS: {
        0: 'Stored',
        1: 'Carried',
        2: 'Off-Hand',
        4: 'Main Hand',
        5: 'Two-Handed'
    },
    
    // Note: Badge styling uses the shared BADGE constants below
};

/**
 * UI Animation constants for hover effects and transitions
 */
export const UI_ANIMATION = {
    // Scale factors
    HOVER_SCALE: 1.1,           // Scale when hovering
    NORMAL_SCALE: 1.0,          // Normal scale
    
    // Alpha values for expand buttons
    EXPAND_BUTTON: {
        HOVER_ALPHA_EXPANDED: 1.0,
        HOVER_ALPHA_COLLAPSED: 0.8,
        NORMAL_ALPHA_EXPANDED: 0.9,
        NORMAL_ALPHA_COLLAPSED: 0.5,
    },
    
    // Sprite transparency
    CARRIED_SPRITE_ALPHA: 0.5,   // Transparency for carried/unfavorited items
};

/**
 * Badge positioning and sizing constants (shared by equipment and power badges)
 */
export const BADGE = {
    // Positioning
    POSITION_OFFSET_RATIO: 0.8,   // How far from edge (ratio of badge radius)
    
    // Sizing
    SIZE_RATIO: 0.3,              // Badge size relative to icon radius
    CIRCLE_SIZE_MULTIPLIER: 1.5,  // Circle size multiplier (1.0 = same as badge, 1.2 = 20% bigger)
    ICON_SIZE_MULTIPLIER: 3.0,    // Badge icon size relative to badge radius
    TEXT_SIZE_MULTIPLIER: 1.5,    // Fallback text size relative to badge radius
    
    // Styling
    BG_COLOR: 0x000000,           // Badge background color (now unused - using user setting)
    BG_ALPHA: 0.7,                // Badge background opacity
    ICON_COLOR: 0xFFFFFF,         // Badge icon color (fallback text)
    FONT_SIZE_RATIO: 0.4          // Font size relative to icon radius (fallback text)
};

/**
 * Reload button dimensions and styling
 */
export const RELOAD_BUTTON = {
    // Positioning - top-left corner to match badge system
    POSITION_X_RATIO: -0.8,      // Same as badge positioning
    POSITION_Y_RATIO: -0.8,      // Top-left corner
    
    // Sizing - match badge size
    SIZE_RATIO: 0.3,             // Same as BADGE.SIZE_RATIO
    CIRCLE_SIZE_MULTIPLIER: 1.5, // Same as badge circle
    ICON_SIZE_MULTIPLIER: 2.0,   // Same as badge icon
    
    // Styling
    BG_COLOR: 0xFFFFFF,         // White background
    BG_ALPHA: 0.9,              // Same as badge opacity
    ICON_COLOR: 0x000000,       // Black icon color
    HOVER_ALPHA: 0.9,           // Opacity on hover
    NORMAL_ALPHA: 0.9,          // Normal opacity
    
    // Animation
    FADE_IN_DURATION: 200,      // Fade in duration in ms
    FADE_OUT_DURATION: 100,     // Fade out duration in ms
    
    // Icon path
    ICON_PATH: 'modules/tokencontextmenu/icons/equipment/reload.svg'
};

/**
 * Expand button dimensions and styling
 */
export const EXPAND_BUTTON = {
    // Dimensions
    HEIGHT_RATIO: 0.6,            // Height as ratio of base icon size
    PIPE_WIDTH: 2,                // Width of the pipe graphic
    X_OFFSET_RATIO: 0.2,          // X position offset ratio
    SPACE_RATIO: 0.3,             // Space allocation ratio for expand button
    
    // Hit area
    HIT_AREA_ALPHA: 0.01,         // Nearly invisible hit area
    HIT_AREA_SIZE_RATIO: 0.25     // Hit area size as ratio of base size
};

/**
 * Graphics rendering constants
 */
export const GRAPHICS = {
    // Line styles
    DEFAULT_LINE_WIDTH: 1,        // Standard border width
    
    // Anchor points
    CENTER_ANCHOR: 0.5,           // Center anchor for sprites
};

/**
 * Mouse button constants
 */
export const MOUSE_BUTTON = {
    LEFT: 0,                      // Left mouse button
    RIGHT: 2,                     // Right mouse button
};

/**
 * Mathematical constants for UI calculations
 */
export const MATH = {
    CENTER_DIVISOR: 2,            // Divisor for centering calculations
    DIMENSION_MULTIPLIER: 2,      // Multiplier for converting radius to diameter
    HEX_PARSE_BASE: 16,           // Base for parsing hexadecimal colors
};

/**
 * Container and array constants
 */
export const CONTAINER = {
    FIRST_CHILD_INDEX: 0,         // Index of first child in container
};

/**
 * Hex color constants
 */
export const HEX_COLOR = {
    WHITE: 0xFFFFFF,              // White color in PIXI hex format
    VALIDATION_LENGTH: 6,         // Length of hex color string (without #)
};
/**
 * Color picker dialog constants
 */
export const COLOR_PICKER_DIALOG = {
    WIDTH: 200,                    // Color input width in pixels
    HEIGHT: 50,                    // Color input height in pixels
    PADDING: 10,                   // Dialog padding in pixels
    BUTTON_MARGIN_LEFT: 5,         // Button left margin in pixels
    BUTTON_PADDING: '2px 8px',     // Button padding
};

/**
 * Drag detection constants
 */
export const DRAG = {
    DEFAULT_THRESHOLD: 3,         // Default drag threshold in pixels (for TokenDragManager)
};

/**
 * Equipment state color constants
 */
export const EQUIPMENT_STATE_COLORS = {
    // PIXI hex format colors for state-based coloring
    ACTIVE: 0x00FF00,    // Green - shows in menu (equipped/carried template/favorited)
    CARRIED: 0xFFFF00,   // Yellow - carried but not equipped
    DEFAULT: 0xFFFFFF,   // White - use existing color setting
    
    // Hex string versions for settings defaults
    HEX: {
        ACTIVE: "#00FF00",
        CARRIED: "#FFFF00"
    }
};

/**
 * Equipment mode zoom constants
 */
export const EQUIPMENT_ZOOM = {
    DEFAULT_SCALE: 2.5,      // Default zoom level (150%)
    MIN_SCALE: 1.0,          // Minimum zoom (100% - no zoom)
    MAX_SCALE: 3.0,          // Maximum zoom (300%)
    STEP: 0.1,               // Step for range input
    ANIMATION_DURATION: 750, // Default animation duration in ms
    MIN_DURATION: 0,         // Minimum animation duration (instant)
    MAX_DURATION: 2000,      // Maximum animation duration (1 second)
    DURATION_STEP: 50,       // Step for duration range input
    REFERENCE_GRID_SIZE: 64, // Reference grid size in pixels for consistent zoom
    MIN_VISIBLE_SQUARES: 3,  // Minimum grid squares visible when zoomed
    MAX_VISIBLE_SQUARES: 5   // Maximum grid squares visible when zoomed
};

/**
 * Equipment mode blur filter constants
 */
export const EQUIPMENT_BLUR = {
    FILTER_NAME: 'tcm-equipment-blur',  // Unique name for filter identification
    DEFAULT_STRENGTH: 8,                // Default blur strength
    MIN_STRENGTH: 1,                    // Minimum blur strength
    MAX_STRENGTH: 20,                   // Maximum blur strength
    STRENGTH_STEP: 1,                   // Step for strength range input
    DEFAULT_QUALITY: 4,                 // Default blur quality (affects performance)
    MIN_QUALITY: 1,                     // Minimum quality (fastest)
    MAX_QUALITY: 8,                     // Maximum quality (best looking)
    QUALITY_STEP: 1                     // Step for quality range input
};
