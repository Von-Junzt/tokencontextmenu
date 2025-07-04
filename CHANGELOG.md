# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-01-07

### Added
- **SWADE System Dependency** - Added explicit SWADE system requirement to module.json
  - Minimum version: 4.0.0
  - Verified version: 4.4.3
- **Centralized Constants** - Added comprehensive constants system
  - Color constants for all UI elements (COLORS)
  - UI positioning and layout constants (UI)
  - Weapon sorting priority constants (WEAPON_PRIORITY)
- **Immediate Drag Detection** - Enhanced drag detection for token selection
  - Menu no longer opens when clicking and immediately dragging an unselected token
  - Added 150ms delay to distinguish between clicks and drags
  - Preserves existing toggle behavior for already-selected tokens
- **Equipment Badge Color Customization** - Added color picker setting for equipment badges
  - New module setting allows players to customize badge colors
  - Native HTML5 color picker integration
  - Live preview - badges update immediately when color changes
  - Applies to both equipment status badges and power favorite stars
- **Equipment Status in Tooltips** - Added textual equipment status to weapon tooltips
  - Shows current equipment status (Stored, Carried, Off-Hand, Main Hand, Two-Handed)
  - Appears below separator line in tooltip for better readability
  - Provides accessibility for color-blind users
  - Complements visual badge indicators

### Changed
- **Foundry Compatibility** - Updated to v12.331 (stable)

### Fixed
- **Weapon Menu Selection Behavior** - Complete overhaul of mouse button detection
  - Replaced unreliable timing-based right-click detection with libWrapper hooks
  - Fixed "Show weapon menu on token selection" setting not working properly
  - Fixed menu not toggling when clicking on already-selected tokens
  - Fixed menu showing when dragging tokens instead of clicking
  - Menu now closes immediately when drag is detected
  - Removed all timing dependencies for deterministic behavior
- **Event Listener Memory Leak** - Fixed PIXI event listeners accumulating on tokens
  - Added proper cleanup tracking using WeakMap
  - Listeners are now removed before adding new ones
  - Cleanup occurs on token deselection, deletion, and scene changes
  - Prevents performance degradation over long play sessions
- **Menu Opening Race Condition** - Fixed timing issue in token selection handling
  - Menu now correctly opens when clicking unselected tokens
  - Selection state is checked at the right time (mouseup) instead of being cached too early (mousedown)
  - Resolves issue where token becomes selected between mouse events
- **Selection Processing Flag** - Fixed flag getting stuck in processing state
  - Flag is now cleared in all code paths including early returns
  - Added token validation to prevent operations on deleted/invalid tokens
  - Enhanced debug logging to track flag lifecycle
  - Existing 500ms timeout provides additional safety net
- **Performance Optimization** - Added caching for controlled tokens
  - Implemented centralized cache in WeaponSystemCoordinator
  - Reduces repeated `canvas.tokens.controlled` queries during click handling
  - Uses version counter for robust cache invalidation
  - Handles canvas state transitions properly

### Removed
- **Auto-Close Timer** - Removed automatic menu closure after 10 seconds
  - Menu now stays open until explicitly closed by user action
  - Improves user experience by preventing premature closure while reading tooltips
  - Aligns with standard Foundry VTT UI patterns
  - Simplifies codebase by removing timer management

### Changed
- **Mouse Button Detection** - Now intercepts `Token._onClickLeft` and `Token._onClickRight` directly via libWrapper
- **Drag Detection** - Added 5-pixel threshold to distinguish clicks from drags
- **Setting Behavior** - "Show on selection" now only affects initial selection, not subsequent clicks
- **Reopen After Drag** - This setting now works independently of "Show on selection" setting

### Technical Improvements
- Removed global document/canvas mouse event listeners
- Eliminated race conditions between mouse events and token selection
- Simplified event handling logic by removing timing-based guesses
- Added drag threshold constant (`DRAG_THRESHOLD_PIXELS`) for easier configuration

### Refactoring
- **Module ID Migration** - Changed module ID from "vjpmacros" to "tokencontextmenu"
  - Updated all internal references across 13 files
  - Changed all CSS class names from `vjpmacros-*` to `tokencontextmenu-*`
  - Updated hook names from `vjpmacros.*` to `tokencontextmenu.*`
  - Updated debug commands from `vjpmacros.*` to `tokencontextmenu.*`
  - Updated all console log prefixes to "Token Context Menu"
  - Updated user flags and settings to use new module ID
  - Module is now standalone, no longer part of "Von Junzt's SWADE Macros"

### Removed
- **Target Selection Timeout** - Removed the 10-second timeout when selecting targets
  - Users can now take as long as needed to select targets
  - Targeting mode stays active until explicitly cancelled (Escape, right-click) or a target is selected
  - More consistent with Foundry VTT UX patterns
- **Unused Constants** - Cleaned up constants.js
  - Removed entire STATES object (unused)
  - Removed unused timing constants
  - Removed unused Z_INDEX entries
  - All remaining constants are actively used

### Code Quality
- **Magic Numbers Elimination** - Replaced all hardcoded values with named constants
  - All colors now use COLORS constants
  - All UI dimensions use UI constants
  - Fixed remaining hardcoded z-index value
- **Import Cleanup** - Added missing constant imports where needed
- **Menu Closing Consolidation** - Created centralized weapon menu closing utility
  - Eliminated duplicate closing logic from 5 different locations
  - Consistent cleanup sequence across all close operations
  - Better debugging with close reason tracking
  - Improved orphaned menu detection and cleanup
- **Documentation** - Added comprehensive JSDoc comments
  - Documented state machine pattern and architecture
  - Added JSDoc to all manager classes and utility functions
  - Explained design patterns and their purposes
- **Template Weapon Detection** - Fixed template weapons requiring target selection
  - Added weapon data preparation to ensure templates are properly loaded
  - Template weapons (AOE) now correctly create roll cards immediately
- **Menu State Management** - Fixed "state mismatch" console warnings
  - Menu close now properly updates all coordinator state flags
  - Eliminated warnings when clicking tokens after weapon selection