# Enhanced Combat Toolkit Integration

## Overview
Token Context Menu provides seamless integration with the Enhanced Combat Toolkit (ECT) module, allowing quick access to weapon enhancement toggles directly from the weapon menu.

## Features

When ECT is installed and active, right-clicking on a weapon icon shows a context menu with available enhancement options:

- **Toggle Bipod** - Deploy/stow bipod for stability
- **Toggle Foldable Stock** - Extend/collapse stock
- **Toggle Laser Marker** - Activate/deactivate laser sight
- **Toggle Flashlight** - Turn flashlight on/off
- **Toggle Suppressor** - Attach/detach suppressor
- **Cycle Fire Mode** - Switch between fire modes
- **Change Ammunition** - Select different ammo types
- **Edit Weapon** - Open full weapon configuration sheet

## How It Works

### For Players
1. **Hover** over a weapon to see its tooltip with stats
2. **Right-click** to open the enhancement menu
3. **Click** an option to toggle that enhancement
4. The menu automatically shows only enhancements installed on that specific weapon

### API Integration
Token Context Menu uses ECT's public API to:
- Detect available enhancements
- Execute enhancement actions
- Maintain compatibility across ECT updates

### Graceful Fallback
- **With ECT**: Right-click shows enhancement menu
- **Without ECT**: Right-click opens weapon sheet directly
- No configuration needed - it just works!

## Visual Design

The enhancement menu uses the same visual style as weapon tooltips:
- Dark semi-transparent background
- Consistent fonts and colors
- Positioned at weapon icon's right edge
- Clean, minimal interface

## Compatibility

- **Required**: Foundry VTT v13+
- **Required**: SWADE system
- **Optional**: Enhanced Combat Toolkit (for enhancement features)
- **Module ID**: `enhancedcombattoolkit`

## Technical Details

### Architecture
- Uses ECT's `weaponContextMenu` API
- No direct file imports (future-proof)
- Proper cleanup on scene changes
- Memory-efficient event handling

### API Methods Used
```javascript
game.enhancedcombattoolkit?.api?.weaponContextMenu?.getMenuOptions(actor, weapon, token)
```

## Troubleshooting

### Menu Not Appearing
1. Verify ECT is installed and active
2. Check that the weapon has enhancements installed
3. Ensure you have permission to modify the token

### Enhancements Not Working
- This is likely an ECT configuration issue
- Check ECT's settings and documentation
- Verify the weapon is properly configured in ECT

## Future Enhancements

Potential future improvements:
- Keyboard shortcuts for common enhancements
- Visual indicators for active enhancements
- Quick-toggle mode for rapid enhancement switching

## Support

For issues related to:
- **Token Context Menu**: Report at [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Enhanced Combat Toolkit**: Check ECT's documentation and support channels

## Credits

Integration developed to provide seamless interoperability between Token Context Menu and Enhanced Combat Toolkit, enhancing the SWADE combat experience in Foundry VTT.