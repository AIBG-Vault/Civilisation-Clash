# MVP Version 2 - Enhanced Game with Economy & Interactive Frontend

## Overview
Second iteration that transforms the basic MVP into a more complete game with terrain variety, economy system, canvas-based rendering, and manual play support.

## Goals for V2
1. **Terrain System** - Different tile types with strategic importance
2. **Economy System** - Territory Points (TP) income and unit costs
3. **Canvas Frontend** - Proper game rendering with sprites
4. **Manual Control** - Click-to-play interface for testing
5. **Better Server** - Improved architecture and error handling

## Feature Additions

### 1. Terrain System
```javascript
// Tile types with different properties
const TERRAIN_TYPES = {
  FIELD: {
    passable: true,
    controllable: true,
    income: 0.5,  // TP per turn when controlled
    color: '#90EE90',
    sprite: 'field.png'
  },
  MOUNTAIN: {
    passable: false,
    controllable: false,
    income: 0,
    color: '#8B7355',
    sprite: 'mountain.png'
  },
  WATER: {
    passable: false,
    controllable: false,
    income: 0,
    color: '#4682B4',
    sprite: 'water.png'
  }
};
```

### 2. Economy System
```javascript
class Economy {
  constructor(teamId) {
    this.teamId = teamId;
    this.territoryPoints = 20;  // Starting TP
    this.income = 0;  // TP per turn
    this.controlledTiles = new Set();
  }

  calculateIncome() {
    let income = 0;
    for (const tileId of this.controlledTiles) {
      const tile = getTile(tileId);
      income += TERRAIN_TYPES[tile.type].income;
    }
    return income;
  }

  collectIncome() {
    this.income = this.calculateIncome();
    this.territoryPoints += this.income;
  }

  canAfford(cost) {
    return this.territoryPoints >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.territoryPoints -= cost;
    return true;
  }
}
```

### 3. Enhanced Game Logic

#### Map Generation
```javascript
class MapGenerator {
  static generateSymmetricalIsland(width, height) {
    const map = [];
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    // Create base island shape
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
        const distFromEdge = Math.min(x, y, width - x - 1, height - y - 1);

        let type = 'WATER';
        if (distFromEdge > 1 && distFromCenter < (width + height) / 3) {
          // Island area
          if (Math.random() < 0.15 && distFromEdge > 2) {
            type = 'MOUNTAIN';  // 15% mountains
          } else {
            type = 'FIELD';
          }
        }

        map.push({
          x, y, type,
          owner: null,
          id: `${x},${y}`
        });
      }
    }

    // Ensure symmetry (mirror across center)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < centerX; x++) {
        const mirrorX = width - x - 1;
        const leftTile = map[y * width + x];
        const rightTile = map[y * width + mirrorX];
        rightTile.type = leftTile.type;
      }
    }

    return map;
  }
}
```

#### Enhanced Unit Actions
```javascript
// Unit costs
const UNIT_COSTS = {
  SOLDIER: 20  // TP cost to build
};

// Build unit action
processUnitBuild(teamId, x, y, unitType) {
  const team = this.teams[teamId];

  if (!team.economy.canAfford(UNIT_COSTS[unitType])) {
    return { success: false, reason: 'Insufficient TP' };
  }

  if (!this.isTileEmpty(x, y)) {
    return { success: false, reason: 'Tile occupied' };
  }

  if (!this.isTileControlled(x, y, teamId)) {
    return { success: false, reason: 'Must build on your territory' };
  }

  team.economy.spend(UNIT_COSTS[unitType]);
  this.createUnit(x, y, teamId, unitType);

  return { success: true };
}
```

### 4. Canvas-Based Frontend

#### HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
  <title>Civilization Clash V2</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #1a1a1a;
      color: white;
      font-family: Arial, sans-serif;
    }

    #gameContainer {
      display: flex;
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    #canvasContainer {
      position: relative;
    }

    canvas {
      border: 2px solid #444;
      cursor: pointer;
    }

    #gameInfo {
      min-width: 300px;
      background: #2a2a2a;
      padding: 20px;
      border-radius: 8px;
    }

    .teamInfo {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 5px;
    }

    .team-0 { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .team-1 { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }

    #controls {
      margin-top: 20px;
      padding: 15px;
      background: #333;
      border-radius: 5px;
    }

    button {
      padding: 10px 20px;
      margin: 5px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover { background: #45a049; }
    button:disabled { background: #666; cursor: not-allowed; }

    .selected { box-shadow: 0 0 20px #FFD700; }
  </style>
</head>
<body>
  <div id="gameContainer">
    <div id="canvasContainer">
      <canvas id="gameCanvas"></canvas>
      <canvas id="uiCanvas"></canvas> <!-- Overlay for UI elements -->
    </div>

    <div id="gameInfo">
      <h2>Game Status</h2>
      <div id="turnInfo">Turn: <span id="turn">0</span> / 50</div>

      <div class="teamInfo team-0">
        <h3>Blue Team</h3>
        <div>Territory Points: <span id="tp-0">20</span></div>
        <div>Income: +<span id="income-0">0</span> TP/turn</div>
        <div>Units: <span id="units-0">0</span></div>
        <div>Territory: <span id="territory-0">0</span> tiles</div>
      </div>

      <div class="teamInfo team-1">
        <h3>Red Team</h3>
        <div>Territory Points: <span id="tp-1">20</span></div>
        <div>Income: +<span id="income-1">0</span> TP/turn</div>
        <div>Units: <span id="units-1">0</span></div>
        <div>Territory: <span id="territory-1">0</span> tiles</div>
      </div>

      <div id="controls">
        <h3>Controls</h3>
        <button id="connectBtn">Connect</button>
        <button id="endTurnBtn" disabled>End Turn</button>
        <button id="buildUnitBtn" disabled>Build Soldier (20 TP)</button>
        <div id="selectedInfo"></div>
      </div>
    </div>
  </div>

  <script src="game-renderer.js"></script>
  <script src="game-client.js"></script>
</body>
</html>
```

#### Canvas Renderer (game-renderer.js)
```javascript
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

    this.sprites = {};
    this.selectedUnit = null;
    this.hoveredTile = null;
    this.possibleMoves = [];

    this.loadSprites();
    this.setupEventListeners();
  }

  loadSprites() {
    // Load sprite images
    const spriteNames = ['field', 'mountain', 'water', 'soldier-0', 'soldier-1'];
    spriteNames.forEach(name => {
      const img = new Image();
      img.src = `assets/${name}.png`;
      this.sprites[name] = img;
    });
  }

  setupEventListeners() {
    this.uiCanvas.addEventListener('click', (e) => this.handleClick(e));
    this.uiCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
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
      this.hoveredTile = {x, y};
      this.renderUI();
    }
  }

  render(gameState) {
    this.clearCanvas();
    this.drawTerrain(gameState.map);
    this.drawTerritoryBorders(gameState.map);
    this.drawUnits(gameState.units);
    this.renderUI();
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawTerrain(map) {
    map.forEach(tile => {
      const x = tile.x * this.tileSize;
      const y = tile.y * this.tileSize;

      // Draw terrain sprite or color
      if (this.sprites[tile.type.toLowerCase()]) {
        this.ctx.drawImage(
          this.sprites[tile.type.toLowerCase()],
          x, y, this.tileSize, this.tileSize
        );
      } else {
        // Fallback to colors
        this.ctx.fillStyle = this.getTerrainColor(tile.type);
        this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
      }

      // Draw grid lines
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, this.tileSize, this.tileSize);
    });
  }

  drawTerritoryBorders(map) {
    map.forEach(tile => {
      if (tile.owner !== null) {
        const x = tile.x * this.tileSize;
        const y = tile.y * this.tileSize;

        // Draw colored border for owned territory
        this.ctx.strokeStyle = tile.owner === 0 ? '#4444FF' : '#FF4444';
        this.ctx.lineWidth = 2;
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
    units.forEach(unit => {
      const x = unit.x * this.tileSize;
      const y = unit.y * this.tileSize;

      // Draw unit sprite or shape
      const spriteName = `${unit.type.toLowerCase()}-${unit.owner}`;
      if (this.sprites[spriteName]) {
        this.ctx.drawImage(
          this.sprites[spriteName],
          x + 5, y + 5, this.tileSize - 10, this.tileSize - 10
        );
      } else {
        // Fallback to circles
        this.ctx.fillStyle = unit.owner === 0 ? '#0066CC' : '#CC0000';
        this.ctx.beginPath();
        this.ctx.arc(
          x + this.tileSize/2,
          y + this.tileSize/2,
          this.tileSize/3,
          0, Math.PI * 2
        );
        this.ctx.fill();

        // Unit type label
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('S', x + this.tileSize/2, y + this.tileSize/2);
      }

      // HP bar
      this.drawHPBar(x, y, unit.hp, unit.maxHp);

      // Selection highlight
      if (this.selectedUnit?.id === unit.id) {
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
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
  }

  renderUI() {
    // Clear UI canvas
    this.uiCtx.clearRect(0, 0, this.uiCanvas.width, this.uiCanvas.height);

    // Draw possible moves
    if (this.possibleMoves.length > 0) {
      this.possibleMoves.forEach(tile => {
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
    if (this.hoveredTile) {
      const x = this.hoveredTile.x * this.tileSize;
      const y = this.hoveredTile.y * this.tileSize;

      this.uiCtx.strokeStyle = '#FFF';
      this.uiCtx.lineWidth = 2;
      this.uiCtx.strokeRect(x, y, this.tileSize, this.tileSize);
    }
  }

  getTerrainColor(type) {
    const colors = {
      FIELD: '#90EE90',
      MOUNTAIN: '#8B7355',
      WATER: '#4682B4'
    };
    return colors[type] || '#808080';
  }

  selectUnit(unit) {
    this.selectedUnit = unit;
    this.calculatePossibleMoves(unit);
    this.renderUI();
  }

  calculatePossibleMoves(unit) {
    if (!unit || !this.gameState) {
      this.possibleMoves = [];
      return;
    }

    // Simple adjacent tile calculation for soldiers
    this.possibleMoves = [];
    const dirs = [[0,1], [0,-1], [1,0], [-1,0]];

    dirs.forEach(([dx, dy]) => {
      const newX = unit.x + dx;
      const newY = unit.y + dy;

      if (newX >= 0 && newX < this.mapWidth && newY >= 0 && newY < this.mapHeight) {
        const tile = this.gameState.map.find(t => t.x === newX && t.y === newY);
        if (tile && tile.type === 'FIELD') {
          const occupied = this.gameState.units.some(u => u.x === newX && u.y === newY);
          if (!occupied) {
            this.possibleMoves.push({x: newX, y: newY});
          }
        }
      }
    });
  }
}
```

#### Game Client (game-client.js)
```javascript
class GameClient {
  constructor() {
    this.ws = null;
    this.gameState = null;
    this.myTeamId = -1;
    this.selectedUnit = null;
    this.pendingActions = [];

    this.canvas = document.getElementById('gameCanvas');
    this.uiCanvas = document.getElementById('uiCanvas');
    this.renderer = new GameRenderer(this.canvas, this.uiCanvas);

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('connectBtn').onclick = () => this.connect();
    document.getElementById('endTurnBtn').onclick = () => this.submitTurn();
    document.getElementById('buildUnitBtn').onclick = () => this.buildUnit();

    this.renderer.onTileClick = (x, y) => this.handleTileClick(x, y);
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log('Connected to server');
      document.getElementById('connectBtn').disabled = true;
      document.getElementById('endTurnBtn').disabled = false;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      document.getElementById('connectBtn').disabled = false;
      document.getElementById('endTurnBtn').disabled = true;
    };
  }

  handleMessage(message) {
    switch(message.type) {
      case 'AUTH_SUCCESS':
        this.myTeamId = message.teamId;
        console.log(`Playing as team ${this.myTeamId}`);
        break;

      case 'GAME_STATE':
        this.gameState = message.state;
        this.renderer.gameState = this.gameState;
        this.updateUI();
        this.renderer.render(this.gameState);
        this.pendingActions = [];
        break;

      case 'GAME_OVER':
        this.showGameOver(message);
        break;
    }
  }

  handleTileClick(x, y) {
    if (!this.gameState) return;

    // Check if clicking on a unit
    const unit = this.gameState.units.find(u => u.x === x && u.y === y);

    if (unit) {
      if (unit.owner === this.myTeamId) {
        // Select our unit
        this.selectedUnit = unit;
        this.renderer.selectUnit(unit);
        this.updateSelectedInfo(unit);
      }
    } else if (this.selectedUnit) {
      // Try to move selected unit
      const canMove = this.renderer.possibleMoves.some(m => m.x === x && m.y === y);
      if (canMove) {
        this.addAction({
          type: 'MOVE',
          unitId: this.selectedUnit.id,
          targetX: x,
          targetY: y
        });

        // Visual feedback
        this.selectedUnit = null;
        this.renderer.selectedUnit = null;
        this.renderer.possibleMoves = [];
        this.renderer.renderUI();
      }
    }
  }

  addAction(action) {
    this.pendingActions.push(action);
    console.log('Added action:', action);
  }

  submitTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'SUBMIT_ACTIONS',
      actions: this.pendingActions
    }));

    this.pendingActions = [];
    this.selectedUnit = null;
    this.renderer.selectedUnit = null;
    this.renderer.possibleMoves = [];
  }

  buildUnit() {
    if (!this.gameState) return;

    const team = this.gameState.teams[this.myTeamId];
    if (team.territoryPoints < 20) {
      alert('Not enough TP! Need 20 TP to build a soldier.');
      return;
    }

    // Find a valid build location (controlled territory without units)
    const validTiles = this.gameState.map.filter(tile => {
      if (tile.owner !== this.myTeamId) return false;
      if (tile.type !== 'FIELD') return false;
      const occupied = this.gameState.units.some(u => u.x === tile.x && u.y === tile.y);
      return !occupied;
    });

    if (validTiles.length === 0) {
      alert('No valid build location! Need empty controlled territory.');
      return;
    }

    // Build at first valid location (in real game, let player choose)
    const tile = validTiles[0];
    this.addAction({
      type: 'BUILD_UNIT',
      unitType: 'SOLDIER',
      x: tile.x,
      y: tile.y
    });

    alert(`Building soldier at (${tile.x}, ${tile.y})`);
  }

  updateUI() {
    if (!this.gameState) return;

    // Update turn counter
    document.getElementById('turn').textContent = this.gameState.turn;

    // Update team info
    for (let teamId = 0; teamId < 2; teamId++) {
      const team = this.gameState.teams[teamId];
      document.getElementById(`tp-${teamId}`).textContent = team.territoryPoints;
      document.getElementById(`income-${teamId}`).textContent = team.income;

      const units = this.gameState.units.filter(u => u.owner === teamId);
      document.getElementById(`units-${teamId}`).textContent = units.length;

      const territory = this.gameState.map.filter(t => t.owner === teamId).length;
      document.getElementById(`territory-${teamId}`).textContent = territory;
    }

    // Update build button
    const myTeam = this.gameState.teams[this.myTeamId];
    const buildBtn = document.getElementById('buildUnitBtn');
    buildBtn.disabled = myTeam?.territoryPoints < 20;
  }

  updateSelectedInfo(unit) {
    const info = document.getElementById('selectedInfo');
    info.innerHTML = `
      <div style="margin-top: 10px; padding: 10px; background: #444; border-radius: 4px;">
        <strong>Selected: ${unit.type}</strong><br>
        HP: ${unit.hp}/${unit.maxHp}<br>
        Position: (${unit.x}, ${unit.y})<br>
        <small>Click a green tile to move</small>
      </div>
    `;
  }

  showGameOver(message) {
    const winner = message.winner === null ? 'Draw!' : `Team ${message.winner} wins!`;
    alert(`Game Over! ${winner}`);
  }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
  const game = new GameClient();
});
```

### 5. Enhanced Server Architecture

#### Manual Play Support

For V2's manual play support, we use the existing architecture from topic-architecture.md:
- Server starts with **normal 250ms timeout** for bot games
- For manual testing: **Admin disables timeout** via admin command
- Players submit actions with **PASS action** when ready (or actual actions)
- Server remains **agnostic** - doesn't know or care if players are human or bot

This keeps the server simple and follows the established architecture.

```javascript
// server/game-server.js
import { WebSocketServer } from 'ws';
import { GameV2 } from '../logic/game-v2.js';

class GameServer {
  constructor(port = 8080) {
    this.port = port;
    this.wss = null;
    this.game = null;
    this.connections = new Map();
    this.pendingActions = new Map();
    this.turnTimer = null;
    this.turnTimeout = 250;

    this.initServer();
  }

  initServer() {
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`Game server running on ws://localhost:${this.port}`);

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  handleConnection(ws) {
    const connectionId = this.generateId();
    const teamId = this.connections.size;

    if (teamId >= 2) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        message: 'Game full'
      }));
      ws.close();
      return;
    }

    const connection = {
      id: connectionId,
      ws: ws,
      teamId: teamId,
      isAlive: true
    };

    this.connections.set(connectionId, connection);

    // Send auth success
    ws.send(JSON.stringify({
      type: 'AUTH_SUCCESS',
      teamId: teamId
    }));

    console.log(`Team ${teamId} connected (${connectionId})`);

    // Start game if both players connected
    if (this.connections.size === 2) {
      this.startGame();
    }

    // Setup connection handlers
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(connectionId, message);
      } catch (err) {
        console.error('Invalid message from', connectionId, err);
      }
    });

    ws.on('close', () => {
      console.log(`Connection ${connectionId} closed`);
      this.handleDisconnect(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`Connection ${connectionId} error:`, error);
    });

    // Heartbeat
    ws.on('pong', () => {
      connection.isAlive = true;
    });
  }

  startGame() {
    console.log('Starting new game');
    this.game = new GameV2();
    this.game.initialize();
    this.broadcastGameState();
    this.startHeartbeat();
  }

  handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    switch(message.type) {
      case 'SUBMIT_ACTIONS':
        this.handleActions(connection.teamId, message.actions);
        break;

      case 'PING':
        connection.ws.send(JSON.stringify({type: 'PONG'}));
        break;
    }
  }

  handleActions(teamId, actions) {
    if (!this.game) return;

    console.log(`Team ${teamId} submitted ${actions.length} actions`);
    this.pendingActions.set(teamId, actions);

    // Clear existing timer
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
    }

    // Process turn if both submitted
    if (this.pendingActions.size === 2) {
      this.processTurn();
    } else {
      // Set timeout for missing player
      this.turnTimer = setTimeout(() => {
        console.log('Turn timeout reached');
        this.processTurn();
      }, this.turnTimeout);
    }
  }

  processTurn() {
    if (!this.game) return;

    const team0Actions = this.pendingActions.get(0) || [];
    const team1Actions = this.pendingActions.get(1) || [];

    console.log(`Processing turn ${this.game.turn}`);

    // Process the turn
    const turnResult = this.game.processActions(team0Actions, team1Actions);

    // Log any errors
    if (turnResult.errors.length > 0) {
      turnResult.errors.forEach(err => {
        console.log(`Action error: ${err.reason}`);
      });
    }

    // Clear pending actions
    this.pendingActions.clear();
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    // Broadcast new state
    this.broadcastGameState();

    // Check game over
    if (this.game.isOver()) {
      this.handleGameOver();
    }
  }

  broadcastGameState() {
    const state = this.game.getState();

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(JSON.stringify({
          type: 'GAME_STATE',
          yourTeamId: connection.teamId,
          state: state
        }));
      }
    });
  }

  handleGameOver() {
    const winner = this.game.getWinner();
    const scores = this.game.getScores();

    console.log(`Game over! Winner: ${winner === null ? 'TIE' : `Team ${winner}`}`);

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(JSON.stringify({
          type: 'GAME_OVER',
          winner: winner,
          scores: scores,
          reason: this.game.turn >= this.game.maxTurns ? 'TURN_LIMIT' : 'ELIMINATION'
        }));
      }
    });

    // Reset after delay
    setTimeout(() => this.reset(), 5000);
  }

  handleDisconnect(connectionId) {
    this.connections.delete(connectionId);

    if (this.game) {
      console.log('Player disconnected during game, ending game');
      this.reset();
    }
  }

  reset() {
    console.log('Resetting server');
    this.game = null;
    this.connections.clear();
    this.pendingActions.clear();

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.stopHeartbeat();
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((connection) => {
        if (!connection.isAlive) {
          console.log(`Connection ${connection.id} failed heartbeat`);
          connection.ws.terminate();
          this.handleDisconnect(connection.id);
          return;
        }

        connection.isAlive = false;
        connection.ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Start server
const server = new GameServer(8080);
```

## Implementation Tasks

### Phase 1: Enhanced Game Logic (logic/game-v2.js)
- [ ] Create terrain system with Field, Mountain, Water
- [ ] Implement economy with TP income from controlled territory
- [ ] Add unit building with TP costs
- [ ] Territory capture mechanics
- [ ] Map generation for symmetrical island

### Phase 2: Canvas Frontend (visuals/)
- [ ] Create HTML with canvas elements
- [ ] Implement GameRenderer class for drawing
- [ ] Add mouse interaction for unit selection
- [ ] Show possible moves overlay
- [ ] Display economy information
- [ ] Manual unit control with click-to-move

### Phase 3: Enhanced Server (server/)
- [ ] Improved connection management
- [ ] Better error handling
- [ ] Heartbeat/ping-pong for connection health
- [ ] Action validation with detailed errors
- [ ] Turn timeout handling

### Phase 4: Integration & Testing
- [ ] Connect frontend to enhanced server
- [ ] Test economy system balance
- [ ] Verify manual controls work correctly
- [ ] Test with multiple game sessions

## Key Improvements Over V1

1. **Visual Quality**: Canvas rendering vs DOM elements
2. **Gameplay Depth**: Economy system adds point to game
3. **Terrain Variety**: Different tile types create tactical considerations
4. **Manual Control**: Click-to-play for easier testing and debugging
5. **Server Robustness**: Better error handling and connection management
6. **Code Organization**: Cleaner separation of concerns

## Testing Checklist

### Core Functionality
- [ ] Server starts and accepts 2 connections
- [ ] Game initializes with symmetrical map
- [ ] Both players receive initial game state
- [ ] Turn processing works with 250ms timeout
- [ ] Game ends correctly at turn 50
- [ ] Game ends when one player has no units
- [ ] Server resets properly after game ends

### Economy System
- [ ] Players start with 20 TP
- [ ] Controlled field tiles generate 0.5 TP/turn
- [ ] Income is calculated correctly at turn start
- [ ] Building a soldier costs 20 TP
- [ ] Cannot build units without sufficient TP
- [ ] Territory ownership updates when units move
- [ ] Income updates when territory changes hands

### Terrain & Movement
- [ ] Map generates with Fields, Mountains, and Water
- [ ] Mountains are impassable
- [ ] Water tiles form island boundaries
- [ ] Units can only move to adjacent field tiles
- [ ] Units cannot move to occupied tiles
- [ ] Movement is restricted to 1 tile per turn
- [ ] Territory is captured when moving onto enemy/neutral tiles

### Canvas Rendering
- [ ] Map renders correctly with all terrain types
- [ ] Units display with team colors
- [ ] HP bars show current health
- [ ] Territory borders show ownership
- [ ] Grid lines are visible
- [ ] Canvas scales properly to map size
- [ ] No rendering artifacts or flicker

### Manual Controls
- [ ] Left-click selects friendly units
- [ ] Selected unit shows highlight
- [ ] Possible moves display as green overlays
- [ ] Click on valid tile moves unit
- [ ] Cannot select enemy units
- [ ] Cannot move to invalid tiles
- [ ] Build button creates unit on valid tile
- [ ] End turn button submits all actions

### User Interface
- [ ] Turn counter updates each turn
- [ ] Team TP displays correctly
- [ ] Income per turn shows accurate value
- [ ] Unit count updates properly
- [ ] Territory count is accurate
- [ ] Build button disables when TP < 20
- [ ] Selected unit info displays
- [ ] Game over message shows winner

### Network & Error Handling
- [ ] Disconnection detected and handled
- [ ] Reconnection not allowed mid-game
- [ ] Invalid actions are rejected silently
- [ ] Network lag doesn't break turn processing
- [ ] Heartbeat keeps connections alive
- [ ] Error messages logged to console
- [ ] Game state stays synchronized

### Edge Cases
- [ ] Building unit on last available tile
- [ ] Moving when all adjacent tiles blocked
- [ ] Both players submit no actions
- [ ] Rapid clicking doesn't break state
- [ ] Window resize doesn't break canvas
- [ ] Tab switching maintains connection
- [ ] Multiple games in sequence work

## Next Steps (V3 and beyond)

After V2 is complete, consider:
- Multiple unit types (Archers, Raiders)
- Cities and city building
- Monument for Blood Points
- Zone of Control mechanics
- Authentication system
- Spectator mode
- Replay system
- AI opponent for single-player testing