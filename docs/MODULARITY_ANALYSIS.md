# Modularity Analysis and Future Improvements

## Current State Assessment

### Hardcoded String Checks

1. **Item Type Checks**
   - `item.type === "weapon"` - Found in multiple files
   - `item.type === "power"` - Found in multiple files
   - No support for other item types without code modifications

2. **Equipment Status Magic Numbers**
   - `[5, 4, 2].includes(i.system.equipStatus)` in weaponMenuDisplay.js
   - Direct numeric comparisons throughout the codebase
   - No named constants for equipment states

3. **Property Access Patterns**
   - Direct access to `item.system.*` properties
   - Assumes SWADE-specific data structure
   - No abstraction layer for different game systems

4. **Special Case Handling**
   - Template weapons checked via `Object.values(i.system.templates).some(v => v === true)`
   - Hardcoded tooltip text like " [Carried - Click to equip]"
   - Fixed UI strings not externalized

### Non-Extensible Patterns

1. **Weapon Menu Display** (`weaponMenuDisplay.js`)
   - Separate filter logic for weapons vs powers
   - Adding new item types requires modifying core filtering logic
   - Equipment status arrays hardcoded inline

2. **Equipment Mode Handler** (`EquipmentModeHandler.js`)
   - Special weapon logic hardcoded in `getWeaponUpdateOperations()`
   - Template weapon handling is a separate if-branch
   - No way to register custom equipment behaviors

3. **Tooltip Management** (`WeaponMenuTooltipManager.js`)
   - Hardcoded stat display logic for damage, range, AP, etc.
   - Power-specific PP display in conditional branch
   - No plugin system for custom stats

4. **Sorting System** (`interactionLayerUtils.js`)
   - Fixed priority values in constants
   - Type-specific logic embedded in sort function
   - No way to register custom sort rules

## Future Improvement Plan

### 1. Item Type Registry System

Create `utils/itemTypeRegistry.js`:
```javascript
class ItemTypeRegistry {
    constructor() {
        this.types = new Map();
    }
    
    register(type, config) {
        this.types.set(type, {
            displayName: config.displayName,
            colors: config.colors,
            filterFn: config.filterFn,
            equipStates: config.equipStates,
            tooltipBuilder: config.tooltipBuilder,
            sortPriority: config.sortPriority,
            ...config
        });
    }
    
    getConfig(type) {
        return this.types.get(type) || this.getDefaultConfig();
    }
}

// Usage example:
itemRegistry.register('weapon', {
    displayName: 'Weapon',
    colors: {
        background: 0x333333,
        border: 0x2d2d2e,
        hoverBackground: 0x444444,
        hoverBorder: 0xcccccc
    },
    filterFn: (item) => item.type === 'weapon',
    equipStates: {
        STORED: 0,
        CARRIED: 1,
        OFF_HAND: 2,
        MAIN_HAND: 4,
        TWO_HANDED: 5
    },
    tooltipBuilder: (item, metadata) => { /* ... */ },
    sortPriority: 0
});
```

### 2. Equipment Status Constants

Create in `constants.js`:
```javascript
export const EQUIPMENT_STATUS = {
    STORED: 0,
    CARRIED: 1,
    OFF_HAND: 2,
    // Reserved: 3
    MAIN_HAND: 4,
    TWO_HANDED: 5
};

export const EQUIPMENT_GROUPS = {
    EQUIPPED: [EQUIPMENT_STATUS.TWO_HANDED, EQUIPMENT_STATUS.MAIN_HAND, EQUIPMENT_STATUS.OFF_HAND],
    CARRIED: [EQUIPMENT_STATUS.CARRIED],
    STORED: [EQUIPMENT_STATUS.STORED]
};
```

### 3. Property Access Layer

Create `utils/itemPropertyAccess.js`:
```javascript
export function getItemProperty(item, propertyPath, defaultValue = undefined) {
    // Handle different game systems and data structures
    const pathParts = propertyPath.split('.');
    let current = item;
    
    for (const part of pathParts) {
        if (current?.[part] !== undefined) {
            current = current[part];
        } else {
            return defaultValue;
        }
    }
    
    return current;
}

export function isItemEquipped(item) {
    const status = getItemProperty(item, 'system.equipStatus', 0);
    return EQUIPMENT_GROUPS.EQUIPPED.includes(status);
}
```

### 4. Tooltip Plugin System

Enhance `WeaponMenuTooltipManager.js`:
```javascript
class TooltipPluginRegistry {
    constructor() {
        this.builders = new Map();
    }
    
    registerBuilder(itemType, builderFn) {
        if (!this.builders.has(itemType)) {
            this.builders.set(itemType, []);
        }
        this.builders.get(itemType).push(builderFn);
    }
    
    buildTooltip(item, metadata) {
        const builders = this.builders.get(item.type) || [];
        const sections = [];
        
        for (const builder of builders) {
            const section = builder(item, metadata);
            if (section) sections.push(section);
        }
        
        return sections;
    }
}

// Register default builders
tooltipRegistry.registerBuilder('weapon', (item) => {
    const stats = [];
    if (item.system.damage) stats.push(`🗲 Damage: ${item.system.damage}`);
    if (item.system.range) stats.push(`🏹︎ Range: ${item.system.range}`);
    return stats;
});
```

### 5. Configuration-Based Special Items

Add to module settings:
```javascript
{
    specialItemPatterns: {
        name: "Special Item Patterns",
        scope: "world",
        config: true,
        type: Array,
        default: [
            { pattern: "unarmed attack", type: "substring" },
            { pattern: "claws", type: "substring" },
            { pattern: "knife", type: "substring" }
        ]
    }
}
```

### 6. Equipment Behavior Strategies

Create `utils/equipmentStrategies.js`:
```javascript
class EquipmentStrategyRegistry {
    constructor() {
        this.strategies = new Map();
    }
    
    register(condition, strategy) {
        this.strategies.set(condition, strategy);
    }
    
    getStrategy(item) {
        for (const [condition, strategy] of this.strategies) {
            if (condition(item)) return strategy;
        }
        return this.defaultStrategy;
    }
}

// Register strategies
equipmentStrategies.register(
    item => isSpecialWeapon(item),
    {
        getValidStates: () => [EQUIPMENT_STATUS.CARRIED, EQUIPMENT_STATUS.MAIN_HAND],
        getNextState: (current) => current > 1 ? 1 : 4,
        getDescription: (current) => current > 1 ? "Unequipping" : "Equipping"
    }
);
```

### 7. Externalized UI Configuration

Create `config/uiStrings.js`:
```javascript
export const UI_STRINGS = {
    tooltips: {
        carried: " [Carried - Click to equip]",
        stored: " [Stored Template - Click to carry]",
        unfavorited: " [Click to favorite]"
    },
    separator: {
        powers: "───── Powers ─────"
    }
};
```

### 8. Composable Sort Rules

Create `utils/sortRules.js`:
```javascript
class SortRuleEngine {
    constructor() {
        this.rules = [];
    }
    
    addRule(name, compareFn, priority = 0) {
        this.rules.push({ name, compareFn, priority });
        this.rules.sort((a, b) => a.priority - b.priority);
    }
    
    createComparator() {
        return (a, b) => {
            for (const rule of this.rules) {
                const result = rule.compareFn(a, b);
                if (result !== 0) return result;
            }
            return 0;
        };
    }
}

// Usage
sortEngine.addRule('itemType', (a, b) => {
    const priorityA = getItemTypePriority(a.type);
    const priorityB = getItemTypePriority(b.type);
    return priorityA - priorityB;
}, 0);

sortEngine.addRule('equipStatus', (a, b) => {
    return a.system.equipStatus - b.system.equipStatus;
}, 10);

sortEngine.addRule('alphabetical', (a, b) => {
    return a.name.localeCompare(b.name);
}, 20);
```

## Implementation Priority

1. **Phase 1 - Constants and Basic Abstraction**
   - Equipment status constants
   - Property access layer
   - Externalized UI strings

2. **Phase 2 - Type Registry**
   - Item type registry
   - Basic plugin system for tooltips
   - Configuration-based special items

3. **Phase 3 - Advanced Features**
   - Equipment behavior strategies
   - Composable sort rules
   - Full plugin architecture

## Benefits

1. **Extensibility**: New item types can be added without modifying core code
2. **Maintainability**: Configuration changes don't require code changes
3. **Compatibility**: Easier to support different game systems
4. **Customization**: GMs can customize behavior through settings
5. **Testing**: Modular components are easier to unit test

## Migration Strategy

1. Implement new systems alongside existing code
2. Gradually migrate features to use new systems
3. Deprecate old patterns once migration is complete
4. Maintain backwards compatibility during transition

This modularity improvement would transform the codebase from a SWADE-specific weapon/power system into a flexible item management framework that can handle any game system or item type.