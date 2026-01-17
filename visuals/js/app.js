/**
 * Civilization Clash - Main Application
 */
const App = {
  // WebSocket connection
  ws: null,
  wsUrl: 'ws://localhost:8080',
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 2000,

  // Game state
  gameState: null,
  isSpectator: true,
  teamId: null,
  playerName: 'Spectator',

  // Action queue (for manual play)
  actionQueue: [],

  // Timer
  timerInterval: null,
  turnStartTime: null,
  turnTimeout: 2000,

  /**
   * Initialize the application
   */
  init() {
    // Apply saved theme
    Panels.applySavedTheme();

    // Initialize panels
    Panels.init();

    // Initialize renderer
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      Renderer.init(canvas);
    }

    // Load mock data for demo (remove when WebSocket is connected)
    this.loadMockGameState();

    // Try to connect to WebSocket
    // this.connectWebSocket();

    // Log initialization
    Panels.addTerminalMessage('Application initialized', 'success');
    Panels.addTerminalMessage('Press T to toggle terminal', 'info');
    Panels.addTerminalMessage('Use mouse wheel to zoom, drag to pan', 'info');
  },

  /**
   * Connect to WebSocket server
   */
  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    Panels.addTerminalMessage(`Connecting to ${this.wsUrl}...`, 'info');
    Panels.updateConnectionStatus(false);

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => this.onWebSocketOpen();
      this.ws.onmessage = (e) => this.onWebSocketMessage(e);
      this.ws.onclose = () => this.onWebSocketClose();
      this.ws.onerror = (e) => this.onWebSocketError(e);
    } catch (error) {
      Panels.addTerminalMessage(`Connection error: ${error.message}`, 'error');
    }
  },

  /**
   * WebSocket open handler
   */
  onWebSocketOpen() {
    Panels.addTerminalMessage('Connected to server', 'success');
    Panels.updateConnectionStatus(true);
    this.reconnectAttempts = 0;

    // Authenticate as spectator
    this.send({
      type: 'AUTH',
      password: '',
      name: this.playerName,
    });
  },

  /**
   * WebSocket message handler
   */
  onWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.handleServerMessage(data);
    } catch (error) {
      Panels.addTerminalMessage(`Invalid message: ${error.message}`, 'error');
    }
  },

  /**
   * WebSocket close handler
   */
  onWebSocketClose() {
    Panels.addTerminalMessage('Disconnected from server', 'warning');
    Panels.updateConnectionStatus(false);

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      Panels.addTerminalMessage(
        `Reconnecting in ${this.reconnectDelay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
        'info'
      );
      setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
    } else {
      Panels.addTerminalMessage('Max reconnection attempts reached', 'error');
    }
  },

  /**
   * WebSocket error handler
   */
  onWebSocketError(error) {
    Panels.addTerminalMessage('WebSocket error', 'error');
  },

  /**
   * Send message to server
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  },

  /**
   * Handle server message
   */
  handleServerMessage(data) {
    switch (data.type) {
      case 'AUTH_SUCCESS':
        this.handleAuthSuccess(data);
        break;

      case 'AUTH_FAILED':
        Panels.addTerminalMessage(`Authentication failed: ${data.reason}`, 'error');
        break;

      case 'GAME_STATE':
        this.handleGameState(data);
        break;

      case 'TURN_START':
        this.handleTurnStart(data);
        break;

      case 'TURN_END':
        this.handleTurnEnd(data);
        break;

      case 'GAME_OVER':
        this.handleGameOver(data);
        break;

      case 'SERVER_STATUS':
        this.handleServerStatus(data);
        break;

      case 'ERROR':
        Panels.addTerminalMessage(`Server error: ${data.message}`, 'error');
        break;

      default:
        Panels.addTerminalMessage(`Unknown message type: ${data.type}`, 'warning');
    }
  },

  /**
   * Handle successful authentication
   */
  handleAuthSuccess(data) {
    this.teamId = data.teamId;
    this.playerName = data.assignedName;
    this.isSpectator = data.isSpectator;

    Panels.addTerminalMessage(
      `Authenticated as: ${this.playerName} (${this.isSpectator ? 'Spectator' : `Team ${this.teamId}`})`,
      'success'
    );

    // Update manual play panel based on role
    if (!this.isSpectator) {
      Panels.showManualConnected(this.teamId);
    }

    // Request current state
    this.send({ type: 'GET_STATE' });
  },

  /**
   * Connect as a player (manual play)
   */
  connectAsPlayer() {
    const teamSelect = document.getElementById('manual-team');
    const passwordInput = document.getElementById('manual-password');

    const preferredTeam = teamSelect ? parseInt(teamSelect.value) : 0;
    const password = passwordInput ? passwordInput.value : '';

    if (!password) {
      Panels.addTerminalMessage('Password required to connect as player', 'warning');
      return;
    }

    // Connect to WebSocket if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
      // Queue auth after connection
      setTimeout(() => {
        this.send({
          type: 'AUTH',
          password: password,
          name: 'ManualPlayer',
          preferredTeam: preferredTeam,
        });
      }, 500);
    } else {
      this.send({
        type: 'AUTH',
        password: password,
        name: 'ManualPlayer',
        preferredTeam: preferredTeam,
      });
    }

    Panels.addTerminalMessage(`Attempting to connect as Team ${preferredTeam}...`, 'info');
  },

  /**
   * Disconnect from player mode
   */
  disconnectPlayer() {
    this.isSpectator = true;
    this.teamId = null;
    this.clearActionQueue();
    Panels.showManualDisconnected();
    Panels.addTerminalMessage('Disconnected from player mode', 'info');
  },

  /**
   * Start expand territory mode
   */
  startExpandMode() {
    Panels.addTerminalMessage('Click a tile adjacent to your territory to expand', 'info');
    // TODO: Set renderer to expand mode
  },

  /**
   * Start build city mode
   */
  startCityMode() {
    Panels.addTerminalMessage('Click a tile in your territory to build a city (80 gold)', 'info');
    // TODO: Set renderer to city mode
  },

  /**
   * Handle game state update
   */
  handleGameState(state) {
    this.gameState = state;

    // Update renderer
    Renderer.setGameState(state);

    // Add to replay history
    if (typeof Replay !== 'undefined') {
      Replay.addState(state);
    }

    // Update UI panels
    this.updateUI();

    Panels.addTerminalMessage(
      `Game state received: Turn ${state.turn}/${state.maxTurns || state.max_turns}`,
      'info'
    );
  },

  /**
   * Handle turn start
   */
  handleTurnStart(data) {
    this.turnStartTime = Date.now();
    this.turnTimeout = data.timeout || 2000;

    // Start timer
    this.startTimer();

    Panels.addTerminalMessage(`Turn ${data.turn} started, timeout: ${this.turnTimeout}ms`, 'info');
  },

  /**
   * Handle turn end
   */
  handleTurnEnd(data) {
    this.stopTimer();
    Panels.addTerminalMessage(`Turn ${data.turn} ended`, 'info');
  },

  /**
   * Handle game over
   */
  handleGameOver(data) {
    this.stopTimer();

    const winner = data.winner !== null ? (data.winner === 0 ? 'Blue' : 'Orange') : 'Tie';

    Panels.addTerminalMessage(`Game Over! Winner: ${winner}`, 'success');
  },

  /**
   * Handle server status
   */
  handleServerStatus(data) {
    // Update settings modal with server status
    Panels.addTerminalMessage(
      `Server status: ${data.gameActive ? 'Game Active' : 'Waiting'}`,
      'info'
    );
  },

  /**
   * Update UI with current game state
   */
  updateUI() {
    if (!this.gameState) return;

    const state = this.gameState;

    // Update player stats
    if (state.players) {
      state.players.forEach((player) => {
        const cities = state.cities ? state.cities.filter((c) => c.owner === player.id).length : 0;
        const units = state.units ? state.units.filter((u) => u.owner === player.id).length : 0;
        const tiles =
          state.map && state.map.tiles
            ? state.map.tiles.filter((t) => t.owner === player.id).length
            : 0;

        Panels.updatePlayerStats(player.id, {
          gold: player.gold,
          income: player.income,
          score: player.score,
          cities,
          units,
          tiles,
        });
      });
    }

    // Update turn info
    Panels.updateTurnInfo({
      current: state.turn,
      max: state.maxTurns || state.max_turns,
      monumentOwner: state.monument ? state.monument.controlled_by : null,
    });

    // Update build modal cities
    if (state.cities && this.teamId !== null) {
      Panels.updateBuildCities(state.cities, this.teamId);
    }

    // Update queued actions
    Panels.updateQueuedCount(this.actionQueue.length);
  },

  /**
   * Start turn timer
   */
  startTimer() {
    this.stopTimer();

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.turnStartTime;
      const remaining = Math.max(0, this.turnTimeout - elapsed);
      Panels.updateTimer(remaining);

      if (remaining <= 0) {
        this.stopTimer();
      }
    }, 100);
  },

  /**
   * Stop turn timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  /**
   * Add action to queue
   */
  queueAction(action) {
    this.actionQueue.push(action);
    Panels.updateActionQueue(this.actionQueue);
    Panels.addTerminalMessage(`Action queued: ${action.action}`, 'action');
  },

  /**
   * Remove action from queue
   */
  removeAction(index) {
    if (index >= 0 && index < this.actionQueue.length) {
      const removed = this.actionQueue.splice(index, 1)[0];
      Panels.updateActionQueue(this.actionQueue);
      Panels.addTerminalMessage(`Removed action: ${removed.action}`, 'info');
    }
  },

  /**
   * Clear action queue
   */
  clearActionQueue() {
    this.actionQueue = [];
    Panels.updateActionQueue(this.actionQueue);
    Panels.addTerminalMessage('Action queue cleared', 'info');
  },

  /**
   * Submit actions to server
   */
  submitActions() {
    if (this.isSpectator) {
      Panels.addTerminalMessage('Cannot submit actions as spectator', 'warning');
      return;
    }

    if (this.actionQueue.length === 0) {
      Panels.addTerminalMessage('No actions to submit', 'warning');
      return;
    }

    this.send({
      type: 'SUBMIT_ACTIONS',
      actions: this.actionQueue,
    });

    Panels.addTerminalMessage(`Submitted ${this.actionQueue.length} actions`, 'success');
    this.clearActionQueue();
  },

  /**
   * Load mock game state for demo
   */
  loadMockGameState() {
    const mockState = {
      turn: 12,
      maxTurns: 200,
      gameOver: false,
      winner: null,
      players: [
        { id: 0, name: 'Blue Empire', gold: 145, score: 320, income: 12 },
        { id: 1, name: 'Orange Dynasty', gold: 98, score: 280, income: 8 },
      ],
      map: {
        width: 15,
        height: 10,
        tiles: this.generateMockTiles(15, 10),
      },
      cities: [
        { x: 2, y: 2, owner: 0 },
        { x: 12, y: 7, owner: 1 },
        { x: 6, y: 4, owner: 0 },
      ],
      units: [
        { x: 3, y: 3, owner: 0, type: 'SOLDIER', hp: 3, canMove: true },
        { x: 4, y: 2, owner: 0, type: 'ARCHER', hp: 2, canMove: true },
        { x: 5, y: 4, owner: 0, type: 'RAIDER', hp: 1, canMove: true },
        { x: 11, y: 6, owner: 1, type: 'SOLDIER', hp: 2, canMove: true },
        { x: 10, y: 7, owner: 1, type: 'SOLDIER', hp: 3, canMove: false },
        { x: 9, y: 5, owner: 1, type: 'ARCHER', hp: 1, canMove: true },
      ],
      monument: {
        x: 7,
        y: 5,
        controlled_by: 0,
      },
    };

    this.handleGameState(mockState);
    Panels.addTerminalMessage('Loaded demo game state', 'success');
  },

  /**
   * Generate mock tiles for demo
   */
  generateMockTiles(width, height) {
    const tiles = [];
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Determine terrain type
        let type = 'FIELD';

        // Water around edges
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          type = 'WATER';
        }
        // Monument at center
        else if (x === centerX && y === centerY) {
          type = 'MONUMENT';
        }
        // Some mountains
        else if ((x === 5 && y === 3) || (x === 9 && y === 6) || (x === 4 && y === 7)) {
          type = 'MOUNTAIN';
        }
        // Some forests
        else if (
          (x === 3 && y === 5) ||
          (x === 8 && y === 3) ||
          (x === 11 && y === 4) ||
          (x === 6 && y === 7)
        ) {
          type = 'FOREST';
        }

        // Determine owner
        let owner = null;
        if (type !== 'WATER' && type !== 'MOUNTAIN' && type !== 'MONUMENT') {
          // Blue territory on left
          if (x < centerX - 1) {
            owner = 0;
          }
          // Orange territory on right
          else if (x > centerX + 1) {
            owner = 1;
          }
        }

        tiles.push({ x, y, type, owner });
      }
    }

    return tiles;
  },
};

/**
 * Replay controls for turn history navigation
 */
const Replay = {
  // Replay state
  history: [], // Array of game states for each turn
  currentIndex: 0, // Current position in history
  isPlaying: false, // Auto-play state
  playInterval: null, // Auto-play interval
  speed: 1, // Playback speed multiplier

  /**
   * Initialize replay with game state history
   */
  init(history) {
    this.history = history || [];
    this.currentIndex = this.history.length - 1;
    this.updateUI();
  },

  /**
   * Add a new state to history (called when new turn arrives)
   */
  addState(state) {
    this.history.push(JSON.parse(JSON.stringify(state)));

    // If we're at the end, stay at the end
    if (this.currentIndex === this.history.length - 2) {
      this.currentIndex = this.history.length - 1;
    }

    this.updateUI();
  },

  /**
   * Go to specific turn
   */
  seekTo(index) {
    index = parseInt(index);
    if (index >= 0 && index < this.history.length) {
      this.currentIndex = index;
      this.showState(this.history[index]);
      this.updateUI();
    }
  },

  /**
   * Go to start (turn 0)
   */
  goToStart() {
    this.pause();
    this.seekTo(0);
  },

  /**
   * Go to end (latest turn)
   */
  goToEnd() {
    this.pause();
    this.seekTo(this.history.length - 1);
  },

  /**
   * Go to previous turn
   */
  prevTurn() {
    this.pause();
    if (this.currentIndex > 0) {
      this.seekTo(this.currentIndex - 1);
    }
  },

  /**
   * Go to next turn
   */
  nextTurn() {
    if (this.currentIndex < this.history.length - 1) {
      this.seekTo(this.currentIndex + 1);
    } else {
      this.pause();
    }
  },

  /**
   * Toggle play/pause
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  },

  /**
   * Start auto-play
   */
  play() {
    if (this.currentIndex >= this.history.length - 1) {
      // If at end, restart from beginning
      this.currentIndex = 0;
    }

    this.isPlaying = true;
    this.updatePlayButton();

    const interval = 1000 / this.speed;
    this.playInterval = setInterval(() => {
      this.nextTurn();
    }, interval);
  },

  /**
   * Pause auto-play
   */
  pause() {
    this.isPlaying = false;
    this.updatePlayButton();

    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  },

  /**
   * Set playback speed
   */
  setSpeed(speed) {
    this.speed = parseFloat(speed);
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  },

  /**
   * Show a specific state in the renderer
   */
  showState(state) {
    if (state) {
      Renderer.setGameState(state);
      App.updateUI();
    }
  },

  /**
   * Update UI elements
   */
  updateUI() {
    const slider = document.getElementById('replay-slider');
    const currentLabel = document.getElementById('replay-turn-current');
    const maxLabel = document.getElementById('replay-turn-max');
    const statusDot = document.getElementById('game-status-dot');
    const statusText = document.getElementById('game-status-text');

    if (slider) {
      slider.max = Math.max(0, this.history.length - 1);
      slider.value = this.currentIndex;
    }

    if (currentLabel) {
      currentLabel.textContent = this.currentIndex;
    }

    if (maxLabel) {
      maxLabel.textContent = this.history.length - 1;
    }

    // Update game status
    const isLive = this.currentIndex === this.history.length - 1;
    const latestState = this.history[this.history.length - 1];
    const isGameOver = latestState && latestState.gameOver;

    if (statusDot) {
      statusDot.classList.remove('live', 'ended', 'paused');
      if (isGameOver) {
        statusDot.classList.add('ended');
      } else if (isLive) {
        statusDot.classList.add('live');
      } else {
        statusDot.classList.add('paused');
      }
    }

    if (statusText) {
      if (isGameOver) {
        statusText.textContent = 'Ended';
      } else if (isLive) {
        statusText.textContent = 'Live';
      } else {
        statusText.textContent = 'Viewing';
      }
    }
  },

  /**
   * Update play button icon
   */
  updatePlayButton() {
    const icon = document.getElementById('replay-play-icon');
    if (icon && typeof lucide !== 'undefined') {
      icon.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
      lucide.createIcons();
    }
  },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Initialize replay with empty history (will be populated when states arrive)
  Replay.init([]);

  // For demo, add the mock state to replay history
  if (App.gameState) {
    Replay.addState(App.gameState);
  }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { App, Replay };
}
