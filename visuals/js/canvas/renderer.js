/**
 * Main canvas renderer for the game
 */
const Renderer = {
  canvas: null,
  ctx: null,
  animationId: null,
  lastTime: 0,

  // State references
  gameState: null,
  selectedTile: null,
  hoveredTile: null,
  selectedUnit: null,

  // Render settings
  showGrid: true,
  showZoC: false,
  showTerritoryBorders: true,

  // Interaction state
  isPanning: false,
  isLeftDown: false,
  lastDragTile: null, // tracks last tile during drag-expand
  lastMousePos: { x: 0, y: 0 },
  lastClickTime: 0,
  lastClickPos: { x: -1, y: -1 },
  doubleClickDelay: 300, // ms

  /**
   * Initialize the renderer
   * @param {HTMLCanvasElement} canvas - The canvas element
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Set up high DPI canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Set up mouse/touch events
    this.setupInputHandlers();

    // Start render loop
    this.startRenderLoop();
  },

  /**
   * Resize canvas for high DPI displays
   */
  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // Set canvas size (this resets the context transform)
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Reset and apply DPI scale
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    // Center camera on map center if we have a game state
    if (this.gameState && this.gameState.map) {
      this.centerCamera();
    }
  },

  /**
   * Center camera on the map
   */
  centerCamera() {
    if (!this.gameState || !this.gameState.map) return;

    const rect = this.canvas.getBoundingClientRect();
    const mapWidth = this.gameState.map.width;
    const mapHeight = this.gameState.map.height;

    // Center on map center
    Isometric.offsetX = rect.width / 2;
    Isometric.offsetY = rect.height / 2 - ((mapWidth + mapHeight) * Isometric.tileHeight) / 4;
  },

  /**
   * Set up mouse and touch input handlers
   */
  setupInputHandlers() {
    const canvas = this.canvas;

    // Mouse events
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('mouseleave', () => this.onMouseLeave());
    canvas.addEventListener('wheel', (e) => this.onWheel(e));

    // Touch events
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

    // Context menu (right click) - prevent default
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  },

  /**
   * Get mouse position relative to canvas
   */
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  },

  /**
   * Mouse down handler
   */
  onMouseDown(e) {
    const pos = this.getMousePos(e);

    if (e.button === 2 || e.button === 1) {
      // Right click or middle mouse = pan
      this.isPanning = true;
      this.lastMousePos = pos;
      this.canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
      // Left click = select tile (store shift state for multi-select)
      this.pendingClickShift = e.shiftKey;
      this.isLeftDown = true;
      const gridPos = Isometric.getGridCell(pos.x, pos.y);
      this.lastDragTile = `${gridPos.x},${gridPos.y}`;
      this.handleTileClick(gridPos.x, gridPos.y);
    }
  },

  /**
   * Mouse move handler
   */
  onMouseMove(e) {
    const pos = this.getMousePos(e);

    if (this.isPanning) {
      const dx = pos.x - this.lastMousePos.x;
      const dy = pos.y - this.lastMousePos.y;
      Isometric.pan(dx, dy);
      this.lastMousePos = pos;
    } else {
      // Update hovered tile
      const gridPos = Isometric.getGridCell(pos.x, pos.y);
      if (this.isValidTile(gridPos.x, gridPos.y)) {
        this.hoveredTile = gridPos;
        this.canvas.style.cursor = 'pointer';

        // Drag-expand: if left button held in expand mode, expand tiles as we drag
        if (
          this.isLeftDown &&
          typeof ManualPlay !== 'undefined' &&
          ManualPlay.active &&
          ManualPlay.mode === 'expand'
        ) {
          const tileKey = `${gridPos.x},${gridPos.y}`;
          if (tileKey !== this.lastDragTile) {
            this.lastDragTile = tileKey;
            ManualPlay.queueExpand(gridPos.x, gridPos.y);
          }
        }
      } else {
        this.hoveredTile = null;
        this.canvas.style.cursor = 'default';
      }
    }
  },

  /**
   * Mouse up handler
   */
  onMouseUp(e) {
    this.isPanning = false;
    this.isLeftDown = false;
    this.lastDragTile = null;
    this.canvas.style.cursor = 'default';
  },

  /**
   * Mouse leave handler
   */
  onMouseLeave() {
    this.isPanning = false;
    this.isLeftDown = false;
    this.lastDragTile = null;
    this.hoveredTile = null;
    this.canvas.style.cursor = 'default';
  },

  /**
   * Mouse wheel handler (zoom)
   */
  onWheel(e) {
    e.preventDefault();
    const pos = this.getMousePos(e);
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    Isometric.setZoom(Isometric.zoom * zoomFactor, pos.x, pos.y);
  },

  /**
   * Touch start handler
   */
  onTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.lastMousePos = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
  },

  /**
   * Touch move handler
   */
  onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const pos = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };

      const dx = pos.x - this.lastMousePos.x;
      const dy = pos.y - this.lastMousePos.y;
      Isometric.pan(dx, dy);
      this.lastMousePos = pos;
    }
  },

  /**
   * Touch end handler
   */
  onTouchEnd(e) {
    if (e.changedTouches.length === 1 && !this.isPanning) {
      const touch = e.changedTouches[0];
      const rect = this.canvas.getBoundingClientRect();
      const pos = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
      const gridPos = Isometric.getGridCell(pos.x, pos.y);
      this.handleTileClick(gridPos.x, gridPos.y);
    }
  },

  /**
   * Handle tile click
   */
  handleTileClick(x, y) {
    if (!this.isValidTile(x, y)) return;

    const now = Date.now();
    const tile = this.getTileAt(x, y);
    const unit = this.getUnitAt(x, y);
    const city = this.getCityAt(x, y);

    // Check for double-click
    const isDoubleClick =
      now - this.lastClickTime < this.doubleClickDelay &&
      this.lastClickPos.x === x &&
      this.lastClickPos.y === y;

    this.lastClickTime = now;
    this.lastClickPos = { x, y };

    if (isDoubleClick) {
      // Double-click - expand territory
      if (typeof App !== 'undefined') {
        App.handleTileDoubleClick(x, y, tile);
      }
      return;
    }

    // Single click
    this.selectedTile = { x, y };

    // Check if there's a unit at this tile
    if (unit) {
      this.selectedUnit = unit;
    } else {
      this.selectedUnit = null;
    }

    // Call App's handler for manual play (pass shift state for multi-select)
    if (typeof App !== 'undefined') {
      App.handleTileClick(x, y, tile, unit, city, this.pendingClickShift || false);
    }

    // Inspector panel disabled — was too intrusive
  },

  /**
   * Check if coordinates are within map bounds
   */
  isValidTile(x, y) {
    if (!this.gameState || !this.gameState.map) return false;
    return x >= 0 && x < this.gameState.map.width && y >= 0 && y < this.gameState.map.height;
  },

  /**
   * Get tile at position
   */
  getTileAt(x, y) {
    if (!this.gameState || !this.gameState.map) return null;
    const tiles = this.gameState.map.tiles;
    return tiles.find((t) => t.x === x && t.y === y);
  },

  /**
   * Get unit at position
   */
  getUnitAt(x, y) {
    if (!this.gameState || !this.gameState.units) return null;
    return this.gameState.units.find((u) => u.x === x && u.y === y);
  },

  /**
   * Get city at position
   */
  getCityAt(x, y) {
    if (!this.gameState || !this.gameState.cities) return null;
    return this.gameState.cities.find((c) => c.x === x && c.y === y);
  },

  /**
   * Update game state
   */
  setGameState(state) {
    const firstLoad = !this.gameState;
    this.gameState = state;
    console.log(
      '[Renderer] setGameState called, state:',
      state ? `Turn ${state.turn}, ${state.map?.tiles?.length} tiles` : 'null'
    );

    if (firstLoad && state) {
      console.log('[Renderer] First load, centering camera');
      this.centerCamera();
    }
  },

  /**
   * Start the render loop
   */
  startRenderLoop() {
    const animate = (time) => {
      this.render(time);
      this.animationId = requestAnimationFrame(animate);
    };
    this.animationId = requestAnimationFrame(animate);
  },

  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  },

  /**
   * Main render function
   */
  render(time) {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw background
    this.drawBackground(ctx, rect);

    // If no game state, draw placeholder
    if (!this.gameState || !this.gameState.map) {
      this.drawPlaceholder(ctx, rect);
      return;
    }

    // Draw map tiles
    this.drawTiles(ctx);

    // Draw territory borders
    if (this.showTerritoryBorders) {
      this.drawTerritoryBorders(ctx);
    }

    // Draw cities
    this.drawCities(ctx);

    // Draw monument
    this.drawMonument(ctx);

    // Draw units
    this.drawUnits(ctx, time);

    // Draw selection/hover highlights
    this.drawInteractionHighlights(ctx);

    // Draw manual play overlays (valid moves, arrows, path plans, etc.)
    // In oversight mode, ManualPlay.getRenderOverlays includes both teams' actions
    if (typeof ManualPlay !== 'undefined' && ManualPlay.active) {
      this.drawManualPlayOverlays(ctx, time);
    }
  },

  /**
   * Draw background gradient
   */
  drawBackground(ctx, rect) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    if (isDark) {
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
    } else {
      gradient.addColorStop(0, '#e8f0f8');
      gradient.addColorStop(1, '#c8d8e8');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);
  },

  /**
   * Draw placeholder when no game loaded
   */
  drawPlaceholder(ctx, rect) {
    ctx.fillStyle =
      document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'rgba(255, 255, 255, 0.3)'
        : 'rgba(0, 0, 0, 0.3)';
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Waiting for game state...', rect.width / 2, rect.height / 2);
  },

  /**
   * Draw all tiles
   */
  drawTiles(ctx) {
    const { map } = this.gameState;
    const bounds = Isometric.getVisibleBounds(
      this.canvas.getBoundingClientRect().width,
      this.canvas.getBoundingClientRect().height
    );

    // Draw tiles in isometric order (back to front)
    for (let y = Math.max(0, bounds.minY); y < Math.min(map.height, bounds.maxY); y++) {
      for (let x = Math.max(0, bounds.minX); x < Math.min(map.width, bounds.maxX); x++) {
        const tile = this.getTileAt(x, y);
        if (!tile) continue;

        const isHovered = this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y;
        const isSelected =
          this.selectedTile && this.selectedTile.x === x && this.selectedTile.y === y;

        Tiles.drawTile(ctx, x, y, tile.type.toLowerCase(), tile.owner, {
          hover: isHovered,
          selected: isSelected,
        });
      }
    }
  },

  /**
   * Draw territory borders
   */
  drawTerritoryBorders(ctx) {
    if (!this.gameState || !this.gameState.map) return;

    const { map } = this.gameState;
    Tiles.drawTerritoryBorders(ctx, map.tiles, map.width, map.height);
  },

  /**
   * Draw all cities
   */
  drawCities(ctx) {
    if (!this.gameState || !this.gameState.cities) return;

    this.gameState.cities.forEach((city, index) => {
      // First city for each player is capital
      const isCapital =
        this.gameState.cities.filter((c) => c.owner === city.owner).indexOf(city) === 0;
      Tiles.drawCity(ctx, city.x, city.y, city.owner, isCapital);
    });
  },

  /**
   * Draw monument
   */
  drawMonument(ctx) {
    if (!this.gameState || !this.gameState.monument) return;

    const { monument } = this.gameState;
    Units.drawMonument(ctx, monument.x, monument.y, monument.controlled_by);
  },

  /**
   * Draw all units
   */
  drawUnits(ctx, time) {
    if (!this.gameState || !this.gameState.units) return;

    this.gameState.units.forEach((unit) => {
      const isSelected =
        this.selectedUnit && this.selectedUnit.x === unit.x && this.selectedUnit.y === unit.y;

      Units.drawUnit(ctx, unit.x, unit.y, unit, {
        selected: isSelected,
        showRange: isSelected,
      });
    });
  },

  /**
   * Draw interaction highlights (selection, hover, valid moves)
   */
  drawInteractionHighlights(ctx) {
    // This could be expanded to show valid moves, attacks, etc.
    // when implementing manual play mode
  },

  /**
   * Toggle grid visibility
   */
  toggleGrid() {
    this.showGrid = !this.showGrid;
  },

  /**
   * Toggle ZoC visibility
   */
  toggleZoC() {
    this.showZoC = !this.showZoC;
  },

  /**
   * Toggle territory borders visibility
   */
  toggleTerritoryBorders() {
    this.showTerritoryBorders = !this.showTerritoryBorders;
  },

  // --- Manual Play Overlay Drawing ---

  drawManualPlayOverlays(ctx, time) {
    const overlays = ManualPlay.getRenderOverlays(this.gameState);
    if (!overlays) return;

    // Valid move tiles (green)
    if (overlays.validMoves && overlays.validMoves.length > 0) {
      for (const tile of overlays.validMoves) {
        this.drawTileOverlay(
          ctx,
          tile.x,
          tile.y,
          'rgba(52, 199, 89, 0.3)',
          'rgba(52, 199, 89, 0.6)'
        );
      }
    }

    // Valid attack tiles (red)
    if (overlays.validAttacks && overlays.validAttacks.length > 0) {
      for (const tile of overlays.validAttacks) {
        this.drawTileOverlay(
          ctx,
          tile.x,
          tile.y,
          'rgba(255, 59, 48, 0.3)',
          'rgba(255, 59, 48, 0.6)'
        );
      }
    }

    // Expandable tiles (blue)
    if (overlays.expandableTiles && overlays.expandableTiles.length > 0) {
      for (const tile of overlays.expandableTiles) {
        this.drawTileOverlay(
          ctx,
          tile.x,
          tile.y,
          'rgba(59, 130, 246, 0.25)',
          'rgba(59, 130, 246, 0.5)'
        );
      }
    }

    // Valid city locations (gold)
    if (overlays.validCityLocations && overlays.validCityLocations.length > 0) {
      for (const tile of overlays.validCityLocations) {
        this.drawTileOverlay(
          ctx,
          tile.x,
          tile.y,
          'rgba(255, 215, 0, 0.25)',
          'rgba(255, 215, 0, 0.5)'
        );
      }
    }

    // Queued move arrows
    if (overlays.queuedMoveArrows && overlays.queuedMoveArrows.length > 0) {
      for (const arrow of overlays.queuedMoveArrows) {
        this.drawMoveArrow(ctx, arrow);
      }
    }

    // Build markers
    if (overlays.queuedBuildMarkers && overlays.queuedBuildMarkers.length > 0) {
      for (const marker of overlays.queuedBuildMarkers) {
        this.drawBuildMarker(ctx, marker);
      }
    }

    // Path plan lines
    if (overlays.pathPlanLines && overlays.pathPlanLines.length > 0) {
      for (const plan of overlays.pathPlanLines) {
        this.drawPathPlanLine(ctx, plan, time);
      }
    }

    // Selection glow for all selected units
    if (overlays.selectedUnits && overlays.selectedUnits.length > 0) {
      for (const unit of overlays.selectedUnits) {
        this.drawSelectionGlow(ctx, unit);
      }
    }
  },

  drawTileOverlay(ctx, x, y, fillColor, strokeColor) {
    const screen = Isometric.gridToScreen(x, y);
    const tw = Isometric.tileWidth * Isometric.zoom;
    const th = Isometric.tileHeight * Isometric.zoom;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - th / 2);
    ctx.lineTo(screen.x + tw / 2, screen.y);
    ctx.lineTo(screen.x, screen.y + th / 2);
    ctx.lineTo(screen.x - tw / 2, screen.y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  drawMoveArrow(ctx, arrow) {
    const from = Isometric.gridToScreen(arrow.fromX, arrow.fromY);
    const to = Isometric.gridToScreen(arrow.toX, arrow.toY);
    const teamColor = arrow.teamId === 0 ? '#0071e3' : '#dc2626';

    ctx.save();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = 10;
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle - Math.PI / 6),
      to.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      to.x - headLen * Math.cos(angle + Math.PI / 6),
      to.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawBuildMarker(ctx, marker) {
    const screen = Isometric.gridToScreen(marker.x, marker.y);
    const teamColors = { 0: '#0071e3', 1: '#dc2626' };
    const colors = {
      BUILD_UNIT: (marker.teamId !== undefined ? teamColors[marker.teamId] : null) || '#0071e3',
      BUILD_CITY: '#ffd700',
      EXPAND_TERRITORY:
        (marker.teamId !== undefined ? teamColors[marker.teamId] : null) || '#3b82f6',
    };
    const letters = {
      BUILD_UNIT: marker.detail ? marker.detail[0] : 'U',
      BUILD_CITY: 'C',
      EXPAND_TERRITORY: 'E',
    };

    const color = colors[marker.type] || '#888';
    const letter = letters[marker.type] || '?';
    const r = 12;

    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - 8, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, screen.x, screen.y - 8);
    ctx.restore();
  },

  drawPathPlanLine(ctx, plan, time) {
    if (!plan.points || plan.points.length < 2) return;
    const teamColor = plan.teamId === 0 ? '#0071e3' : '#dc2626';

    ctx.save();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;

    // Animated dash offset
    const dashOffset = (time / 50) % 20;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -dashOffset;

    ctx.beginPath();
    for (let i = 0; i < plan.points.length; i++) {
      const p = Isometric.gridToScreen(plan.points[i].x, plan.points[i].y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Dots at each point
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < plan.points.length; i++) {
      const p = Isometric.gridToScreen(plan.points[i].x, plan.points[i].y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = teamColor;
      ctx.fill();
    }

    // Turn break circles
    if (plan.turnBreaks) {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      for (const idx of plan.turnBreaks) {
        if (idx >= 0 && idx < plan.points.length) {
          const p = Isometric.gridToScreen(plan.points[idx].x, plan.points[idx].y);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  },

  drawSelectionGlow(ctx, unit) {
    const screen = Isometric.gridToScreen(unit.x, unit.y);
    const teamColor = unit.owner === 0 ? '#0071e3' : '#dc2626';

    ctx.save();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y - 6, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  /**
   * Zoom to fit the entire map
   */
  zoomToFit() {
    if (!this.gameState || !this.gameState.map) return;

    const rect = this.canvas.getBoundingClientRect();
    const mapWidth = this.gameState.map.width;
    const mapHeight = this.gameState.map.height;

    // Calculate required zoom to fit
    const mapScreenWidth = ((mapWidth + mapHeight) * Isometric.tileWidth) / 2;
    const mapScreenHeight = ((mapWidth + mapHeight) * Isometric.tileHeight) / 2;

    const zoomX = (rect.width * 0.8) / mapScreenWidth;
    const zoomY = (rect.height * 0.8) / mapScreenHeight;

    Isometric.zoom = Math.min(zoomX, zoomY, 1.5);
    this.centerCamera();
  },
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Renderer;
}
