# ECT Integration Implementation Plan

## Overview
This document describes the integration of Enhanced Combat Toolkit (ECT) context menu features into the Token Context Menu module. The implementation uses ECT's public API to provide quick access to weapon enhancements while maintaining architectural consistency with the existing codebase.

## Design Decision: Tooltip-styled Menu on Right-click

### Visual Design
- **Style**: Matches existing tooltip style (dark, semi-transparent background)
- **Position**: Right side of weapon icon (not at mouse position) for consistent UX
- **Content**: Vertical list of ECT enhancement options with "Edit Weapon" at bottom
- **Behavior**: Replaces direct weapon sheet opening when ECT is available

### Architecture Overview

The integration follows established patterns from CLAUDE.md:
- Singleton pattern for manager
- CleanupManager base class for resource management
- API-based integration (no direct imports)
- Consistent event handling

## Implementation Components

### 1. ECT Menu Manager (`managers/ECTMenuManager.js`)

**Purpose**: Manages the ECT context menu lifecycle and interactions

**Key Features**:
- Extends `CleanupManager` for automatic resource cleanup
- Singleton pattern (exported as `ectMenuManager`)
- Uses ECT's API to get menu options
- Handles positioning relative to weapon icons
- Manages menu show/hide lifecycle

**Responsibilities**:
- Check ECT availability via `game.enhancedcombattoolkit?.api?.weaponContextMenu`
- Fetch menu options using `ectAPI.getMenuOptions(actor, weapon, token)`
- Create HTML menu with tooltip styling
- Position menu at weapon icon's right edge
- Handle menu item clicks
- Ensure proper cleanup on close

### 2. Weapon Menu Application Updates (`applications/weaponMenuApplication.js`)

**Changes Required**:
- Modify `_handleWeaponEdit()` to become `_handleWeaponRightClick()`
- Calculate weapon container's global position using PIXI's `toGlobal()`
- Check for ECT availability before showing menu
- Pass position and weapon data to ECT menu manager
- Maintain existing tooltip hide behavior

**Position Calculation**:
```javascript
const globalPos = weaponContainer.toGlobal(new PIXI.Point(0, 0));
const canvasRect = canvas.app.view.getBoundingClientRect();
const menuX = canvasRect.left + globalPos.x + this.iconRadius + 10; // 10px padding
const menuY = canvasRect.top + globalPos.y;
```

### 3. CSS Styling (`style.css`)

**New Classes**:
- `.tokencontextmenu-ect-menu`: Container styling (inherits from tooltip style)
- `.tokencontextmenu-ect-menu-item`: Individual menu items
- `.tokencontextmenu-ect-menu-item:hover`: Hover state
- `.tokencontextmenu-ect-menu-separator`: Visual separator

**Style Guidelines**:
- Reuse existing tooltip colors and borders
- Font family: "Signika", sans-serif (Foundry standard)
- Background: rgba(0, 0, 0, 0.8)
- Border: 1px solid #2d2d2e
- Border radius: 5px
- Hover effect: Subtle background highlight

## API Integration Pattern

### Checking ECT Availability
```javascript
const ectAPI = game.enhancedcombattoolkit?.api?.weaponContextMenu;
if (!ectAPI) {
    // Fallback to direct weapon sheet edit
    weapon.sheet.render(true);
    return;
}
```

### Getting Menu Options
```javascript
// Get enhancement options from ECT
const menuOptions = ectAPI.getMenuOptions(actor, weapon, token);

// Add separator and edit option
if (menuOptions.length > 0) {
    menuOptions.push({ separator: true });
}
menuOptions.push({
    name: "Edit Weapon",
    icon: '<i class="fas fa-edit"></i>',
    callback: () => weapon.sheet.render(true)
});
```

## Menu Positioning Logic

1. **Get Icon Position**: Use `weaponContainer.toGlobal()` for world coordinates
2. **Convert to Screen**: Add canvas rectangle offset for DOM positioning
3. **Right Side Placement**: Position at `iconRight + padding`
4. **Screen Boundary Check**: Adjust if menu would exceed viewport
5. **Z-Index Management**: Ensure menu appears above other UI elements

## Behavioral Requirements

### Menu Lifecycle
- **Opens on**: Right-click on weapon icon
- **Closes on**:
  - Clicking menu option
  - Clicking outside menu
  - Pressing Escape key
  - Hovering different weapon (shows tooltip instead)
  - Opening another menu

### Interaction Flow
1. User hovers weapon → Tooltip appears
2. User right-clicks → Tooltip hides, ECT menu appears
3. User selects option → Action executes, menu closes
4. User hovers again → Tooltip reappears

### Fallback Behavior
- If ECT not installed: Right-click opens weapon sheet directly
- If ECT installed but no enhancements: Shows only "Edit Weapon" option
- If ECT API unavailable: Graceful fallback to default behavior

## Implementation Checklist

- [ ] Create `managers/ECTMenuManager.js`
- [ ] Update `applications/weaponMenuApplication.js` right-click handler
- [ ] Add CSS styles for ECT menu
- [ ] Test with ECT installed
- [ ] Test without ECT (fallback)
- [ ] Test positioning at screen edges
- [ ] Verify cleanup on scene change
- [ ] Update this documentation with final details

## Benefits

1. **Consistent UX**: Menu looks and behaves like existing tooltips
2. **Clean Architecture**: Follows established patterns from codebase
3. **API-based Integration**: No brittle direct imports
4. **Predictable Positioning**: Always at icon's right side
5. **Graceful Degradation**: Works seamlessly without ECT
6. **Memory Efficient**: Proper cleanup via CleanupManager
7. **Future-proof**: ECT can change internals without breaking integration

## Testing Scenarios

### With ECT Installed
- Right-click weapon with enhancements → Shows enhancement options
- Right-click weapon without enhancements → Shows only "Edit Weapon"
- Select enhancement option → Action executes, menu closes
- Click outside menu → Menu closes

### Without ECT Installed
- Right-click weapon → Opens weapon sheet directly
- No errors in console
- Seamless fallback experience

### Edge Cases
- Menu near screen edge → Repositions to stay visible
- Rapid right-clicks → No duplicate menus
- Scene change with menu open → Proper cleanup
- Token deletion with menu open → Graceful handling

## Notes

- The menu uses ECT's public API exclusively - no direct file imports
- Position is relative to weapon icon, not mouse cursor, for better UX
- Menu styling matches existing tooltips for visual consistency
- All event handlers are properly cleaned up to prevent memory leaks
- The implementation follows all patterns established in CLAUDE.md