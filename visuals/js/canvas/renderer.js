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
  lastMousePos: { x: 0, y: 0 },

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

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    // Reset canvas style size
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

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

    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Right click, middle mouse, or shift+left click = pan
      this.isPanning = true;
      this.lastMousePos = pos;
      this.canvas.style.cursor = 'grabbing';
    } else if (e.button === 0) {
      // Left click = select tile
      const gridPos = Isometric.getGridCell(pos.x, pos.y);
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
    this.canvas.style.cursor = 'default';
  },

  /**
   * Mouse leave handler
   */
  onMouseLeave() {
    this.isPanning = false;
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

    this.selectedTile = { x, y };

    // Check if there's a unit at this tile
    const unit = this.getUnitAt(x, y);
    if (unit) {
      this.selectedUnit = unit;
    } else {
      this.selectedUnit = null;
    }

    // Dispatch selection event
    window.dispatchEvent(
      new CustomEvent('tile-selected', {
        detail: {
          x,
          y,
          tile: this.getTileAt(x, y),
          unit: unit,
          city: this.getCityAt(x, y),
        },
      })
    );
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

    if (firstLoad) {
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
