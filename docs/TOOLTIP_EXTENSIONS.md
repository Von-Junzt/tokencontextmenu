# Tooltip Extensions API

## Overview

The Token Context Menu module provides a hook-based extension system that allows other modules to add custom content to weapon and power tooltips. This enables seamless integration without modifying the core module.

## Hook API

### Hook Name
`tokencontextmenu.buildTooltipStats`

### Parameters
- `weapon` (Object) - The weapon or power item object containing all item data
- `additionalStats` (Array) - A mutable array where you push your custom stat objects

### Stat Object Format
```javascript
{
    icon: string,    // Unicode symbol or emoji (required)
    label: string,   // Localized label text (required)
    value: string    // The value to display (required)
}
```

## Usage Examples

### Basic Example - Adding a Single Stat
```javascript
Hooks.on('tokencontextmenu.buildTooltipStats', (weapon, additionalStats) => {
    // Add a custom stat for all weapons
    if (weapon.type === "weapon") {
        additionalStats.push({
            icon: '⚔',
            label: 'Weight',
            value: weapon.system.weight || '0'
        });
    }
});
```

### Notice Roll Modifier Example
```javascript
Hooks.on('tokencontextmenu.buildTooltipStats', (weapon, additionalStats) => {
    // Add Notice Roll modifier if present
    if (weapon.system?.additionalStats?.noticeRollMod) {
        additionalStats.push({
            icon: '👁',
            label: game.i18n.localize('SWADE.Notice'),
            value: weapon.system.additionalStats.noticeRollMod
        });
    }
});
```

### Multiple Stats Example
```javascript
Hooks.on('tokencontextmenu.buildTooltipStats', (weapon, additionalStats) => {
    // Add multiple custom stats
    if (weapon.type === "power") {
        // Duration
        if (weapon.system.duration) {
            additionalStats.push({
                icon: '⏱',
                label: game.i18n.localize('SWADE.Duration'),
                value: weapon.system.duration
            });
        }
        
        // Trappings
        if (weapon.system.trapping) {
            additionalStats.push({
                icon: '✨',
                label: 'Trapping',
                value: weapon.system.trapping
            });
        }
    }
});
```

### Conditional Stats Based on Flags
```javascript
Hooks.on('tokencontextmenu.buildTooltipStats', (weapon, additionalStats) => {
    // Check for module-specific flags
    if (weapon.flags?.myModule?.specialProperty) {
        additionalStats.push({
            icon: '⚡',
            label: 'Special',
            value: weapon.flags.myModule.specialProperty
        });
    }
});
```

## Best Practices

1. **Always use localization** for labels when possible:
   ```javascript
   label: game.i18n.localize('myModule.statLabel')
   ```

2. **Check data existence** before accessing nested properties:
   ```javascript
   if (weapon.system?.customStats?.myValue) {
       // Safe to use weapon.system.customStats.myValue
   }
   ```

3. **Use appropriate icons** that visually represent your stat:
   - Combat stats: ⚔ 🗡 🛡 ⚡
   - Magic/Powers: ✨ 🔮 ◈ ⭐
   - Information: 👁 📊 ℹ 📝
   - Time/Duration: ⏱ ⌛ 🕐

4. **Keep values concise** - Remember these appear in tooltips

5. **Consider the weapon type** - Some stats may only be relevant for weapons or powers

## Display Order

Additional stats appear after all core stats in the order they were added to the array. The core stats are displayed in this order:
1. Ammo Type (weapons only)
2. Damage
3. Range
4. AP (Armor Piercing)
5. Trait Modifier
6. Power Points (powers only)
7. Your custom stats...

## Integration Checklist

- [ ] Hook into `tokencontextmenu.buildTooltipStats`
- [ ] Validate weapon data before adding stats
- [ ] Use localized labels
- [ ] Choose appropriate unicode icons
- [ ] Test with both weapons and powers
- [ ] Ensure values display correctly

## Notes

- The hook is called for every weapon/power tooltip that displays detailed stats
- Stats are only shown when detailed tooltips are enabled in Token Context Menu settings
- All stat values are converted to strings automatically
- The module handles all HTML generation - just provide the data