# Event Handling Architecture

## Overview

The Token Context Menu module uses a **hybrid event handling approach** that combines libWrapper and PIXI event listeners. This document explains why this approach is necessary and optimal for Foundry VTT.

## The Challenge

Foundry VTT's Token class implements its own mouse event handling that processes events before they can propagate to custom PIXI listeners:

1. When you left-click a token, Foundry's `Token._onClickLeft` is called immediately
2. This method consumes the event while processing selection logic
3. Custom PIXI listeners never receive the left-click event

## The Solution: Hybrid Approach

### Left-Clicks: libWrapper (Required)
```javascript
libWrapper.register('tokencontextmenu', 'Token.prototype._onClickLeft', function(wrapped, event) {
    // Custom logic here
    return wrapped.call(this, event);
}, 'WRAPPER');
```

**Why libWrapper for left-clicks:**
- ✅ Only way to reliably intercept token left-clicks
- ✅ Minimal performance overhead (one wrapper per Token class, not per instance)
- ✅ Executes synchronously with Foundry's event flow
- ✅ Preserves Foundry's selection logic

### Right-Clicks: PIXI (Optimal)
```javascript
canvas.tokens.on('rightdown', handleRightClick);
```

**Why PIXI for right-clicks:**
- ✅ Right-clicks aren't consumed by Foundry's event system
- ✅ More efficient than libWrapper (one listener at layer level)
- ✅ Native to the rendering engine
- ✅ Cleaner event propagation

## Performance Considerations

### Current Implementation (Hybrid)
- **Left-clicks**: O(1) overhead per click (single wrapper function)
- **Right-clicks**: O(1) overhead per click (layer-level listener)
- **Memory**: Minimal (no per-token listeners needed)

### Alternative Approaches (Not Recommended)

#### Pure PIXI Approach
- ❌ Cannot catch left-clicks on tokens
- ❌ Would require workarounds that break user expectations

#### Pure libWrapper Approach
- ❌ Unnecessary overhead for right-clicks
- ❌ More complex cleanup logic
- ❌ No performance benefit

## Event Flow Diagram

```
Left-Click on Token:
1. User clicks token
2. libWrapper intercepts Token._onClickLeft
3. Custom logic executes
4. Original Token._onClickLeft executes
5. Foundry processes selection

Right-Click on Token:
1. User right-clicks token
2. PIXI event bubbles up to tokens layer
3. Layer listener processes event
4. Menu closes (if open)
```

## Best Practices

1. **Always check token ownership early** to minimize overhead
2. **Use layer-level PIXI listeners** instead of per-token listeners where possible
3. **Clean up event listeners** on scene changes and module disable
4. **Don't fight Foundry's event system** - work with it

## Conclusion

The hybrid approach is not a workaround or compromise - it's the optimal solution that:
- Respects Foundry's event handling architecture
- Minimizes performance overhead
- Provides reliable event interception
- Maintains clean, maintainable code