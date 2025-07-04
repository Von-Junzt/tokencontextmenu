# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a weapon context menu module for the SWADE (Savage Worlds Adventure Edition) system in Foundry VTT. The module provides a quick-access menu for weapons and powers that appears when tokens are selected.

**Current Environment**: Foundry VTT v12
**Compatibility Target**: All implementations should maintain compatibility with Foundry VTT v13

## Development Commands

No specific build or test commands were found in the codebase. This appears to be a standard Foundry VTT module that:
- Does not require compilation/building
- Loads directly via Foundry's module system
- Uses ES6 modules natively

To develop:
1. Place the module in Foundry's `Data/modules/` directory
2. Enable the module in a SWADE game system world
3. Reload Foundry to test changes

## Architecture Overview

### Core Components

1. **Manager Layer** - Coordinates system behavior
   - `WeaponSystemCoordinator` - Central state hub implementing facade pattern
     - Manages menu lifecycle and state transitions
     - Coordinates between all subsystems
     - Implements controlled token caching for performance
     - Provides singleton access via lowercase export
   - `WeaponMenuTokenClickManager` - Handles token interactions
     - Hybrid event handling (libWrapper + PIXI)
     - Drag detection with 5-pixel threshold
     - Menu toggle behavior for selected tokens
   - `TargetingSessionManager` - Manages weapon targeting workflows
     - Single active session enforcement
     - Automatic cleanup on completion
   - `TokenDragManager` - Tracks token movement states
     - WeakMap-based per-token state tracking
     - Drag start/end detection
   - `EquipmentModeHandler` - Equipment mode business logic
     - Determines weapon update operations
     - Handles special weapon rules (unarmed, claws)
     - Manages template weapon restrictions  
     - Tracks equipment mode state per actor
   - `WeaponMenuTooltipManager` - HTML tooltip management
     - Extends CleanupManager for automatic cleanup
     - Handles tooltip positioning and lifecycle
     - Builds formatted tooltip content
   - `CleanupManager` - Base class for resource management
     - Automatic hook and listener tracking
     - Consistent cleanup pattern

2. **Application Layer**
   - `WeaponMenuApplication` - PIXI-based menu UI
     - State machine pattern (CLOSED → OPENING → OPEN → CLOSING)
     - Operation queue prevents race conditions
     - Dynamic positioning below tokens
     - Delegates menu building to WeaponMenuBuilder
     - Delegates tooltip management to WeaponMenuTooltipManager
     - Delegates equipment logic to EquipmentModeHandler

3. **Utility Layer**
   - `WeaponMenuBuilder` - PIXI menu construction
     - Builds menu structure with weapons/powers
     - Creates weapon icon containers
     - Handles expand button creation
     - Eliminates code duplication between create/rebuild

4. **State Management**
   - `StateManager` - Mixin providing state management functionality
   - Operation queue ensures atomic state transitions
   - WeakMap-based tracking for memory efficiency

### Key User Workflows

1. **Weapon Selection Flow**:
   - User clicks token → menu appears
   - User clicks weapon → enters targeting mode OR directly rolls (for AOE)
   - After target selection → creates attack roll card via Better Rolls

2. **Equipment Mode (New)**:
   - Single expand button toggles equipment mode for both weapons and powers
   - Shows carried (unequipped) weapons and unfavorited powers
   - Click items to change equipment/favorite status instead of using them
   - Visual feedback: very desaturated colors for carried/unfavorited items
   - Special handling:
     - Template weapons: Toggle between carried/stored only (never equipped)
     - Special weapons (unarmed/claws): Toggle between equipped/carried
     - Normal weapons: Standard equip/unequip behavior

3. **Smart Menu Behavior**:
   - Hides during token movement, reopens when stopped
   - Closes on right-click or escape key
   - Cleans up properly on scene changes

4. **Click Event Handling**:
   - `Token._onClickLeft` wrapped to capture mouse events before selection
   - Selection state checked during `mouseup` (not `mousedown`) to handle race conditions
   - Drag detection prevents menu opening during immediate token drags
   - Menu toggle works reliably for already-selected tokens

### Dependencies

- **lib-wrapper** - For wrapping Foundry core functions
- **betterrolls-swade2** - For dice rolling and attack cards
- Foundry VTT v12+ with SWADE system
- **Note**: Currently running on v12, but maintain v13 compatibility

### Important Patterns

- **Singleton Pattern**: Managers exported as lowercase instances (e.g., `weaponSystemCoordinator`)
- **Facade Pattern**: WeaponSystemCoordinator provides unified interface to subsystems
- **State Machine Pattern**: Explicit state transitions with validation
- **Mixin Pattern**: StateManager provides reusable functionality
- **Observer Pattern**: Heavy use of Foundry hooks for event handling
- **Resource Management**: CleanupManager base class ensures proper cleanup
- **Dynamic Imports**: Avoids circular dependencies between modules

### Performance-Focused Architecture (IMPORTANT)

The module uses an **optimized hybrid approach** based on what works best:

1. **PIXI for Right-Clicks** - Works reliably
   - Attaches to tokens layer
   - `rightdown` event - Immediately closes menu on right-click
   - No libWrapper overhead for right-clicks

2. **libWrapper for Left-Clicks** - Required due to PIXI limitations
   - `Token._onClickLeft` - Intercepts left-clicks (PIXI doesn't catch these reliably)
   - Lightweight wrapper that only sets up interaction handling
   - This is the primary click detection method

3. **Direct Event Flow** - No temporal coupling
   - Click detection → immediate action execution
   - No `lastMouseButton` state tracking between events
   - Each handler uses the best tool for its purpose

### Menu Behavior Specification

1. **Left-click on unselected token**:
   - Selects token
   - Opens menu if "Show on Selection" setting is enabled
   - Drag detection prevents menu if user starts dragging immediately

2. **Left-click on already selected token**:
   - Toggles menu (open/close)
   - Works regardless of "Show on Selection" setting

3. **Right-click on any token**:
   - Selects token (Foundry default behavior)
   - Does NOT open menu
   - Closes menu if already open

4. **Token movement**:
   - Menu closes immediately when token starts moving
   - Menu reopens when movement stops (if setting enabled)

### Recent Architecture Updates

- **Performance Optimization**: Added controlled token caching to reduce DOM queries
- **Click Detection**: Replaced timing-based detection with deterministic event handling
- **Memory Management**: Fixed PIXI event listener cleanup issues
- **Module ID Migration**: Changed from "vjpmacros" to "tokencontextmenu"
- **Drag Detection**: Enhanced to prevent menu during token drags
- **Equipment Mode**: Added expand/collapse functionality with inventory management
  - Single button controls both weapons and powers sections
  - Visual indicators for carried/unfavorited items
  - Complex state management for different weapon types
- **Single Responsibility Refactoring**: Extracted specialized components
  - EquipmentModeHandler for equipment business logic
  - WeaponMenuTooltipManager for tooltip management
  - WeaponMenuBuilder for menu construction
- **Permission Checks**: Added actor ownership validation to all update operations
- **Special Weapon Handling**: Simplified to use array-based checks
  - Special weapons (unarmed, claws, knife) now behave like regular weapons
  - Must be equipped to appear in menu (no longer always shown)
  - Sort to end of list for better organization
  - Configurable via `WEAPON_PRIORITY.SPECIAL_WEAPONS` array

### Known Issues & Technical Debt

1. **Syntax Error**: Double semicolon in `constants.js` COLORS export (line 79) - ✓ Fixed externally
2. **Missing Error Handling**: Weapon update operations lack validation and permission checks - ✓ Fixed
3. **Performance**: Full menu rebuild on expand/collapse instead of incremental updates
4. **Code Duplication**: Significant duplication between `_createPIXIContainer()` and `_rebuildMenuContent()` - ✓ Fixed
5. **Architecture**: `WeaponMenuApplication` violates single responsibility principle - ✓ Fixed
6. **UX Confusion**: Single expand button controls both weapons and powers sections

### Debugging

**ALWAYS use the module's debug utilities instead of console.log:**
- Import: `import {debug, debugWarn, debugError} from "./utils/debug.js"`
- Usage: `debug("message", data)` - respects user's debug settings
- The debug functions automatically prefix messages with "VJ TCM:"
- Debug messages only appear when debug mode is enabled in module settings
- Debug commands available via `window.tokencontextmenu` in console

### Foundry-Specific Guidelines

**NEVER use try/catch statements in Foundry modules.** Instead:
- Check if objects exist before accessing them (e.g., `if (game.settings?.settings?.has("module.setting"))`)
- Use Foundry's hooks system to ensure code runs at the appropriate time
- Always use Foundry's native functions wherever possible
- Always keep Foundry VTT best conding practice in mind
- For settings access before init, check if the settings store exists first
- Foundry provides its own error handling and try/catch blocks can interfere with debugging

**Foundry v13 Compatibility**:
- Always use `eventMode` instead of deprecated `interactive` property
- Check for property existence before using v13-specific features
- Maintain backwards compatibility with v12 APIs
- Test features in both v12 and v13 environments when possible

### Development Guidelines

**NEVER create test scripts unless explicitly requested by the User.** The module should be tested directly in Foundry VTT.