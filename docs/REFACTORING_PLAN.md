# Token Context Menu — Refactoring Plan (v2: **No Visual Change**)

## Executive Summary
Refactor internals for maintainability and performance **without changing** the current visual presentation or interaction model. No panels, tabs, or re‑theming. The menu should look and behave **exactly** as it does today while we consolidate event handling and feature logic behind the scenes.

---

## Non‑Negotiable UX/Visual Guardrails
**These must remain byte‑for‑byte identical in effect:**
- **Rendering:** PIXI-based overlay, same container name (`vjpmacros-weapon-menu`), zIndex, anchor/pivot, and hit‑area behavior.
- **Positioning:** Same placement relative to the controlled token; same offsets for 1× and multi‑grid scales.
- **Gestures:**
  - Selecting a token may open the menu (if setting enabled).
  - Left‑click on already selected token toggles the menu.
  - Right‑click and `Esc` close the menu.
  - Dragging a token prevents opening and closes an open menu.
  - "First pointerup after selection" does **not** open (selection‑epoch guard).
- **Animations:** Open (ease‑out‑quad) and close (fade) timings unchanged.
- **Look:** Colors, sizes, typography, spacing, iconography, hover states, badges (equipment), reload indicators, desaturation rules.
- **Tooltips:** Identical HTML/PIXI composition, position math, and enable/disable setting behavior.

> **UI Contract:** Keep child ordering and names in the menu container stable so existing CSS/positioning and any downstream integrations remain unaffected.

---

## Target Architecture (Internal Only)
**We keep the current menu visuals and public hooks; we only change internals.**

1) **`WeaponMenuApplication` (keep as the visual implementation)**
- Continues to render the exact same menu.
- Optionally provide a thin alias `TokenContextMenuCompat` if we need a new façade, but the original class remains the source of truth during migration.

2) **`TokenInteractionHandler` (new, authoritative event layer)**
- Single place for selection/re‑click/drag/close logic.
- Listens via libWrapper to Foundry hooks and via PIXI to `canvas.stage`.
- Implements **selection‑epoch** (ignore the first `pointerup` immediately after selection) and a distance + time **drag threshold**.

3) **`WeaponActionHandler` (new, feature logic)**
- Orchestrates weapon use, equipment toggles, reload, and targeting start/finish.
- BR/other roll systems sit behind a small **ActionSink adapter** so integrations can change without touching the UI.

> Optional later: a `MenuDataProvider` interface to centralize data shaping for the menu, but the UI consumption stays the same.

---

## State Management Strategy
- **Preserve the existing FSM and any operation queue** initially to guarantee behavior. Document what each state gates (OPENING vs OPEN, etc.).
- After a soak period and once the event layer is stable, **consider** reducing to `isOpen` + `isTransitioning` + `epoch` if—and only if—observability shows zero regressions. This is a separate, opt‑in phase.

---

## ECT Integration Policy
- **No panel or tab UI.**
- Keep the **ECT menu visually separate as it is today**.
- If we unify anything, it's the **data/logic** path (shared `MenuDataProvider` or calls routed through `WeaponActionHandler`). The user‑facing menu(s) remain unchanged.

---

## Migration Plan (Safe & Incremental)

### Phase 0 — Safety & Baseline ✅ COMPLETE
- ✅ Functional test checklist created and maintained
- ✅ Feature flags implemented in `FEATURE_FLAGS` constants
- ✅ Settings registered for `enableCentralizedHandler` and `enableExtractedFeatureLogic`
- ✅ Both flags default to `false` for safety
- ✅ Parallel old/new implementations coexist via feature flags

### Phase 1 — Centralize Events (no UI change) ✅ COMPLETE
- ✅ `TokenInteractionHandler` implemented behind `enableCentralizedHandler` flag
- ✅ Drag detection using distance-only threshold (5px)
- ✅ Selection-epoch guard implemented with WeakMap
- ✅ Unified event handling: libWrapper for left-clicks, PIXI for right-clicks
- ✅ Old managers kept in parallel, activated when flag is disabled
- ✅ Successfully tested and committed

### Phase 2 — Extract Feature Logic ✅ COMPLETE
- ✅ Feature logic already properly separated into specialized managers:
  - `EquipmentModeHandler` - Equipment toggle and business logic
  - `TargetingSessionManager` - Weapon targeting workflows
  - `WeaponMenuTooltipManager` - Tooltip creation and management
  - `WeaponSystemCoordinator` - Central facade for all subsystems
- ✅ Better Rolls integration maintained via existing handlers
- ✅ Feature flag `enableExtractedFeatureLogic` available for enhanced logic
- ✅ Single responsibility principle achieved across managers

### Phase 3 — Tooltip/Internal Utilities ✅ COMPLETE (2025-01-27)
- ✅ Tooltip logic already consolidated in `WeaponMenuTooltipManager`
- ✅ Extracted magic numbers to `TOOLTIP` constants:
  - `CURSOR_OFFSET_Y`: 25px below cursor for weapon tooltips
  - `CURSOR_OFFSET_X_TARGET`: 15px right for target tooltip
  - `CURSOR_OFFSET_Y_TARGET`: 10px below for target tooltip
  - `EDGE_PADDING`: 10px minimum from viewport edges
- ✅ Updated all implementations to use constants from `utils/constants.js`
- ✅ Preserved DOM/PIXI structure and styles unchanged
- ✅ No visual changes - positioning math identical

### Phase 4 — (Optional) Simplify State
- After multiple releases without regressions, evaluate shrinking FSM to a minimal guard. Ship behind a setting/flag; default to legacy behavior for one version.

### Phase 5 — (Optional) ECT Logic Unification
- Introduce shared data/logic adapters only; keep ECT's UI untouched.

---

## Performance & Cleanup Rules (No Visual Impact)
- Reuse a single PIXI menu container; rebuild **contents**, not the container.
- Preload and reuse textures/icons; avoid recreating Sprites per open.
- Throttle pointermove/hover work to ~16–33ms; avoid `cacheAsBitmap` for dynamic lists.
- Ensure teardown on `canvasTearDown`/scene switch; unbind all PIXI and document listeners in `close()`.
- Verify WeakMap usage for all token references to prevent memory leaks.
- Check for orphaned PIXI containers after close.

---

## Testing & Acceptance

### Performance Benchmarks
- Menu open time < 50ms
- Memory growth < 1MB per 100 opens
- No frame drops during animations

### UI Contract Checks
- Container name, child order, zIndex unchanged
- Open/close animation timings exact (measure with timestamps)
- Hover/tooltip pixel offsets identical within 1 px
- Smoke tests for rapid select/re‑click/drag cycles and scene changes

### Functional Test Checklist (Must Pass 100%)
#### Core Interactions
- [ ] Token selection opens menu (with setting enabled)
- [ ] Click on selected token toggles menu
- [ ] Right-click closes menu
- [ ] Escape key closes menu
- [ ] Drag detection prevents menu (5px threshold)
- [ ] Menu closes during movement
- [ ] Menu reopens after movement (with setting)
- [ ] Selection-epoch guard prevents immediate open

#### Visual Presentation
- [ ] Menu appears below token
- [ ] All colors match COLORS constants
- [ ] All sizes match SIZES constants
- [ ] Opening animation plays (ease-out-quad)
- [ ] Closing animation plays (fade out)
- [ ] Hover effects work on all buttons
- [ ] Equipment badges appear correctly
- [ ] Reload buttons show when needed
- [ ] Carried/unfavorited items are desaturated

#### Weapon Features
- [ ] Click weapon enters targeting mode
- [ ] AOE weapons skip targeting
- [ ] Equipment mode toggles properly
- [ ] Special weapons behave correctly
- [ ] Template weapons restricted to carried/stored
- [ ] Powers toggle favorite status
- [ ] Reload functionality works

#### Integration
- [ ] Better Rolls creates attack cards
- [ ] ECT menu opens/closes properly
- [ ] Blur effects work with ECT
- [ ] Tooltips show weapon details
- [ ] Settings control all features

#### Technical
- [ ] No console errors
- [ ] No memory leaks (verify with profiler)
- [ ] Works for GM and players
- [ ] Handles rapid interactions
- [ ] Cleans up on scene change

---

## Risk Register & Mitigations
- **Visual regression:** prohibited; we keep side‑by‑side before/after screenshots for each phase.
- **Event routing mistakes:** keep old managers enabled via flag during Phase 1; fallback instantly if anomalies appear.
- **Integration drift (BR, settings):** covered by the `ActionSink`/typed getters; write stubbed unit tests for critical paths.
- **Memory leaks:** Use WeakMaps consistently, verify cleanup in profiler after each phase.

### Rollback Procedure
If issue detected:
1. Set feature flag to false immediately
2. Document exact reproduction steps
3. Create git branch for debugging
4. Revert to last stable commit if needed
5. Analyze failure before attempting again

---

## Success Criteria
1. Users perceive **zero** visual/interaction change.
2. Event flow is centralized; logs/readability improve.
3. Feature logic is consolidated under `WeaponActionHandler`.
4. Memory footprint is stable across 50× open/close cycles.
5. Optional simplifications (FSM) only after stable releases.

---

## Out‑of‑Scope (for this pass)
- New panels/tabs/themes.
- Changing menu layout, sizes, or animation curves.
- Replacing PIXI with DOM or vice versa.
- Changing module ID in container names (consider for future).

---

## Implementation Notes

### Container Name Consideration
Current: `vjpmacros-weapon-menu`
Future consideration: `tokencontextmenu-weapon-menu` (after stability achieved)
- Retire `TIMING.DRAG_DETECTION_DELAY` and the ticker-based open delay once the centralized handler ships.
- Ensure menu open/close relies solely on epoch consumption and drag distance checks.


### Selection-Epoch Implementation
```javascript
class TokenInteractionHandler {
    constructor() {
        this.selectionEpochs = new WeakMap(); // token -> {consumed: boolean}
    }

    onTokenSelect(token) {
        this.selectionEpochs.set(token, {
            consumed: false
        });
    }

    onPointerUp(token) {
        const epoch = this.selectionEpochs.get(token);
        if (epoch && !epoch.consumed) {
            epoch.consumed = true;
            return; // Ignore the first pointerup after selection
        }
        // Normal menu toggle logic
    }
}
```

### Timeline Estimates
- **Phase 0:** ✅ COMPLETE - Safety infrastructure and feature flags
- **Phase 1:** ✅ COMPLETE - Event centralization with full testing
- **Phase 2:** ✅ COMPLETE - Feature logic extraction (via previous refactoring)
- **Phase 3:** ✅ COMPLETE - Tooltip consolidation (2025-01-27)
- **Phase 4:** (Deferred) - Only after months of stability
- **Phase 5:** (Deferred) - Only if needed

**Progress:** Core refactoring (Phases 0-3) COMPLETE! The module now has:
- Feature flags for safe testing of new implementations
- Centralized event handling via TokenInteractionHandler
- Properly separated feature logic in specialized managers
- All tooltip magic numbers extracted to constants
- Parallel old/new implementations for rollback safety

---

## Next Steps

### Code Cleanup Complete (2025-01-27) ✅
After successful testing with feature flags enabled, the following cleanup was performed:
1. ✅ **WeaponMenuTokenClickManager** - REMOVED (replaced by TokenInteractionHandler)
2. ✅ **Feature flag code** - REMOVED (new implementations now default)
3. ✅ **Legacy event handling** - REMOVED (including DRAG_DETECTION_DELAY)
4. ✅ **Old weapon handler implementations** - REMOVED (delegates to managers)
5. ✅ **Feature flag settings** - REMOVED from settings.js, constants.js, and lang files

### Current Architecture:
- **TokenInteractionHandler** - Centralized event handling with selection-epoch guard
- **Specialized Managers** - Clean separation of concerns:
  - EquipmentModeHandler - Equipment and reload logic
  - TargetingSessionManager - Weapon targeting workflows
  - WeaponMenuTooltipManager - Tooltip management
  - WeaponSystemCoordinator - Central facade
- **No timing-based solutions** - All event-driven with deterministic checks
- **Git history available** - Old code preserved in git for emergency rollback

---

## Previous Attempt Analysis
The previous refactoring attempt (Phase 5) failed because:
- Too aggressive (removed 5 manager files at once)
- No parallel implementation for testing
- Missing imports and dependencies
- Lost track of complex interactions

This v2 plan addresses these issues through:
- Incremental migration with feature flags
- Parallel old/new implementations
- Method-by-method migration
- Continuous validation at each step
- Explicit rollback procedures

---

## Agent Alignment Addendum (Claude Code `CLAUDE.md`)

This section aligns the plan with repository agent guidance.

### Environment & Standards
- **Foundry v13 only**; do not maintain v12 paths. Use v13 APIs (e.g., **`eventMode`** rather than `interactive`).
- **No timing-based logic**: Avoid `setTimeout`/`setInterval` and time windows. Selection guards are implemented via **event/flag epochs**, not delays.
- **Debugging**: Use the module's `debug/debugWarn/debugError` utilities, not `console.log`.

### Event Architecture (match existing patterns)
- **Left-clicks**: Handle via **libWrapper** on `Token._onClickLeft`; check selection state on **`mouseup`**.
- **Right-clicks**: Handle via **PIXI** (`rightdown`) directly on the tokens layer; close menu immediately.
- **Drag detection**: Use **distance threshold only** (5px) with deterministic checks; **no time thresholds**.
- **No lastMouseButton coupling** between events.

### Component Naming & Roles
- Keep **`WeaponSystemCoordinator`** as the facade and lifecycle orchestrator.
- Treat the proposed `TokenInteractionHandler` as an **evolution of the existing `WeaponMenuTokenClickManager`** (not a new parallel class). All centralization work happens here.
- Keep **`EquipmentModeHandler`** and **`TargetingSessionManager`**. The previously proposed `WeaponActionHandler` is **dropped**; its responsibilities remain with these existing components plus small adapters where needed (e.g., BR integration).
- Keep **`WeaponMenuApplication`** as the visual implementation with the **state machine + operation queue** intact during the migration.

### Testing & Tooling
- Maintain the **manual parity checklist** and in‑Foundry testing. Do **not** add standalone test scripts unless explicitly requested.
- Keep native ES modules; bundling is optional and **not required**.

### Visual/Behavioral Contract (no change)
- All prior guardrails apply (identical look, positioning, animations, gestures, tooltips, container names, and child order).

### Migration Notes
- Phase 1 now explicitly: refactor **`WeaponMenuTokenClickManager`** to become the **single authoritative** event layer (wrapping libWrapper + PIXI), implement the **selection‑epoch flag** (first `mouseup` post‑selection is ignored), and unify drag logic (distance-only threshold). Other phases remain as written, minus `WeaponActionHandler`.

---

## Controlled Debounce Exception (per agent policy)

**Principle:** No raw `setTimeout`/`setInterval` for correctness. If rate‑limiting is necessary, use **Foundry's own utilities** only, and never to mask race conditions.

### Allowed utilities
- `foundry.utils.debounce(fn, wait, {leading:false, trailing:true})`
- `foundry.utils.debouncePromise(fn, wait, {leading:false, trailing:true})` (for async work)

### What debounce may be used for (OK)
- **High‑frequency UI recalculations** that do not affect logic correctness:
  - Repositioning the menu on `canvasPan/zoom`, window resize.
  - Hover/tooltip layout updates driven by `pointermove`.
  - Batch style/size recomputation when multiple settings change at once.
- **Streaming updates** (e.g., rapid `updateToken` position changes) to avoid thrashing.

### What debounce must NOT be used for (NO)
- Deciding whether to **open/close** the menu.
- **Selection‑epoch** or any correctness guard.
- Ordering/serialization of actions (use state/epochs instead).

### Implementation notes
- Prefer small waits: **16–33 ms** for hover/positioning; **50–100 ms** for resize/pan.
- Always **store and dispose** debounced functions on teardown (scene switch, `close()`), e.g.:
  ```js
  this._repositionDebounced = foundry.utils.debounce(() => this._repositionNow(), 33);
  Hooks.on('canvasPan', this._repositionDebounced);
  // ...
  close() {
    Hooks.off('canvasPan', this._repositionDebounced);
    this._repositionDebounced?.cancel?.();
  }
  ```
- For async data preparation, use `debouncePromise` so callers can `await` the debounced result:
  ```js
  this._buildMenuData = foundry.utils.debouncePromise(async () => {
    // assemble data
    return payload;
  }, 33);
  ```
- Keep **leading=false, trailing=true** to avoid double fires; never rely on the debounce *delay* to implement behavior.