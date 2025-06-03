# Token Context Menu for SWADE

A Foundry VTT module that adds a weapon menu for quick access to weapons and powers in the Savage Worlds Adventure Edition (SWADE) system.

![Foundry Version](https://img.shields.io/badge/Foundry-v12-green)
![SWADE Compatible](https://img.shields.io/badge/SWADE-Compatible-blue)

## Features

### 🎯 Quick Weapon Access
- **Token Menu**: Click on any token you control to display a menu of equipped weapons and favorite powers
- **Smart Filtering**: Only shows equipped weapons (including unarmed attacks) and favorited powers
- **Visual Separation**: Powers are visually separated from weapons with a divider line

### 🖱️ Controls
- **Left Click**: Select a weapon to use
- **Right Click**: Open the weapon's item sheet for editing
- **Escape Key**: Close the menu
- **Click Outside**: Close the menu
- **Auto-Close**: Menu automatically closes after 10 seconds of inactivity

### 🎨 UI Design
- **Responsive Layout**: Configurable items per row (default: 4)
- **Scalable Icons**: Adjust icon size relative to grid size
- **Hover Effects**: Visual feedback when hovering over weapons
- **Detailed Tooltips**: Optional detailed weapon stats on hover (damage, range, AP, etc.)
- **Ammo Display**: Shows current/max ammunition for ranged weapons

### ⚡ Workflow
- **Smart Targeting**: 
  - Template weapons (AOE) create attack cards immediately
  - Single-target weapons enter targeting mode if no target selected
  - No timeout - take as long as you need to select targets
  - Auto-remove existing targets option
- **Movement Handling**: Menu hides during token movement and can reopen afterward
- **Token Selection**: Optional auto-show menu when selecting tokens
- **Better Rolls Integration**: Seamlessly works with Better Rolls for SWADE

### ⚙️ Customization Options
- **Show on Selection**: Toggle automatic menu display on token selection
- **Reopen After Drag**: Control whether menu reopens after moving tokens
- **Items Per Row**: Configure menu layout (1-8 items per row)
- **Icon Scale**: Adjust icon size (0.3-1.2x grid size)
- **Detailed Tooltips**: Toggle between simple and detailed weapon information
- **Auto-Remove Targets**: Clear existing targets when selecting new weapons
- **Hide Target Button**: Optional removal of default target button from token HUD

### 🔧 Outlook and limitations
- At the moment only a single target can be selected, planned extension to multiple targets

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

- **Foundry VTT**: Version 12 or higher
- **SWADE System**: Required
- **lib-wrapper**: Required
- **Better Rolls for SWADE 2**: Required for dice rolling functionality

## Usage

### Basic Usage
1. Click on a token you control to open the weapon menu
2. Click a weapon to use it:
   - You'll enter targeting mode
   - Template weapons (AOE) roll without requiring targets
3. Right-click any weapon to edit its item sheet

### Keyboard Shortcuts
- **Escape**: Close the weapon menu

### Tips
- The menu automatically positions itself below the token
- Weapons are sorted by equip status (two-handed → main hand → off-hand → carried → melee)
- Powers appear in a separate section below weapons
- Only equipped weapons and favorited powers appear in the menu

## Configuration

Access module settings through Foundry's module configuration:

| Setting | Default | Description                                |
|---------|---------|--------------------------------------------|
| Show on Selection | On | Auto-show menu when selecting owned tokens |
| Reopen After Drag | On | Reopen menu after dragging tokens          |
| Items Per Row | 8 | Number of weapons per row (1-8)            |
| Icon Scale | 0.5 | Icon size relative to grid (0.3-1.2)       |
| Detailed Tooltips | On | Show weapon stats in tooltips              |
| Auto-Remove Targets | Off | Clear targets when selecting weapons       |
| Hide Target Button | Off | Remove target button from token HUD        |

## Troubleshooting

### Menu Not Appearing
- Ensure you have control of the token
- Check that weapons are equipped or powers are favorited
- Verify Better Rolls for SWADE 2 is installed and active

### Conflicts
- The module may conflict with other UI modification modules
- Disable "Show on Selection" if using other token selection handlers

## Credits

- **Author**: Von Junzt
- **Discord**: von_junzt

## License

This module is released under the [MIT License](LICENSE).
