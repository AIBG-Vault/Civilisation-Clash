// Game Manager - Owns game state and handles turn processing

const { createInitialState, processTurn, validateAction, MODES } = require('../logic');

const GAME_STATES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

const DEFAULT_SETTINGS = {
  mode: MODES.BLITZ,
  turnTimeout: 2000,
  clientOverride: false,
};

class GameManager {
  constructor(connectionManager, options = {}) {
    this.connectionManager = connectionManager;
    this.settings = { ...DEFAULT_SETTINGS, ...options };
    this.state = null;
    this.gameState = GAME_STATES.WAITING;
    this.turnTimer = null;
    this.pendingActions = new Map();
    this.turnHistory = [];
    this.onGameEvent = null;
  }

  setEventCallback(callback) {
    this.onGameEvent = callback;
  }

  emit(event, data) {
    if (this.onGameEvent) {
      this.onGameEvent(event, data);
    }
  }

  updateSettings(settings, fromClient = false) {
    if (fromClient && !this.settings.clientOverride) {
      return { success: false, reason: 'Client override not enabled' };
    }

    const oldMode = this.settings.mode;
    const allowedKeys = ['mode', 'turnTimeout'];
    for (const key of allowedKeys) {
      if (settings[key] !== undefined) {
        this.settings[key] = settings[key];
      }
    }

    // If mode changed during a game, restart with new map
    if (this.gameState === GAME_STATES.PLAYING && settings.mode && settings.mode !== oldMode) {
      console.log(`[GameManager] Mode changed from ${oldMode} to ${settings.mode}, restarting game...`);
      this.emit('settings_changed', this.settings);
      this.restartGame();
      return { success: true, settings: this.settings, restarted: true };
    }

    this.emit('settings_changed', this.settings);
    return { success: true, settings: this.settings };
  }

  /**
   * Restart the game with current settings (keeps players connected)
   */
  restartGame() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.state = null;
    this.gameState = GAME_STATES.WAITING;
    this.pendingActions.clear();
    this.turnHistory = [];

    this.emit('game_reset', {});

    // Auto-start if both teams still connected
    if (this.connectionManager.bothTeamsConnected()) {
      this.startGame();
    }
  }

  checkAndStartGame() {
    console.log(`[GameManager] checkAndStartGame - state: ${this.gameState}, bothTeams: ${this.connectionManager.bothTeamsConnected()}`);
    if (this.gameState !== GAME_STATES.WAITING) return false;
    if (!this.connectionManager.bothTeamsConnected()) return false;

    console.log('[GameManager] Starting game...');
    this.startGame();
    return true;
  }

  startGame() {
    console.log(`[GameManager] Starting game with mode: ${this.settings.mode}`);
    this.state = createInitialState({ mode: this.settings.mode });
    console.log(`[GameManager] Map size: ${this.state.map.width}x${this.state.map.height}, maxTurns: ${this.state.maxTurns}`);
    this.gameState = GAME_STATES.PLAYING;
    this.pendingActions.clear();
    this.turnHistory = [];

    this.emit('game_started', {
      mode: this.settings.mode,
      turnTimeout: this.settings.turnTimeout,
    });

    this.startTurn();
  }

  startTurn() {
    if (this.gameState !== GAME_STATES.PLAYING) return;

    this.pendingActions.clear();

    this.emit('turn_started', {
      turn: this.state.turn,
      timeout: this.settings.turnTimeout,
      state: this.getClientState(),
    });

    if (this.settings.turnTimeout) {
      this.turnTimer = setTimeout(() => {
        this.onTurnTimeout();
      }, this.settings.turnTimeout);
    }
  }

  onTurnTimeout() {
    this.processPendingActions();
  }

  submitActions(teamId, actions) {
    if (this.gameState !== GAME_STATES.PLAYING) {
      return { success: false, reason: 'Game not in progress' };
    }

    if (teamId !== 0 && teamId !== 1) {
      return { success: false, reason: 'Invalid team ID' };
    }

    if (this.pendingActions.has(teamId)) {
      return { success: false, reason: 'Actions already submitted for this turn' };
    }

    const validation = actions.map((action) => validateAction(this.state, teamId, action));
    const validActions = actions.filter((_, i) => validation[i].valid);
    this.pendingActions.set(teamId, validActions);

    this.emit('actions_submitted', {
      teamId,
      validCount: validActions.length,
      totalCount: actions.length,
      validation,
    });

    if (this.pendingActions.has(0) && this.pendingActions.has(1)) {
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      this.processPendingActions();
    }

    return {
      success: true,
      validCount: validActions.length,
      totalCount: actions.length,
      validation,
    };
  }

  processPendingActions() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    const actions = {
      player0: this.pendingActions.get(0) || [],
      player1: this.pendingActions.get(1) || [],
    };

    const turnNumber = this.state.turn;
    const result = processTurn(this.state, actions);
    this.state = result.newState;

    this.turnHistory.push({
      turn: turnNumber,
      actions,
      events: result.info.turnEvents,
    });

    this.emit('turn_processed', {
      turn: turnNumber,
      events: result.info.turnEvents,
      state: this.getClientState(),
    });

    if (this.state.gameOver) {
      this.endGame();
    } else {
      this.startTurn();
    }
  }

  endGame() {
    this.gameState = GAME_STATES.FINISHED;

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.emit('game_ended', {
      winner: this.state.winner,
      reason: this.state.winReason,
      finalState: this.getClientState(),
      history: this.turnHistory,
    });

    // Auto-restart after a short delay if both teams still connected
    setTimeout(() => {
      if (this.connectionManager.bothTeamsConnected()) {
        console.log('[GameManager] Auto-restarting game...');
        this.reset();
        this.checkAndStartGame();
      }
    }, 3000);
  }

  getClientState() {
    if (!this.state) return null;

    return {
      turn: this.state.turn,
      maxTurns: this.state.maxTurns,
      gameOver: this.state.gameOver,
      winner: this.state.winner,
      winReason: this.state.winReason,
      players: this.state.players.map((p) => {
        // Get player name from connection manager
        const playerConn = this.connectionManager.getPlayerByTeam(p.id);
        return {
          id: p.id,
          gold: p.gold,
          income: p.income,
          score: p.score,
          name: playerConn?.name || `Player ${p.id + 1}`,
        };
      }),
      map: {
        width: this.state.map.width,
        height: this.state.map.height,
        tiles: this.state.map.tiles,
      },
      units: this.state.units,
      cities: this.state.cities,
      monument: this.state.monument,
    };
  }

  getStatus() {
    return {
      gameState: this.gameState,
      settings: this.settings,
      currentTurn: this.state?.turn ?? null,
      players: this.connectionManager.getConnectedClients(),
      pendingSubmissions: {
        team0: this.pendingActions.has(0),
        team1: this.pendingActions.has(1),
      },
    };
  }

  reset() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.state = null;
    this.gameState = GAME_STATES.WAITING;
    this.pendingActions.clear();
    this.turnHistory = [];

    this.emit('game_reset', {});
  }
}

module.exports = { GameManager, GAME_STATES, DEFAULT_SETTINGS };
