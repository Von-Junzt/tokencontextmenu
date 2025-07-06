# Token Context Menu for SWADE

A Foundry VTT module that adds a quick-access context menu for weapons and powers in the Savage Worlds Adventure Edition (SWADE) system.

![Foundry Version](https://img.shields.io/badge/Foundry-v12.331-green)
![SWADE Compatible](https://img.shields.io/badge/SWADE-v4.4.3-blue)
![Module Version](https://img.shields.io/badge/Module-v1.0.0-orange)

## Features

### 🎯 Quick Weapon Access
- **Token Menu**: Click on any token you control to display a radial menu of equipped weapons and favorite powers
- **Smart Filtering**: Only shows equipped weapons (including unarmed attacks) and favorited powers
- **Visual Separation**: Powers are visually separated from weapons with a divider line
- **Performance Optimized**: Uses controlled token caching and efficient event handling

### 🖱️ Controls
- **Left Click**: Select a weapon to use
- **Right Click**: Open the weapon's item sheet for editing
- **Escape Key**: Close the menu
- **Click Outside**: Close the menu

### 🎨 UI Design
- **Responsive Layout**: Configurable items per row (default: 4)
- **Scalable Icons**: Adjust icon size relative to grid size
- **Hover Effects**: Visual feedback when hovering over weapons
- **Detailed Tooltips**: Optional detailed weapon stats on hover (damage, range, AP, etc.)
- **Ammo Display**: Shows current/max ammunition for ranged weapons
- **Equipment Mode**: Expand button shows all weapons/powers with visual badges
- **Status Badges**: Visual indicators for equipment status and power favorites
- **Customizable Colors**: Player-configurable badge colors with color picker
- **Accessibility**: Equipment status shown in tooltips for color-blind users

### ⚡ Smart Workflow
- **Intelligent Targeting**: 
  - Template/AOE weapons create attack cards immediately
  - Single-target weapons enter targeting mode if no target selected
  - No timeout - take as long as you need to select targets
  - Optional auto-remove existing targets
- **Movement Awareness**: 
  - Menu automatically hides during token movement
  - Optionally reopens after movement stops
  - Drag detection prevents menu during token drags (5-pixel threshold)
- **Selection Integration**: 
  - Click unselected token: Opens menu if "Show on Selection" enabled
  - Click selected token: Toggles menu open/closed
  - Right-click any token: Closes menu
- **Better Rolls Integration**: Seamlessly creates attack cards via Better Rolls for SWADE

### ⚙️ Customization Options
- **Show on Selection**: Toggle automatic menu display on token selection
- **Reopen After Drag**: Control whether menu reopens after moving tokens
- **Items Per Row**: Configure menu layout (1-8 items per row)
- **Icon Scale**: Adjust icon size (0.3-1.2x grid size)
- **Detailed Tooltips**: Toggle between simple and detailed weapon information
- **Auto-Remove Targets**: Clear existing targets when selecting new weapons
- **Hide Target Button**: Optional removal of default target button from token HUD

### 🏗️ Architecture Highlights
- **Hybrid Event System**: Optimized libWrapper + PIXI event handling
- **State Machine**: Reliable menu lifecycle management (CLOSED → OPENING → OPEN → CLOSING)
- **Resource Management**: Automatic cleanup via CleanupManager base class
- **Memory Efficient**: WeakMap-based tracking prevents memory leaks
- **Performance Focused**: Controlled token caching reduces DOM queries

### 🔧 Current Limitations
- Single target selection only (multiple targets planned for future release)

## Installation

1. In Foundry VTT, navigate to the "Add-on Modules" tab
2. Click "Install Module"
3. Paste this manifest URL:
   ```
   https://raw.githubusercontent.com/Von-Junzt/tokencontextmenu/main/module.json
   ```
4. Click "Install"
5. Enable the module in your SWADE game world

### Dependencies

- **Foundry VTT**: Version 12 or higher (tested with v12.331)
- **SWADE System**: v4.0.0 or higher (tested with v4.4.3)
- **lib-wrapper**: v1.8.0 or higher
- **Better Rolls for SWADE 2**: v2.0.0 or higher (required for dice rolling)

### Optional Dependencies

- **lib - ColorSettings**: Provides enhanced color picker interface for equipment badge colors. Without this module, color settings will use standard text inputs.

## Usage

### Basic Usage
1. **Opening the Menu**:
   - Click unselected token → Selects and opens menu (if setting enabled)
   - Click already selected token → Toggles menu open/closed
   - Right-click any token → Closes menu if open

2. **Using Weapons**:
   - Left-click weapon → Enter targeting mode or roll immediately (AOE/templates)
   - Right-click weapon → Open item sheet for editing
   - Escape key → Close menu
   - Click outside → Close menu

### Keyboard Shortcuts
- **Escape**: Close the weapon menu

### Tips
- The menu automatically positions itself below the token
- Weapons are sorted by equip status (two-handed → main hand → off-hand → carried → melee)
- Powers appear in a separate section below weapons
- Only equipped weapons and favorited powers appear in the menu
- Menu won't open if you click and immediately drag a token

## Configuration

Access module settings through Foundry's module configuration:

| Setting | Default | Description                                |
|---------|---------|--------------------------------------------|
| Show on Selection | On | Auto-show menu when selecting owned tokens |
| Reopen After Drag | On | Reopen menu after dragging tokens          |
| Items Per Row | 4 | Number of weapons per row (2-8)            |
| Icon Scale | 0.5 | Icon size relative to grid (0.3-1.2)       |
| Detailed Tooltips | On | Show weapon stats in tooltips              |
| Auto-Remove Targets | On | Clear targets when selecting weapons       |
| Expand Weapons by Default | Off | Show carried weapons when menu opens |
| Expand Powers by Default | Off | Show unfavorited powers when menu opens |
| Equipment Badge Color | #00C4FF | Color for equipment and power badges |
| Debug Mode | Off | Enable diagnostic logging |

## Troubleshooting

### Menu Not Appearing
- Ensure you have control of the token
- Check that weapons are equipped or powers are favorited
- Verify Better Rolls for SWADE 2 is installed and active
- Enable debug mode in settings to see diagnostic messages

### Performance Issues
- Check browser console for errors
- Disable conflicting modules that modify token behavior
- Report issues with debug logs enabled

### Conflicts
- The module may conflict with other UI modification modules
- Disable "Show on Selection" if using other token selection handlers
- Check for modules that also wrap `Token._onClickLeft`

### Debug Mode
Enable debug mode in module settings to see detailed logs prefixed with "VJ TCM:"

## Credits

- **Author**: Von Junzt
- **Discord**: von_junzt

## License

This module is released under the [MIT License](LICENSE).
