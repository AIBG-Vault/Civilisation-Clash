// Canvas renderer for game visualization

class GameRenderer {
  constructor(canvas, uiCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.uiCanvas = uiCanvas;
    this.uiCtx = uiCanvas.getContext('2d');

    this.tileSize = 40;
    this.mapWidth = 15;
    this.mapHeight = 10;

    this.canvas.width = this.mapWidth * this.tileSize;
    this.canvas.height = this.mapHeight * this.tileSize;
    this.uiCanvas.width = this.canvas.width;
    this.uiCanvas.height = this.canvas.height;

    this.selectedUnit = null;
    this.hoveredTile = null;
    this.possibleMoves = [];
    this.gameState = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.uiCanvas.addEventListener('click', (e) => this.handleClick(e));
    this.uiCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.uiCanvas.addEventListener('mouseleave', () => {
      this.hoveredTile = null;
      this.renderUI();
    });
  }

  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / this.tileSize);
    const y = Math.floor((event.clientY - rect.top) / this.tileSize);

    if (this.onTileClick) {
      this.onTileClick(x, y);
    }
  }

  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / this.tileSize);
    const y = Math.floor((event.clientY - rect.top) / this.tileSize);

    if (x !== this.hoveredTile?.x || y !== this.hoveredTile?.y) {
      this.hoveredTile = { x, y };
      this.renderUI();
    }
  }

  render(gameState) {
    if (!gameState) return;
    this.gameState = gameState;

    // Update map dimensions if needed
    if (gameState.map && gameState.map.length > 0) {
      const maxX = Math.max(...gameState.map.map((t) => t.x)) + 1;
      const maxY = Math.max(...gameState.map.map((t) => t.y)) + 1;
      if (maxX !== this.mapWidth || maxY !== this.mapHeight) {
        this.mapWidth = maxX;
        this.mapHeight = maxY;
        this.canvas.width = this.mapWidth * this.tileSize;
        this.canvas.height = this.mapHeight * this.tileSize;
        this.uiCanvas.width = this.canvas.width;
        this.uiCanvas.height = this.canvas.height;
      }
    }

    this.clearCanvas();
    this.drawTerrain(gameState.map);
    this.drawTerritoryBorders(gameState.map);
    this.drawUnits(gameState.units);
    this.renderUI();
  }

  clearCanvas() {
    // Fill with dark background instead of clearing to transparent
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTerrain(map) {
    map.forEach((tile) => {
      const x = tile.x * this.tileSize;
      const y = tile.y * this.tileSize;

      // Draw terrain color
      this.ctx.fillStyle = this.getTerrainColor(tile.type);
      this.ctx.fillRect(x, y, this.tileSize, this.tileSize);

      // Draw terrain pattern for better visibility
      if (tile.type === 'MOUNTAIN') {
        // Draw mountain triangles
        this.ctx.fillStyle = '#6B5B45';
        this.ctx.beginPath();
        this.ctx.moveTo(x + this.tileSize * 0.25, y + this.tileSize * 0.75);
        this.ctx.lineTo(x + this.tileSize * 0.5, y + this.tileSize * 0.25);
        this.ctx.lineTo(x + this.tileSize * 0.75, y + this.tileSize * 0.75);
        this.ctx.closePath();
        this.ctx.fill();
      } else if (tile.type === 'WATER') {
        // Draw wave lines
        this.ctx.strokeStyle = '#2E7DA2';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 5, y + this.tileSize / 2);
        this.ctx.quadraticCurveTo(
          x + this.tileSize / 2,
          y + this.tileSize / 2 - 5,
          x + this.tileSize - 5,
          y + this.tileSize / 2
        );
        this.ctx.stroke();
      }

      // Draw grid lines
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, this.tileSize, this.tileSize);
    });
  }

  drawTerritoryBorders(map) {
    map.forEach((tile) => {
      if (tile.owner !== null && tile.owner !== undefined) {
        const x = tile.x * this.tileSize;
        const y = tile.y * this.tileSize;

        // Draw colored border for owned territory
        this.ctx.strokeStyle = tile.owner === 0 ? '#4444FF' : '#FF4444';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
        this.ctx.setLineDash([]);

        // Semi-transparent overlay
        this.ctx.fillStyle = tile.owner === 0 ? 'rgba(0,0,255,0.1)' : 'rgba(255,0,0,0.1)';
        this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
      }
    });
  }

  drawUnits(units) {
    if (!units) return;

    units.forEach((unit) => {
      const x = unit.x * this.tileSize;
      const y = unit.y * this.tileSize;

      // Draw unit circle
      this.ctx.fillStyle = unit.owner === 0 ? '#0066CC' : '#CC0000';
      this.ctx.beginPath();
      this.ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2, this.tileSize / 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw border
      this.ctx.strokeStyle = unit.owner === 0 ? '#003366' : '#660000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Unit type label
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('S', x + this.tileSize / 2, y + this.tileSize / 2);

      // HP bar
      this.drawHPBar(x, y, unit.hp, unit.maxHp);

      // Selection highlight
      if (this.selectedUnit?.id === unit.id) {
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
      }

      // Can't move indicator (capture fatigue)
      if (!unit.canMove) {
        this.ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
      }
    });
  }

  drawHPBar(x, y, hp, maxHp) {
    const barWidth = this.tileSize - 10;
    const barHeight = 4;
    const barX = x + 5;
    const barY = y + this.tileSize - 8;

    // Background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // HP fill
    const hpPercent = hp / maxHp;
    this.ctx.fillStyle = hpPercent > 0.66 ? '#0F0' : hpPercent > 0.33 ? '#FF0' : '#F00';
    this.ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    // Border
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  renderUI() {
    // Clear UI canvas
    this.uiCtx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);

    // Draw possible moves
    if (this.possibleMoves.length > 0) {
      this.possibleMoves.forEach((tile) => {
        const x = tile.x * this.tileSize;
        const y = tile.y * this.tileSize;

        this.uiCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        this.uiCtx.fillRect(x, y, this.tileSize, this.tileSize);

        this.uiCtx.strokeStyle = '#0F0';
        this.uiCtx.lineWidth = 2;
        this.uiCtx.strokeRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
      });
    }

    // Draw hover highlight
    if (this.hoveredTile && this.isInBounds(this.hoveredTile.x, this.hoveredTile.y)) {
      const x = this.hoveredTile.x * this.tileSize;
      const y = this.hoveredTile.y * this.tileSize;

      this.uiCtx.strokeStyle = '#FFF';
      this.uiCtx.lineWidth = 2;
      this.uiCtx.strokeRect(x, y, this.tileSize, this.tileSize);

      // Show tile info
      if (this.gameState) {
        const tile = this.gameState.map.find(
          (t) => t.x === this.hoveredTile.x && t.y === this.hoveredTile.y
        );
        if (tile) {
          this.uiCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          this.uiCtx.fillRect(x, y - 20, 80, 18);
          this.uiCtx.fillStyle = 'white';
          this.uiCtx.font = '12px Arial';
          this.uiCtx.textAlign = 'left';
          this.uiCtx.fillText(`${tile.type}`, x + 2, y - 6);
        }
      }
    }
  }

  getTerrainColor(type) {
    const colors = {
      FIELD: '#90EE90',
      MOUNTAIN: '#8B7355',
      WATER: '#4682B4',
    };
    return colors[type] || '#808080';
  }

  selectUnit(unit) {
    this.selectedUnit = unit;
    this.calculatePossibleMoves(unit);
    this.renderUI();
  }

  clearSelection() {
    this.selectedUnit = null;
    this.possibleMoves = [];
    this.renderUI();
  }

  calculatePossibleMoves(unit) {
    if (!unit || !this.gameState) {
      this.possibleMoves = [];
      return;
    }

    // Can't move if capture fatigue
    if (!unit.canMove) {
      this.possibleMoves = [];
      return;
    }

    // Simple adjacent tile calculation for soldiers
    this.possibleMoves = [];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    dirs.forEach(([dx, dy]) => {
      const newX = unit.x + dx;
      const newY = unit.y + dy;

      if (this.isInBounds(newX, newY)) {
        const tile = this.gameState.map.find((t) => t.x === newX && t.y === newY);
        if (tile && tile.type === 'FIELD') {
          const occupied = this.gameState.units.some((u) => u.x === newX && u.y === newY);
          if (!occupied) {
            this.possibleMoves.push({ x: newX, y: newY });
          }
        }
      }
    });
  }

  isInBounds(x, y) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
  }
}
