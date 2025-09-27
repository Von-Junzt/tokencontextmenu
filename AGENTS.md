# Repository Guidelines

## Project Structure & Module Organization
Token Context Menu is delivered as plain ES modules for Foundry VTT. `main.js` is the entrypoint that wires hooks and exposes debug helpers. UI logic lives in `applications/weaponMenuApplication.js`. Behavioral orchestration is split across `managers/` (state machines, tooltips, drag handlers) and `utils/` (interaction layer utilities, timing guards, menu builders). Event subscriptions sit in `hooks/`, while `settings/` registers configurable options. Visual assets are stored in `icons/`, localized strings in `lang/`, and design references in `docs/`. Update `module.json` whenever you add settings, assets, or manifest metadata.

## Build, Test, and Development Commands
There is no bundler or compile step; edit files in place. For local playtesting, symlink the repo into your Foundry data path, e.g. `ln -s $(pwd) ~/FoundryVTT/Data/modules/tokencontextmenu`. Launch Foundry pointing at that data directory and reload the world to pick up changes. Use the browser console helpers (`tokencontextmenu.getSystemState()` etc.) defined in `main.js` for quick diagnostics.

## Coding Style & Naming Conventions
Use ES modules with relative imports and keep each manager or utility focused on a single concern. Follow the existing spacing: four-space indentation, trailing commas on multiline structures, and single quotes for Foundry hook names. Export PascalCase classes (`WeaponMenuTokenClickManager`) and camelCase functions (`registerTokenHudSelectionHandler`). Route logging through `debug`/`debugWarn` from `utils/debug.js` so users can toggle diagnostics via settings. Keep ASCII art banners and other console UX touches intact unless there is a compelling usability reason to alter them.

## Testing Guidelines
Automated tests are not yet in place, so rely on manual verification inside a SWADE world. Exercise token selection, drag workflows, and targeting scenarios after each change. Watch the browser console for `VJ TCM` logs and warnings. When fixing defects, add reproducible steps to `docs/` if the scenario is non-obvious and consider temporary feature flags via module settings when introducing risky behavior.

## Commit & Pull Request Guidelines
Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) in lowercase, mirroring the existing history. Keep messages imperative and scoped (`feat: add equipment mode reload icon`). PRs should include a brief summary, linked issues, manual test notes, and screenshots or screen recordings for UI changes. Call out any migrations required for `module.json` or localization strings so maintainers can review them carefully.

## Localization & Assets
Add new icon art under `icons/` with descriptive filenames, and reference them via relative paths to keep manifest portability. When introducing user-facing text, update the appropriate `lang/*.json` entry and ensure `defaults` keys stay consistent with Foundry expectations. Optimize large assets and document any licensing constraints in `docs/`.
