/**
 * Tile rendering utilities
 */
const Tiles = {
  // Terrain colors
  colors: {
    grass: '#90b060',
    forest: '#4a7c3f',
    mountain: '#8b8b8b',
    water: '#5b9bd5',
    monument: '#ffd700',
  },

  // Team colors
  teamColors: {
    0: { fill: '#0071e3', bg: 'rgba(0, 113, 227, 0.25)', border: '#4da3ff' },
    1: { fill: '#ff6b35', bg: 'rgba(255, 107, 53, 0.25)', border: '#ff9a76' },
  },

  /**
   * Draw an isometric diamond tile
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @param {string} terrain - Terrain type
   * @param {number|null} owner - Owner team (null if unowned)
   * @param {Object} options - Additional options
   */
  drawTile(ctx, x, y, terrain, owner = null, options = {}) {
    const corners = Isometric.getTileCorners(x, y);
    const center = Isometric.gridToScreen(x, y);

    // Draw base terrain
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    // Fill with terrain color
    const baseColor = this.colors[terrain] || this.colors.grass;
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Add territory overlay if owned
    if (owner !== null && this.teamColors[owner]) {
      ctx.fillStyle = this.teamColors[owner].bg;
      ctx.fill();
    }

    // Draw tile border
    ctx.strokeStyle = options.selected ? '#ffffff' : options.hover ? '#cccccc' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = options.selected ? 2 : 1;
    ctx.stroke();

    // Add selection glow
    if (options.selected) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Add valid move indicator
    if (options.validMove) {
      ctx.fillStyle = 'rgba(52, 199, 89, 0.4)';
      ctx.fill();
    }

    // Add valid attack indicator
    if (options.validAttack) {
      ctx.fillStyle = 'rgba(255, 59, 48, 0.4)';
      ctx.fill();
    }

    // Draw terrain details
    this.drawTerrainDetails(ctx, center, terrain, options);
  },

  /**
   * Draw terrain-specific details
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {{x: number, y: number}} center - Tile center
   * @param {string} terrain - Terrain type
   * @param {Object} options - Additional options
   */
  drawTerrainDetails(ctx, center, terrain, options = {}) {
    const scale = Isometric.zoom;

    switch (terrain) {
      case 'forest':
        // Draw simple tree shapes
        this.drawTree(ctx, center.x, center.y - 5 * scale, scale);
        break;

      case 'mountain':
        // Draw mountain peak
        this.drawMountain(ctx, center.x, center.y - 5 * scale, scale);
        break;

      case 'water':
        // Draw wave pattern
        this.drawWaves(ctx, center, scale);
        break;

      case 'monument':
        // Draw monument glow
        ctx.beginPath();
        ctx.arc(center.x, center.y, 15 * scale, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          center.x,
          center.y,
          0,
          center.x,
          center.y,
          20 * scale
        );
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
        break;
    }
  },

  /**
   * Draw a simple tree
   */
  drawTree(ctx, x, y, scale) {
    ctx.fillStyle = '#2d5016';
    ctx.beginPath();
    ctx.moveTo(x, y - 10 * scale);
    ctx.lineTo(x + 6 * scale, y + 4 * scale);
    ctx.lineTo(x - 6 * scale, y + 4 * scale);
    ctx.closePath();
    ctx.fill();

    // Tree trunk
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(x - 2 * scale, y + 4 * scale, 4 * scale, 4 * scale);
  },

  /**
   * Draw a mountain peak
   */
  drawMountain(ctx, x, y, scale) {
    ctx.fillStyle = '#6b6b6b';
    ctx.beginPath();
    ctx.moveTo(x, y - 10 * scale);
    ctx.lineTo(x + 10 * scale, y + 6 * scale);
    ctx.lineTo(x - 10 * scale, y + 6 * scale);
    ctx.closePath();
    ctx.fill();

    // Snow cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y - 10 * scale);
    ctx.lineTo(x + 4 * scale, y - 2 * scale);
    ctx.lineTo(x - 4 * scale, y - 2 * scale);
    ctx.closePath();
    ctx.fill();
  },

  /**
   * Draw wave pattern for water
   */
  drawWaves(ctx, center, scale) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(center.x - 12 * scale, center.y + i * 6 * scale);
      ctx.quadraticCurveTo(
        center.x - 4 * scale,
        center.y + i * 6 * scale - 3 * scale,
        center.x + 4 * scale,
        center.y + i * 6 * scale
      );
      ctx.quadraticCurveTo(
        center.x + 8 * scale,
        center.y + i * 6 * scale + 3 * scale,
        center.x + 12 * scale,
        center.y + i * 6 * scale
      );
      ctx.stroke();
    }
  },

  /**
   * Draw a city
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @param {number} owner - Owner team
   * @param {boolean} isCapital - Whether this is the capital city
   */
  drawCity(ctx, x, y, owner, isCapital = false) {
    const center = Isometric.gridToScreen(x, y);
    const scale = Isometric.zoom;
    const color = this.teamColors[owner];

    // Building base
    ctx.fillStyle = color.fill;
    ctx.beginPath();
    ctx.rect(center.x - 10 * scale, center.y - 15 * scale, 20 * scale, 20 * scale);
    ctx.fill();

    // Roof
    ctx.fillStyle = owner === 0 ? '#004999' : '#cc4400';
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - 25 * scale);
    ctx.lineTo(center.x + 14 * scale, center.y - 12 * scale);
    ctx.lineTo(center.x - 14 * scale, center.y - 12 * scale);
    ctx.closePath();
    ctx.fill();

    // Capital star
    if (isCapital) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `${14 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('★', center.x, center.y - 28 * scale);
    }

    // Door
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(center.x - 4 * scale, center.y - 5 * scale, 8 * scale, 10 * scale);
  },

  /**
   * Draw territory borders between tiles
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} tiles - Array of tiles with owner info
   * @param {number} gridWidth - Grid width
   * @param {number} gridHeight - Grid height
   */
  drawTerritoryBorders(ctx, tiles, gridWidth, gridHeight) {
    ctx.lineWidth = 2;

    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const tile = tiles[y * gridWidth + x];
        if (tile.owner === null) continue;

        const corners = Isometric.getTileCorners(x, y);
        const color = this.teamColors[tile.owner].border;

        // Check each neighbor
        const neighbors = [
          { dx: 0, dy: -1, edge: [0, 3] }, // Top-left edge
          { dx: 1, dy: 0, edge: [0, 1] }, // Top-right edge
          { dx: 0, dy: 1, edge: [1, 2] }, // Bottom-right edge
          { dx: -1, dy: 0, edge: [2, 3] }, // Bottom-left edge
        ];

        neighbors.forEach(({ dx, dy, edge }) => {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {
            // Edge of map - draw border
            this.drawBorderEdge(ctx, corners, edge, color);
          } else {
            const neighbor = tiles[ny * gridWidth + nx];
            if (neighbor.owner !== tile.owner) {
              // Different owner - draw border
              this.drawBorderEdge(ctx, corners, edge, color);
            }
          }
        });
      }
    }
  },

  /**
   * Draw a single border edge
   */
  drawBorderEdge(ctx, corners, edge, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(corners[edge[0]].x, corners[edge[0]].y);
    ctx.lineTo(corners[edge[1]].x, corners[edge[1]].y);
    ctx.stroke();
  },
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Tiles;
}
