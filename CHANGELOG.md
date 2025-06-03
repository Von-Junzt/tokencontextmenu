# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-01-06

### Added
- **SWADE System Dependency** - Added explicit SWADE system requirement to module.json
  - Minimum version: 4.0.0
  - Verified version: 4.4.3
- **Centralized Constants** - Added comprehensive constants system
  - Color constants for all UI elements (COLORS)
  - UI positioning and layout constants (UI)
  - Weapon sorting priority constants (WEAPON_PRIORITY)

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