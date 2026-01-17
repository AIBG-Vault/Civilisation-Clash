/**
 * Unit rendering utilities
 */
const Units = {
  // Unit type configurations
  types: {
    SOLDIER: {
      letter: 'S',
      maxHp: 3,
      color: { light: '#1a5fb4', dark: '#3584e4' },
    },
    ARCHER: {
      letter: 'A',
      maxHp: 2,
      color: { light: '#26a269', dark: '#33d17a' },
    },
    RAIDER: {
      letter: 'R',
      maxHp: 1,
      color: { light: '#a51d2d', dark: '#ed333b' },
    },
  },

  // Team colors
  teamColors: {
    0: { fill: '#0071e3', stroke: '#4da3ff', shadow: 'rgba(0, 113, 227, 0.5)' },
    1: { fill: '#ff6b35', stroke: '#ff9a76', shadow: 'rgba(255, 107, 53, 0.5)' },
  },

  /**
   * Draw a unit at the specified grid position
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @param {Object} unit - Unit data {type, owner, hp, canMove}
   * @param {Object} options - Rendering options
   */
  drawUnit(ctx, x, y, unit, options = {}) {
    const center = Isometric.gridToScreen(x, y);
    const scale = Isometric.zoom;
    const teamColor = this.teamColors[unit.owner];
    const unitType = this.types[unit.type];

    if (!teamColor || !unitType) return;

    // Offset Y to place unit on top of tile
    const unitY = center.y - 8 * scale;

    // Draw shadow
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 2 * scale, 12 * scale, 6 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();

    // Selection bounce animation offset
    let bounceOffset = 0;
    if (options.selected) {
      bounceOffset = Math.sin(Date.now() / 150) * 3 * scale;
    }

    // Draw unit body (circular badge)
    const radius = 14 * scale;
    ctx.beginPath();
    ctx.arc(center.x, unitY - bounceOffset, radius, 0, Math.PI * 2);

    // Team color fill
    ctx.fillStyle = teamColor.fill;
    ctx.fill();

    // Border
    ctx.strokeStyle = teamColor.stroke;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Selection glow
    if (options.selected) {
      ctx.shadowColor = teamColor.shadow;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Unit letter
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(unitType.letter, center.x, unitY - bounceOffset);

    // HP bar (below unit)
    this.drawHpBar(
      ctx,
      center.x,
      unitY + radius + 4 * scale - bounceOffset,
      unit.hp,
      unitType.maxHp,
      scale
    );

    // Can't move indicator (grayed out overlay)
    if (!unit.canMove && !options.hideCanMove) {
      ctx.beginPath();
      ctx.arc(center.x, unitY - bounceOffset, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();
    }

    // Draw movement indicators if selected
    if (options.showRange && options.validMoves) {
      this.drawMovementIndicators(ctx, options.validMoves);
    }

    // Draw attack indicators if selected
    if (options.showRange && options.validAttacks) {
      this.drawAttackIndicators(ctx, options.validAttacks);
    }
  },

  /**
   * Draw HP bar below unit
   */
  drawHpBar(ctx, x, y, currentHp, maxHp, scale) {
    const width = 24 * scale;
    const height = 4 * scale;
    const hpPercent = currentHp / maxHp;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y, width, height, 2 * scale);
    ctx.fill();

    // HP fill
    let fillColor = '#34c759'; // Green
    if (hpPercent <= 0.33) {
      fillColor = '#ff3b30'; // Red
    } else if (hpPercent <= 0.66) {
      fillColor = '#ff9f0a'; // Orange
    }

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y, width * hpPercent, height, 2 * scale);
    ctx.fill();
  },

  /**
   * Draw movement range indicators
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array<{x: number, y: number}>} validMoves - Array of valid move positions
   */
  drawMovementIndicators(ctx, validMoves) {
    validMoves.forEach((pos) => {
      const corners = Isometric.getTileCorners(pos.x, pos.y);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Green overlay
      ctx.fillStyle = 'rgba(52, 199, 89, 0.35)';
      ctx.fill();

      // Dotted border
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#34c759';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    });
  },

  /**
   * Draw attack range indicators
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array<{x: number, y: number}>} validAttacks - Array of valid attack positions
   */
  drawAttackIndicators(ctx, validAttacks) {
    validAttacks.forEach((pos) => {
      const corners = Isometric.getTileCorners(pos.x, pos.y);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Red overlay
      ctx.fillStyle = 'rgba(255, 59, 48, 0.35)';
      ctx.fill();

      // Dotted border
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    });
  },

  /**
   * Draw Zone of Control for soldiers
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Soldier grid X
   * @param {number} y - Soldier grid Y
   * @param {number} owner - Team owner
   */
  drawZoneOfControl(ctx, x, y, owner) {
    const teamColor = this.teamColors[owner];
    const zocTiles = this.getDistance2Tiles(x, y);

    zocTiles.forEach((pos) => {
      const corners = Isometric.getTileCorners(pos.x, pos.y);

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();

      // Team-colored overlay with low opacity
      ctx.fillStyle = owner === 0 ? 'rgba(0, 113, 227, 0.1)' : 'rgba(255, 107, 53, 0.1)';
      ctx.fill();

      // Dashed border
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = teamColor.fill;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    });
  },

  /**
   * Get all tiles within distance 2 (for ZoC)
   */
  getDistance2Tiles(x, y) {
    const tiles = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist <= 2) {
          tiles.push({ x: x + dx, y: y + dy });
        }
      }
    }
    return tiles;
  },

  /**
   * Get adjacent tiles (distance 1)
   */
  getAdjacentTiles(x, y) {
    const tiles = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        tiles.push({ x: x + dx, y: y + dy });
      }
    }
    return tiles;
  },

  /**
   * Draw monument
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @param {number|null} controlledBy - Team controlling monument
   */
  drawMonument(ctx, x, y, controlledBy) {
    const center = Isometric.gridToScreen(x, y);
    const scale = Isometric.zoom;

    // Glow effect
    const time = Date.now() / 1000;
    const glowIntensity = 0.5 + Math.sin(time * 2) * 0.2;

    ctx.beginPath();
    ctx.arc(center.x, center.y - 10 * scale, 25 * scale, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      center.x,
      center.y - 10 * scale,
      0,
      center.x,
      center.y - 10 * scale,
      30 * scale
    );
    gradient.addColorStop(0, `rgba(255, 215, 0, ${glowIntensity})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Monument base (pentagon/obelisk shape)
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - 30 * scale); // Top
    ctx.lineTo(center.x + 8 * scale, center.y - 15 * scale);
    ctx.lineTo(center.x + 6 * scale, center.y + 5 * scale);
    ctx.lineTo(center.x - 6 * scale, center.y + 5 * scale);
    ctx.lineTo(center.x - 8 * scale, center.y - 15 * scale);
    ctx.closePath();

    // Fill based on controller
    if (controlledBy !== null) {
      const teamColor = this.teamColors[controlledBy];
      ctx.fillStyle = teamColor.fill;
    } else {
      ctx.fillStyle = '#ffd700';
    }
    ctx.fill();

    // Golden border
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Gem at top
    ctx.beginPath();
    ctx.arc(center.x, center.y - 28 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Controller indicator (crown/flag)
    if (controlledBy !== null) {
      ctx.fillStyle = this.teamColors[controlledBy].fill;
      ctx.font = `${10 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('', center.x, center.y - 40 * scale);
    }
  },
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Units;
}
