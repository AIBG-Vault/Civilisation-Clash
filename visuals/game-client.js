// Game client for manual play

class GameClient {
  constructor() {
    this.ws = null;
    this.gameState = null;
    this.myTeamId = -1;
    this.selectedUnit = null;
    this.pendingActions = [];
    this.isConnected = false;
    this.botMode = false;
    this.expandMode = false;
    this.selectedTile = null;
    this.role = null; // 'player', 'admin', or 'spectator'
    this.timeoutEnabled = true;
    this.pendingExpansions = new Set(); // Track tiles that will be expanded this turn

    // Rendering throttle for bot games
    this.renderThrottleTimer = null;
    this.pendingRender = false;
    this.lastRenderTime = 0;
    this.playbackFPS = 1; // Default 1 FPS
    this.MIN_RENDER_INTERVAL = 1000 / this.playbackFPS; // Convert FPS to interval
    this.throttleEnabled = true; // Can be toggled via UI
    this.stateQueue = []; // Queue of game states to render
    this.isPlayingBack = false; // Whether we're playing back queued states

    this.canvas = document.getElementById('gameCanvas');
    this.uiCanvas = document.getElementById('uiCanvas');
    this.renderer = new GameRenderer(this.canvas, this.uiCanvas);

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('connectBtn').onclick = () => {
      if (this.isConnected) {
        this.disconnect();
      } else {
        this.connect();
      }
    };
    document.getElementById('endTurnBtn').onclick = () => this.submitTurn();
    document.getElementById('buildUnitBtn').onclick = () => this.buildUnit();
    document.getElementById('expandBtn').onclick = () => this.expandTerritory();
    document.getElementById('botModeBtn').onclick = () => this.toggleBotMode();
    document.getElementById('adminLoginBtn').onclick = () => this.adminLogin();
    document.getElementById('adminTimeoutBtn').onclick = () => this.toggleTimeout();
    document.getElementById('throttleToggleBtn').onclick = () => this.toggleThrottle();
    document.getElementById('fpsBtn').onclick = () => this.cycleFPS();

    this.renderer.onTileClick = (x, y) => this.handleTileClick(x, y);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connect() {
    if (this.isConnected) return;

    // Prompt for password
    const password = prompt(
      'Enter password:\n- "password0" for Blue Team\n- "password1" for Red Team\n- "spectator" for spectator mode\n- "admin123" for admin'
    );
    if (!password) {
      console.log('Connection cancelled');
      return;
    }

    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log('Authenticating with server...');
      // Send AUTH message immediately
      this.ws.send(
        JSON.stringify({
          type: 'AUTH',
          password: password,
          name: 'Web Client',
        })
      );
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      document.getElementById('status').textContent = 'Connection error';
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      this.isConnected = false;
      this.role = null;
      this.myTeamId = -1;
      document.getElementById('connectBtn').textContent = 'Connect to Server';
      document.getElementById('connectBtn').disabled = false;
      document.getElementById('endTurnBtn').disabled = true;
      document.getElementById('buildUnitBtn').disabled = true;
      document.getElementById('expandBtn').disabled = true;
      document.getElementById('status').textContent = 'Disconnected';
      document.getElementById('adminControls').style.display = 'none';
      document.getElementById('adminLoginBtn').style.display = 'block';
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'AUTH_SUCCESS':
        this.myTeamId = message.teamId;
        this.role = message.role;
        this.isConnected = true;

        console.log(`Authenticated as ${this.role} (Team ${this.myTeamId})`);
        document.getElementById('connectBtn').textContent = 'Disconnect';
        document.getElementById('connectBtn').disabled = false;

        if (this.role === 'spectator') {
          document.getElementById('status').textContent = 'Connected - Spectating';
          // Disable all controls for spectators
          document.getElementById('endTurnBtn').disabled = true;
          document.getElementById('buildUnitBtn').disabled = true;
          document.getElementById('expandBtn').disabled = true;
          document.getElementById('botModeBtn').disabled = true;
        } else if (this.role === 'admin') {
          document.getElementById('status').textContent = 'Connected - Admin Mode';
          document.getElementById('adminControls').style.display = 'block';
          document.getElementById('adminLoginBtn').style.display = 'none';
          // Admin can still play if they want
          document.getElementById('endTurnBtn').disabled = false;
          document.getElementById('buildUnitBtn').disabled = false;
          document.getElementById('expandBtn').disabled = false;
        } else if (this.role === 'player') {
          document.getElementById('status').textContent = `Connected - Playing as ${
            this.myTeamId === 0 ? 'Blue Team' : 'Red Team'
          }`;
          document.getElementById('endTurnBtn').disabled = false;
          document.getElementById('buildUnitBtn').disabled = false;
          document.getElementById('expandBtn').disabled = false;
        }
        break;

      case 'GAME_STATE':
        this.gameState = message.state;
        // Update teamId only if we're a player
        if (this.role === 'player' && message.yourTeamId >= 0) {
          this.myTeamId = message.yourTeamId;
        }
        this.renderer.gameState = this.gameState;
        this.updateUI();

        // Throttle rendering for smooth animation when bots are playing
        this.throttledRender();

        this.pendingActions = [];
        document.getElementById('pendingActions').textContent = '0 actions queued';

        if (this.gameState.gameOver) {
          this.showGameOver();
          if (this.botMode) {
            this.toggleBotMode(); // Stop bot when game ends
          }
        } else if (this.botMode && this.role === 'player') {
          // Bot responds immediately to new game state (only for players)
          this.makeBotMove();
        }
        break;

      case 'GAME_OVER':
        this.showGameOver(message);
        break;

      case 'ERROR':
        console.error('Server error:', message.message);
        alert(`Error: ${message.message}`);
        break;

      case 'ADMIN_MESSAGE':
        console.log('Admin:', message.message);
        document.getElementById('status').textContent += ` - ${message.message}`;
        break;
    }
  }

  handleTileClick(x, y) {
    if (!this.gameState || this.gameState.gameOver || this.role === 'spectator') return;

    const tile = this.gameState.map.find((t) => t.x === x && t.y === y);
    if (!tile) return;

    // If in expand mode, try to expand territory
    if (this.expandMode) {
      if (tile.type === 'FIELD' && tile.owner === null) {
        // Check if adjacent to our territory OR pending expansions (for chaining)
        const adjacent = this.getAdjacentTiles(x, y);
        const hasOurTerritory = adjacent.some(
          (t) => t.owner === this.myTeamId || this.pendingExpansions.has(`${t.x},${t.y}`)
        );

        if (hasOurTerritory) {
          this.addAction({
            type: 'EXPAND_TERRITORY',
            x: x,
            y: y,
          });
          // Track this tile as pending expansion for chaining
          this.pendingExpansions.add(`${x},${y}`);
          document.getElementById('selectedInfo').innerHTML = `
            <div style="color: #4f4;">Territory expansion queued at (${x}, ${y})</div>
            <div style="color: #ff9800;">Still in expand mode - click more tiles to chain!</div>
            <div style="color: #ccc;">Expansions queued: ${this.pendingExpansions.size}</div>
          `;
          // Stay in expand mode to allow chaining
        } else {
          document.getElementById('selectedInfo').innerHTML = `
            <div style="color: #f44;">Must be adjacent to your territory!</div>
            <div style="color: #ff9800;">Still in expand mode</div>
          `;
        }
      } else {
        document.getElementById('selectedInfo').innerHTML = `
          <div style="color: #f44;">Can only expand to neutral fields!</div>
          <div style="color: #ff9800;">Still in expand mode</div>
        `;
      }
      // Don't exit expand mode - let user exit manually or by pressing End Turn
      return;
    }

    // Check if clicking on a unit
    const unit = this.gameState.units.find((u) => u.x === x && u.y === y);

    if (unit) {
      if (unit.owner === this.myTeamId) {
        // Select our unit
        this.selectedUnit = unit;
        this.renderer.selectUnit(unit);
        this.updateSelectedInfo(unit);
      } else {
        // Clicked enemy unit
        this.selectedUnit = null;
        this.renderer.clearSelection();
        document.getElementById('selectedInfo').innerHTML = `
          <div style="color: #f44;">Enemy unit - HP: ${unit.hp}/${unit.maxHp}</div>
        `;
      }
    } else if (this.selectedUnit) {
      // Try to move selected unit
      const canMove = this.renderer.possibleMoves.some((m) => m.x === x && m.y === y);
      if (canMove) {
        this.addAction({
          type: 'MOVE',
          unitId: this.selectedUnit.id,
          targetX: x,
          targetY: y,
        });

        // Visual feedback - clear selection
        this.selectedUnit = null;
        this.renderer.clearSelection();
        document.getElementById('selectedInfo').innerHTML = '';
      }
    } else {
      // Clicked empty tile - show tile info
      this.selectedTile = tile;
      document.getElementById('selectedInfo').innerHTML = `
        <div>Tile: ${tile.type} ${
          tile.owner !== null ? `(${tile.owner === 0 ? 'Blue' : 'Red'})` : '(Neutral)'
        }</div>
        <div>Position: (${tile.x}, ${tile.y})</div>
      `;
    }
  }

  addAction(action) {
    this.pendingActions.push(action);
    console.log('Added action:', action);
    document.getElementById('pendingActions').textContent =
      `${this.pendingActions.length} actions queued`;
  }

  submitTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.pendingActions.length === 0) {
      // Send PASS action if no actions queued
      this.ws.send(
        JSON.stringify({
          type: 'SUBMIT_ACTIONS',
          actions: [{ type: 'PASS' }],
        })
      );
    } else {
      this.ws.send(
        JSON.stringify({
          type: 'SUBMIT_ACTIONS',
          actions: this.pendingActions,
        })
      );
    }

    this.pendingActions = [];
    this.pendingExpansions.clear(); // Clear pending expansions after submit
    this.selectedUnit = null;
    this.renderer.clearSelection();
    document.getElementById('pendingActions').textContent = '0 actions queued';
    document.getElementById('selectedInfo').innerHTML = '';

    // Exit expand mode when submitting turn
    if (this.expandMode) {
      this.expandMode = false;
      document.getElementById('expandBtn').style.background = '#9C27B0';
      document.getElementById('expandBtn').textContent = 'Expand Territory (5 TP)';
    }
  }

  buildUnit() {
    if (!this.gameState) return;

    const team = this.gameState.teams.find((t) => t.id === this.myTeamId);
    if (!team || team.territoryPoints < 20) {
      alert('Not enough TP! Need 20 TP to build a soldier.');
      return;
    }

    // Find valid build locations (controlled territory without units)
    const validTiles = this.gameState.map.filter((tile) => {
      if (tile.owner !== this.myTeamId) return false;
      if (tile.type !== 'FIELD') return false;
      const occupied = this.gameState.units.some((u) => u.x === tile.x && u.y === tile.y);
      return !occupied;
    });

    if (validTiles.length === 0) {
      alert('No valid build location! Need empty controlled territory.');
      return;
    }

    // For simplicity, build at first valid location
    // In a full implementation, let player choose
    const tile = validTiles[0];
    this.addAction({
      type: 'BUILD_UNIT',
      unitType: 'SOLDIER',
      x: tile.x,
      y: tile.y,
    });

    alert(`Building soldier at (${tile.x}, ${tile.y}). Submit turn to confirm.`);
  }

  expandTerritory() {
    if (!this.gameState) return;

    // Toggle expand mode
    if (this.expandMode) {
      // Exit expand mode
      this.expandMode = false;
      document.getElementById('expandBtn').style.background = '#9C27B0';
      document.getElementById('expandBtn').textContent = 'Expand Territory (5 TP)';
      document.getElementById('selectedInfo').innerHTML = `
        <div>Expand mode disabled</div>
      `;
      return;
    }

    const team = this.gameState.teams.find((t) => t.id === this.myTeamId);
    if (!team || team.territoryPoints < 5) {
      alert('Not enough TP! Need 5 TP to expand territory.');
      return;
    }

    this.expandMode = true;
    document.getElementById('expandBtn').style.background = '#ff9800';
    document.getElementById('expandBtn').textContent = 'Exit Expand Mode';
    document.getElementById('selectedInfo').innerHTML = `
      <div style="color: #ff9800;">Click neutral fields adjacent to your territory to expand (can chain!)</div>
    `;
  }

  updateUI() {
    if (!this.gameState) return;

    // Update turn counter
    document.getElementById('turn').textContent = this.gameState.turn;
    document.getElementById('maxTurns').textContent = this.gameState.maxTurns;

    // Update team info
    for (let teamId = 0; teamId < 2; teamId++) {
      const team = this.gameState.teams.find((t) => t.id === teamId);
      if (team) {
        // Update both top bar and detail panel
        document.getElementById(`tp-${teamId}`).textContent = Math.floor(team.territoryPoints) || 0;
        const detailElem = document.getElementById(`tp-detail-${teamId}`);
        if (detailElem) detailElem.textContent = Math.floor(team.territoryPoints) || 0;

        document.getElementById(`income-${teamId}`).textContent = team.income || 0;
      }

      const units = this.gameState.units.filter((u) => u.owner === teamId);
      document.getElementById(`units-${teamId}`).textContent = units.length;

      const territory = this.gameState.map.filter((t) => t.owner === teamId).length;
      document.getElementById(`territory-${teamId}`).textContent = territory;
    }

    // Update build button
    const myTeam = this.gameState.teams.find((t) => t.id === this.myTeamId);
    const buildBtn = document.getElementById('buildUnitBtn');
    const expandBtn = document.getElementById('expandBtn');
    if (myTeam) {
      buildBtn.disabled = myTeam.territoryPoints < 20;
      buildBtn.textContent = `Build Soldier (20 TP)`;

      expandBtn.disabled = myTeam.territoryPoints < 5;
      expandBtn.textContent = `Expand Territory (5 TP)`;
    }
  }

  updateSelectedInfo(unit) {
    const info = document.getElementById('selectedInfo');
    info.innerHTML = `
      <div style="padding: 10px; background: #444; border-radius: 4px;">
        <strong>Selected: ${unit.type}</strong><br>
        HP: ${unit.hp}/${unit.maxHp}<br>
        Position: (${unit.x}, ${unit.y})<br>
        ${unit.canMove ? '<small>Click a green tile to move</small>' : '<small style="color: #f44;">Cannot move (capture fatigue)</small>'}
      </div>
    `;
  }

  throttledRender() {
    // If throttling is disabled, render immediately
    if (!this.throttleEnabled) {
      this.renderer.render(this.gameState);
      return;
    }

    // Queue the current state for playback
    if (this.gameState) {
      this.stateQueue.push(JSON.parse(JSON.stringify(this.gameState)));
    }

    // Start playback if not already running
    if (!this.isPlayingBack) {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.stateQueue.length === 0) {
      this.isPlayingBack = false;
      document.getElementById('pendingActions').textContent = '0 actions queued';
      return;
    }

    this.isPlayingBack = true;

    // Show playback status
    document.getElementById('pendingActions').textContent =
      `Playing back: ${this.stateQueue.length} states remaining`;

    // Render next state from queue
    const nextState = this.stateQueue.shift();
    this.renderer.render(nextState);

    // Update UI with the queued state
    const tempState = this.gameState;
    this.gameState = nextState;
    this.updateUI();
    this.gameState = tempState;

    // Schedule next render
    setTimeout(() => {
      this.startPlayback();
    }, this.MIN_RENDER_INTERVAL);
  }

  showGameOver(message) {
    const winner = message?.winner ?? this.gameState?.winner;
    const winnerText = winner === null ? 'Draw!' : `${winner === 0 ? 'Blue' : 'Red'} Team wins!`;

    document.getElementById('gameOverText').textContent = `Game Over! ${winnerText}`;
    document.getElementById('gameOver').style.display = 'block';

    setTimeout(() => {
      document.getElementById('gameOver').style.display = 'none';
    }, 5000);
  }

  toggleBotMode() {
    this.botMode = !this.botMode;
    const btn = document.getElementById('botModeBtn');

    if (this.botMode) {
      btn.textContent = 'Disable Bot';
      btn.style.background = '#f44';
      document.getElementById('status').textContent += ' - BOT MODE';
      if (this.gameState && !this.gameState.gameOver) {
        // Bot will respond to next game state
        this.makeBotMove();
      }
    } else {
      btn.textContent = 'Enable Bot';
      btn.style.background = '#4CAF50';
      const status = document.getElementById('status').textContent;
      document.getElementById('status').textContent = status.replace(' - BOT MODE', '');
    }
  }

  startBotActions() {
    // Bot responds to game state changes, not on a timer
    // This ensures maximum speed without flooding
    if (this.gameState && !this.gameState.gameOver) {
      this.makeBotMove();
    }
  }

  makeBotMove() {
    if (!this.gameState || this.gameState.gameOver) return;

    const actions = [];
    const myTeam = this.gameState.teams.find((t) => t.id === this.myTeamId);
    const myUnits = this.gameState.units.filter((u) => u.owner === this.myTeamId);

    // Try to build a unit if we have enough TP
    if (myTeam && myTeam.territoryPoints >= 20 && Math.random() < 0.3) {
      const validTiles = this.gameState.map.filter((tile) => {
        if (tile.owner !== this.myTeamId || tile.type !== 'FIELD') return false;
        return !this.gameState.units.some((u) => u.x === tile.x && u.y === tile.y);
      });

      if (validTiles.length > 0) {
        const tile = validTiles[Math.floor(Math.random() * validTiles.length)];
        actions.push({
          type: 'BUILD_UNIT',
          unitType: 'SOLDIER',
          x: tile.x,
          y: tile.y,
        });
      }
    }

    // Try to expand territory if we have enough TP
    if (myTeam && myTeam.territoryPoints >= 5 && Math.random() < 0.4) {
      const ownedTiles = this.gameState.map.filter((t) => t.owner === this.myTeamId);
      for (const owned of ownedTiles) {
        const adjacent = this.getAdjacentTiles(owned.x, owned.y);
        const neutralAdjacent = adjacent.filter((t) => t.owner === null && t.type === 'FIELD');
        if (neutralAdjacent.length > 0) {
          const target = neutralAdjacent[Math.floor(Math.random() * neutralAdjacent.length)];
          actions.push({
            type: 'EXPAND_TERRITORY',
            x: target.x,
            y: target.y,
          });
          break; // Only expand once per turn
        }
      }
    }

    // Move units randomly
    myUnits.forEach((unit) => {
      if (!unit.canMove) return;

      const possibleMoves = this.getPossibleMoves(unit);
      if (possibleMoves.length > 0) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        actions.push({
          type: 'MOVE',
          unitId: unit.id,
          targetX: move.x,
          targetY: move.y,
        });
      }
    });

    // Submit actions
    if (actions.length === 0) {
      actions.push({ type: 'PASS' });
    }

    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: actions,
      })
    );

    console.log('Bot submitted', actions.length, 'actions');
  }

  getAdjacentTiles(x, y) {
    const adjacent = [];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dx, dy] of dirs) {
      const tile = this.gameState.map.find((t) => t.x === x + dx && t.y === y + dy);
      if (tile) adjacent.push(tile);
    }

    return adjacent;
  }

  getPossibleMoves(unit) {
    const moves = [];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dx, dy] of dirs) {
      const newX = unit.x + dx;
      const newY = unit.y + dy;

      const tile = this.gameState.map.find((t) => t.x === newX && t.y === newY);
      if (!tile || tile.type !== 'FIELD') continue;

      const occupied = this.gameState.units.some((u) => u.x === newX && u.y === newY);
      if (!occupied) {
        moves.push({ x: newX, y: newY });
      }
    }

    return moves;
  }

  adminLogin() {
    alert('Please reconnect with admin password (admin123) to access admin controls');
  }

  toggleTimeout() {
    if (this.role !== 'admin' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.timeoutEnabled = !this.timeoutEnabled;
    const action = this.timeoutEnabled ? 'ENABLE_BOT_TIMEOUT' : 'DISABLE_TIMEOUT';

    this.ws.send(
      JSON.stringify({
        type: 'ADMIN_COMMAND',
        action: action,
      })
    );

    const btn = document.getElementById('adminTimeoutBtn');
    if (this.timeoutEnabled) {
      btn.textContent = 'Disable Timeout';
      btn.style.background = '#f44';
      console.log('Bot timeout enabled (250ms)');
    } else {
      btn.textContent = 'Enable Bot Mode (250ms)';
      btn.style.background = '#4CAF50';
      console.log('Timeout disabled');
    }
  }

  toggleThrottle() {
    if (this.role !== 'admin') return;

    this.throttleEnabled = !this.throttleEnabled;
    const btn = document.getElementById('throttleToggleBtn');

    // Clear state queue when toggling throttle
    this.stateQueue = [];
    this.isPlayingBack = false;
    document.getElementById('pendingActions').textContent = '0 actions queued';

    if (this.throttleEnabled) {
      btn.textContent = 'Disable Throttle';
      btn.style.background = '#f44';
      console.log(`Render throttling enabled (${this.playbackFPS} FPS)`);
    } else {
      btn.textContent = 'Enable Throttle';
      btn.style.background = '#4CAF50';
      console.log('Render throttling disabled (unlimited FPS)');
    }
  }

  cycleFPS() {
    if (this.role !== 'admin') return;

    // Cycle through FPS options: 1, 2, 5, 10, 20
    const fpsOptions = [1, 2, 5, 10, 20];
    const currentIndex = fpsOptions.indexOf(this.playbackFPS);
    const nextIndex = (currentIndex + 1) % fpsOptions.length;
    this.playbackFPS = fpsOptions[nextIndex];
    this.MIN_RENDER_INTERVAL = 1000 / this.playbackFPS;

    const btn = document.getElementById('fpsBtn');
    btn.textContent = `Playback: ${this.playbackFPS} FPS`;
    console.log(`Playback FPS changed to ${this.playbackFPS}`);

    // Clear any pending playback with old timing
    if (this.isPlayingBack) {
      this.stateQueue = [];
      this.isPlayingBack = false;
      document.getElementById('pendingActions').textContent = '0 actions queued';
    }
  }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
  window.gameClient = new GameClient();
});
