/**
 * @file Interaction layer utilities for token and targeting management
 * @description Manages canvas interaction layers, targeting workflows, and UI tooltips
 */

import { weaponSystemCoordinator } from "../managers/WeaponSystemCoordinator.js";
import { targetingSessionManager } from "../managers/TargetingSessionManager.js";

// Define priority maps
const EQUIPMENT_PRIORITY = {
    5: 0,    // Two-handed weapons (highest priority)
    4: 1,    // One-handed weapons (second priority)
    2: 2,    // Off-Hand weapons (third priority)
    1: 3,    // Carried weapons (fourth priority)
    0: 4     // Stored (lowest priority)
};

const SPECIAL_WEAPON_PRIORITY = {
    "claws": 98,
    "unarmed attack": 99
};

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

    if (globalInteractionLayer.eventMode !== undefined) {
        globalInteractionLayer.eventMode = 'static';
    } else {
        globalInteractionLayer.interactive = true;
        globalInteractionLayer.interactiveChildren = true;
    }
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
        return 95;
    }

    if (item.type === 'weapon') {
        const weaponName = item.name.toLowerCase();

        for (const [key, priority] of Object.entries(SPECIAL_WEAPON_PRIORITY)) {
            if (weaponName.includes(key)) {
                return priority;
            }
        }

        return EQUIPMENT_PRIORITY[item.system.equipStatus] ?? 50;
    }

    return 100;
}

/**
 * Sets up click handlers for target selection with enhanced state coordination
 * @param {Object} pendingData - The pending weapon roll data
 * @param {Function} onTargetSelected - Callback when target is selected
 * @param {Function} onAbort - Callback when targeting is aborted
 * @returns {Function} Cleanup function
 */
export function setupTargetClickHandlers(pendingData, onTargetSelected, onAbort) {
    if (targetingSessionManager.isActive()) {
        console.warn('Token Context Menu: Targeting already active, aborting previous session');
        targetingSessionManager.endSession();
    }

    const sessionId = Date.now() + Math.random();

    showTargetTooltip(true);

    const interactionLayer = getGlobalInteractionLayer();
    interactionLayer.removeAllListeners();
    activateInteractionLayer();

    const originalCursor = document.body.style.cursor;

    let hoveredToken = null;
    let isFinishing = false;

    const handlePointerMove = (event) => {
        if (!targetingSessionManager.isCurrentSession(sessionId)) {
            return;
        }

        const clientPoint = new PIXI.Point(
            event.data.originalEvent.clientX,
            event.data.originalEvent.clientY
        );
        const { x, y } = canvas.canvasCoordinatesFromClient(clientPoint);

        const targetedToken = canvas.tokens.placeables.find(t => {
            const hitArea = new PIXI.Rectangle(t.x, t.y, t.w, t.h);
            return hitArea.contains(x, y);
        });

        document.body.style.cursor = targetedToken ? 'pointer' : 'default';

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
            const clientPoint = new PIXI.Point(
                event.data.originalEvent.clientX,
                event.data.originalEvent.clientY
            );
            const { x, y } = canvas.canvasCoordinatesFromClient(clientPoint);

            const targetedToken = canvas.tokens.placeables.find(t => {
                const hitArea = new PIXI.Rectangle(t.x, t.y, t.w, t.h);
                return hitArea.contains(x, y);
            });

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
            console.warn('Token Context Menu: Attempted double cleanup, ignoring');
            return;
        }
        isFinishing = true;

        interactionLayer.off('pointermove', handlePointerMove);
        interactionLayer.off('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);

        deactivateInteractionLayer();

        document.body.style.cursor = originalCursor;

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