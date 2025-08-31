/**
 * @file Interaction layer utilities for token and targeting management
 * @description Manages canvas interaction layers, targeting workflows, and UI tooltips
 */

import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { targetingSessionManager } from "../managers/TargetingSessionManager.js";
import { debugWarn } from "./debug.js";
import { WEAPON_PRIORITY } from "./constants.js";

// Global interaction layer management
let globalInteractionLayer = null;
let isLayerActive = false;
let _tooltipMouseHandler = null;

/**
 * Shows a styled "Select Target" tooltip that follows the cursor
 * @param {boolean} show - Whether to show or hide the tooltip
 */
export function showTargetTooltip(show = true) {
    if (show) {
        if (!document.getElementById('cursor-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'cursor-tooltip';
            tooltip.className = 'tokencontextmenu-tooltip';
            tooltip.textContent = 'Select Target';
            document.body.appendChild(tooltip);

            _tooltipMouseHandler = (e) => {
                const tooltip = document.getElementById('cursor-tooltip');
                if (tooltip) {
                    tooltip.style.left = (e.clientX + 15) + 'px';
                    tooltip.style.top = (e.clientY + 10) + 'px';
                }
            };

            document.addEventListener('mousemove', _tooltipMouseHandler);
        }
    } else {
        hideTargetTooltip();
    }
}

/**
 * Hide the tooltip and clean up event listeners
 */
function hideTargetTooltip() {
    if (_tooltipMouseHandler) {
        document.removeEventListener('mousemove', _tooltipMouseHandler);
        _tooltipMouseHandler = null;
    }

    const tooltip = document.getElementById('cursor-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

/**
 * Initialize the global interaction layer
 */
export function initializeGlobalInteractionLayer() {
    if (globalInteractionLayer) {
        deactivateInteractionLayer();
    }

    globalInteractionLayer = new PIXI.Container();
    globalInteractionLayer.name = "tokencontextmenu-targeting-layer";

    updateInteractionLayerHitArea();

    globalInteractionLayer.eventMode = 'static';
}

/**
 * Activate the interaction layer
 */
function activateInteractionLayer() {
    if (globalInteractionLayer && !isLayerActive) {
        canvas.stage.addChild(globalInteractionLayer);
        isLayerActive = true;
    }
}

/**
 * Deactivate the interaction layer
 */
export function deactivateInteractionLayer() {
    if (globalInteractionLayer && isLayerActive) {
        if (globalInteractionLayer.parent) {
            globalInteractionLayer.parent.removeChild(globalInteractionLayer);
        }
        globalInteractionLayer.removeAllListeners();
        isLayerActive = false;
    }
}

/**
 * Update the hit area for canvas resize/scene changes
 */
export function updateInteractionLayerHitArea() {
    if (globalInteractionLayer && canvas?.dimensions) {
        globalInteractionLayer.hitArea = new PIXI.Rectangle(
            0, 0,
            canvas.dimensions.width,
            canvas.dimensions.height
        );
    }
}

/**
 * Get the global interaction layer, creating if needed
 */
function getGlobalInteractionLayer() {
    if (!globalInteractionLayer) {
        initializeGlobalInteractionLayer();
    }
    return globalInteractionLayer;
}

/**
 * Reset the global interaction layer
 */
export function resetGlobalInteractionLayer() {
    deactivateInteractionLayer();
    globalInteractionLayer = null;
}

/**
 * Returns the priority of a weapon or power for sorting in the token HUD.
 * Lower values appear first in the list.
 * @param {Object} item - The weapon or power item
 * @returns {number} - The sort priority
 */
export function getWeaponSortPriority(item) {
    if (item.type === 'power') {
        return WEAPON_PRIORITY.POWER;
    }

    if (item.type === 'weapon') {
        const weaponName = item.name.toLowerCase();

        // Check for special weapon types - they go to the end
        if (WEAPON_PRIORITY.SPECIAL_WEAPONS.some(special => weaponName.includes(special))) {
            return WEAPON_PRIORITY.WEAPON_TYPE_GROUP.SPECIAL;
        }

        // Map equipment status to priority
        const equipStatusMap = {
            5: WEAPON_PRIORITY.EQUIPMENT.TWO_HANDED,
            4: WEAPON_PRIORITY.EQUIPMENT.ONE_HANDED,
            2: WEAPON_PRIORITY.EQUIPMENT.OFF_HAND,
            1: WEAPON_PRIORITY.EQUIPMENT.CARRIED,
            0: WEAPON_PRIORITY.EQUIPMENT.STORED
        };

        const basePriority = equipStatusMap[item.system.equipStatus] ?? WEAPON_PRIORITY.DEFAULT;

        // Get the weapon's trait (skill used) to determine weapon type
        const trait = item.system?.actions?.trait?.toLowerCase() || "";
        
        // Determine weapon type group based on skill/trait
        let typeGroup = WEAPON_PRIORITY.WEAPON_TYPE_GROUP.MELEE; // Default to melee
        
        if (trait.includes("fighting")) {
            typeGroup = WEAPON_PRIORITY.WEAPON_TYPE_GROUP.MELEE;
        } else if (trait.includes("shooting")) {
            typeGroup = WEAPON_PRIORITY.WEAPON_TYPE_GROUP.RANGED;
        } else if (trait.includes("athletics") || trait.includes("throwing")) {
            typeGroup = WEAPON_PRIORITY.WEAPON_TYPE_GROUP.THROWN;
        }
        
        return typeGroup + basePriority;
    }

    return WEAPON_PRIORITY.OTHER;
}

/**
 * Gets the sort priority for items in equipment mode
 * Ignores equipment/favorite status to maintain consistent positioning
 * @param {Item} item - The item to get priority for
 * @returns {number} Sort priority value
 */
export function getItemSortPriorityEquipmentMode(item) {
    if (item.type === 'power') {
        // All powers get same priority, will be sorted alphabetically
        return WEAPON_PRIORITY.POWER;
    }

    if (item.type === 'weapon') {
        const weaponName = item.name.toLowerCase();

        // Check for special weapon types - they go to the end
        if (WEAPON_PRIORITY.SPECIAL_WEAPONS.some(special => weaponName.includes(special))) {
            return WEAPON_PRIORITY.WEAPON_TYPE_GROUP.SPECIAL;
        }

        // Get the weapon's trait (skill used) to determine weapon type
        const trait = item.system?.actions?.trait?.toLowerCase() || "";
        
        // Determine weapon type group based on skill/trait
        // Return type group only, no equipment status consideration
        if (trait.includes("fighting")) {
            return WEAPON_PRIORITY.WEAPON_TYPE_GROUP.MELEE;
        } else if (trait.includes("shooting")) {
            return WEAPON_PRIORITY.WEAPON_TYPE_GROUP.RANGED;
        } else if (trait.includes("athletics") || trait.includes("throwing")) {
            return WEAPON_PRIORITY.WEAPON_TYPE_GROUP.THROWN;
        }
        
        // Default to melee for weapons without a clear trait
        return WEAPON_PRIORITY.WEAPON_TYPE_GROUP.MELEE;
    }

    return WEAPON_PRIORITY.OTHER;
}

/**
 * Sets up click handlers for target selection with enhanced state coordination
 * 
 * Uses direct position checking for token hit detection to ensure correctness
 * when tokens move during targeting (common in multiplayer games).
 * Checks current token positions on every mouse move/click for accurate detection.
 * 
 * @param {Object} pendingData - The pending weapon roll data
 * @param {Function} onTargetSelected - Callback when target is selected
 * @param {Function} onAbort - Callback when targeting is aborted
 * @returns {Function} Cleanup function
 */
export function setupTargetClickHandlers(pendingData, onTargetSelected, onAbort) {
    if (targetingSessionManager.isActive()) {
        debugWarn('Targeting already active, aborting previous session');
        targetingSessionManager.endSession();
    }

    const sessionId = Date.now() + Math.random();

    showTargetTooltip(true);

    const interactionLayer = getGlobalInteractionLayer();
    interactionLayer.removeAllListeners();
    activateInteractionLayer();

    const originalCursor = canvas.app.view.style.cursor;

    let hoveredToken = null;
    let isFinishing = false;

    const handlePointerMove = (event) => {
        if (!targetingSessionManager.isCurrentSession(sessionId)) {
            return;
        }

        // Get canvas coordinates directly from event global position
        const point = event.data.getLocalPosition(canvas.stage);
        const x = point.x;
        const y = point.y;

        // Find token using direct position checks (always current)
        const targetedToken = canvas.tokens.placeables.find(token => {
            return x >= token.x && 
                   x <= (token.x + token.w) && 
                   y >= token.y && 
                   y <= (token.y + token.h);
        })

        // Set cursor on both canvas view and interaction layer for v13
        const cursorStyle = targetedToken ? 'pointer' : 'default';
        canvas.app.view.style.cursor = cursorStyle;
        interactionLayer.cursor = cursorStyle;

        if (hoveredToken !== targetedToken) {
            if (hoveredToken) hoveredToken.hover = false;
            hoveredToken = targetedToken;
            if (hoveredToken) hoveredToken.hover = true;
        }
    };

    const handlePointerDown = (event) => {
        if (!targetingSessionManager.isCurrentSession(sessionId)) {
            return;
        }

        const btn = event.data?.button ?? event.data?.originalEvent?.button;

        if (btn === 2) {
            onAbort("Targeting cancelled.");
            targetingSessionManager.endSession();
            return;
        }

        if (btn === 0) {
            // Get canvas coordinates directly from event global position
            const point = event.data.getLocalPosition(canvas.stage);
            const x = point.x;
            const y = point.y;

            // Find token using direct position checks (always current)
            const targetedToken = canvas.tokens.placeables.find(token => {
                return x >= token.x && 
                       x <= (token.x + token.w) && 
                       y >= token.y && 
                       y <= (token.y + token.h);
            })

            if (targetedToken) {
                targetedToken.setTarget(true, {user: game.user, releaseOthers: true, groupSelection: false});
                onTargetSelected();
                targetingSessionManager.endSession();
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" && targetingSessionManager.isCurrentSession(sessionId)) {
            onAbort("Targeting cancelled.");
            targetingSessionManager.endSession();
        }
    };

    interactionLayer.on('pointermove', handlePointerMove);
    interactionLayer.on('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    function finishTargeting() {
        if (isFinishing) {
            debugWarn('Attempted double cleanup, ignoring');
            return;
        }
        isFinishing = true;

        interactionLayer.off('pointermove', handlePointerMove);
        interactionLayer.off('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);

        deactivateInteractionLayer();

        canvas.app.view.style.cursor = originalCursor;

        if (hoveredToken) {
            hoveredToken.hover = false;
            hoveredToken = null;
        }

        hideTargetTooltip();
    }

    targetingSessionManager.startSession(sessionId, finishTargeting);

    return () => {
        onAbort("Targeting manually aborted.");
        targetingSessionManager.endSession();
    };
}

/**
 * Emergency cleanup function for targeting state
 */
export function emergencyCleanupTargeting() {
    targetingSessionManager.endSession();
}