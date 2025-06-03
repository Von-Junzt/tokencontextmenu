# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2025-01-06

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