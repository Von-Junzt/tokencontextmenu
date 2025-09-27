/**
 * @file Tooltip manager for weapon menu
 * @description Manages HTML tooltip creation, positioning, and lifecycle for weapon menu items
 */

import { CleanupManager } from "./CleanupManager.js";
import { debug, debugWarn } from "../utils/debug.js";
import { Z_INDEX, EQUIP_STATUS, TOOLTIP } from "../utils/constants.js";

/**
 * Manages tooltips for the weapon menu
 * Extends CleanupManager for automatic resource cleanup
 */
class WeaponMenuTooltipManager extends CleanupManager {
    constructor() {
        super();
        this._currentTooltip = null;
        this._mouseMoveHandler = null;
        this._tooltipId = 'weapon-menu-tooltip';
    }

    /**
     * Shows a tooltip with the given content
     * @param {string} content - HTML content for the tooltip
     * @param {PIXI.InteractionEvent} event - The PIXI interaction event
     */
    show(content, event) {
        // Check for required DOM elements
        if (!document.body || !canvas?.app?.view) {
            debugWarn("Cannot show tooltip - DOM not ready");
            return;
        }

        // Hide any existing tooltip
        this.hide();

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tokencontextmenu-immediate-tooltip';
        tooltip.innerHTML = content;
        tooltip.id = this._tooltipId;
        tooltip.style.display = 'block';
        tooltip.style.zIndex = Z_INDEX.TOOLTIP;
        
        document.body.appendChild(tooltip);
        this._currentTooltip = tooltip;

        // Position handler
        const updatePosition = (e) => {
            const tooltip = document.getElementById(this._tooltipId);
            if (!tooltip) return;

            const rect = canvas.app.view.getBoundingClientRect();
            const x = e.clientX || (rect.left + event.data.global.x);
            const y = e.clientY || (rect.top + event.data.global.y);

            // Center horizontally, position below cursor
            tooltip.style.left = (x - tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = (y + TOOLTIP.CURSOR_OFFSET_Y) + 'px';

            // Keep tooltip on screen
            const tooltipRect = tooltip.getBoundingClientRect();

            // Adjust horizontal position if needed
            if (tooltipRect.right > window.innerWidth) {
                tooltip.style.left = (window.innerWidth - tooltipRect.width - TOOLTIP.EDGE_PADDING) + 'px';
            } else if (tooltipRect.left < 0) {
                tooltip.style.left = TOOLTIP.EDGE_PADDING + 'px';
            }

            // Adjust vertical position if needed
            if (tooltipRect.bottom > window.innerHeight) {
                // Show above cursor instead
                tooltip.style.top = (y - tooltipRect.height - TOOLTIP.EDGE_PADDING) + 'px';
            }
        };

        // Initial positioning
        updatePosition(event.data.originalEvent);

        // Track mouse movement
        this._mouseMoveHandler = updatePosition;
        document.addEventListener('mousemove', this._mouseMoveHandler);

        debug("Tooltip shown", { contentLength: content.length });
    }

    /**
     * Hides the current tooltip
     */
    hide() {
        // Remove tooltip element
        const tooltip = document.getElementById(this._tooltipId);
        if (tooltip) {
            tooltip.remove();
        }
        this._currentTooltip = null;

        // Remove mouse handler
        if (this._mouseMoveHandler) {
            document.removeEventListener('mousemove', this._mouseMoveHandler);
            this._mouseMoveHandler = null;
        }
    }

    /**
     * Builds tooltip content for a weapon/power item
     * @param {Object} weapon - The weapon or power item
     * @param {Object} metadata - Item metadata
     * @param {boolean} showDetailed - Whether to show detailed stats
     * @returns {string} HTML content for tooltip
     */
    buildTooltipContent(weapon, metadata, showDetailed = false) {
        // Build the header with weapon name
        let headerContent = weapon.name;

        // Add ammo count if applicable
        if (this._hasAmmo(weapon)) {
            headerContent += ` (${weapon.system.currentShots}/${weapon.system.shots})`;
        }
        
        // Add equipment status as subtitle for weapons
        let equipmentStatusHtml = '';
        if (weapon.type === "weapon" && metadata?.equipStatus !== undefined) {
            const statusLabel = EQUIP_STATUS.LABELS[metadata.equipStatus] || 'Unknown';
            equipmentStatusHtml = `<div class="tooltip-equipment-status">${statusLabel}</div>`;
        }
        // Add favorite status as subtitle for powers
        else if (weapon.type === "power") {
            const favoriteKey = weapon.system.favorite === true ? 'Favorited' : 'Unfavorited';
            const favoriteStatus = game.i18n.localize(`tokencontextmenu.PowerStatus.${favoriteKey}`);
            equipmentStatusHtml = `<div class="tooltip-equipment-status">${favoriteStatus}</div>`;
        }

        // Build tooltip HTML
        let tooltipHtml = '';
        
        // Add detailed stats if enabled
        if (showDetailed && weapon.system && (weapon.type === "weapon" || weapon.type === "power")) {
            const statLines = this._buildStatLines(weapon);
            
            if (statLines.length > 0) {
                tooltipHtml = `<div class="tokencontextmenu-weapon-tooltip">
                    <div class="tooltip-header">
                        ${headerContent}
                        ${equipmentStatusHtml}
                    </div>
                    <hr class="tooltip-separator">
                    ${statLines.map(line => `<div class="tooltip-stat">${line}</div>`).join('')}`;
            } else {
                tooltipHtml = `<div class="tokencontextmenu-weapon-tooltip">
                    <div class="tooltip-header">
                        ${headerContent}
                        ${equipmentStatusHtml}
                    </div>`;
            }
        } else {
            // Simple tooltip
            tooltipHtml = `<div class="tokencontextmenu-weapon-tooltip">
                <div class="tooltip-header">
                    ${headerContent}
                    ${equipmentStatusHtml}
                </div>`;
        }
        
        // Close the tooltip div
        tooltipHtml += '</div>';

        return tooltipHtml;
    }

    /**
     * Checks if a weapon has ammo to display
     * @param {Object} weapon - The weapon item
     * @returns {boolean}
     * @private
     */
    _hasAmmo(weapon) {
        return weapon.type === "weapon" && 
               weapon.system?.currentShots !== undefined && 
               weapon.system?.shots !== undefined &&
               (weapon.system.currentShots > 0 || weapon.system.shots > 0);
    }

    /**
     * Formats a stat value for display in tooltips
     * - Adds "+" prefix to positive numbers if not present
     * - Returns null for zero values to skip display
     * - Preserves existing formatting
     * @param {string|number} value - The stat value to format
     * @returns {string|null} Formatted value or null if zero
     * @private
     */
    _formatStatValue(value) {
        // Handle empty or undefined values
        if (value === undefined || value === null || value === '') {
            return null;
        }
        
        // Convert to string for consistent handling
        const strValue = String(value).trim();
        
        // Check if it's zero (handle both numeric 0 and string '0')
        if (strValue === '0' || strValue === '+0' || strValue === '-0') {
            return null;
        }
        
        // Check if it already has a sign prefix
        if (strValue.startsWith('+') || strValue.startsWith('-')) {
            return strValue;
        }
        
        // Try to parse as number to determine if positive
        const numValue = parseFloat(strValue);
        if (!isNaN(numValue) && numValue > 0) {
            return '+' + strValue;
        }
        
        // Return as-is for other cases (negative numbers already have -)
        return strValue;
    }

    /**
     * Builds stat lines for detailed tooltips
     * @param {Object} weapon - The weapon or power item
     * @returns {Array<string>} Array of stat lines
     * @private
     */
    _buildStatLines(weapon) {
        const statLines = [];

        // Ammo Type - show first for weapons with ammo
        if (weapon.type === "weapon" && weapon.system.ammo) {
            statLines.push(`⦿ Ammo: ${weapon.system.ammo}`);
        }

        // Damage
        if (weapon.system.damage) {
            const damageMod = this._formatStatValue(weapon.system.actions?.dmgMod);
            const damageStr = damageMod ? `${weapon.system.damage} ${damageMod}` : weapon.system.damage;
            statLines.push(`🗲 Damage: ${damageStr}`);
        }

        // Range
        if (weapon.system.range) {
            statLines.push(`🏹︎ Range: ${weapon.system.range}`);
        }

        // AP - show for both weapons and powers
        if (weapon.system.ap !== undefined && weapon.system.ap !== 0) {
            statLines.push(`⛨ AP: ${weapon.system.ap}`);
        }

        // Trait Modifier
        if (weapon.system.actions?.traitMod) {
            const formattedMod = this._formatStatValue(weapon.system.actions.traitMod);
            if (formattedMod) {
                statLines.push(`⊕ Trait Mod: ${formattedMod}`);
            }
        }

        // Power Points - only for powers
        if (weapon.type === "power" && weapon.system.pp !== undefined && weapon.system.pp !== 0) {
            statLines.push(`◈ PP: ${weapon.system.pp}`);
        }

        // Allow other modules to add additional stats
        const additionalStats = [];
        Hooks.call('tokencontextmenu.buildTooltipStats', weapon, additionalStats);
        
        // Append validated additional stats
        additionalStats.forEach(stat => {
            if (stat?.icon && stat?.label && stat?.value !== undefined) {
                const formattedValue = this._formatStatValue(stat.value);
                if (formattedValue) {
                    statLines.push(`${stat.icon} ${stat.label}: ${formattedValue}`);
                }
            }
        });

        return statLines;
    }

    /**
     * Cleanup method called when manager is destroyed
     * @override
     */
    cleanup() {
        this.hide();
        super.cleanup();
    }
}

// Export singleton instance following project pattern
export const weaponMenuTooltipManager = new WeaponMenuTooltipManager();