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
    this.turnTimeout = 30000; // 30 seconds for manual play
    this.timeoutEnabled = true;
    this.heartbeatInterval = null;

    this.initServer();
  }

  initServer() {
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`Game server V2 running on ws://localhost:${this.port}`);
    console.log('Mode: 30 second timeout for manual play.');
    console.log('Send ADMIN_COMMAND with action: "DISABLE_TIMEOUT" to disable timeout.');

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  handleConnection(ws) {
    const connectionId = this.generateId();
    const teamId = this.connections.size;

    if (teamId >= 2) {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: 'Game full',
        })
      );
      ws.close();
      return;
    }

    const connection = {
      id: connectionId,
      ws: ws,
      teamId: teamId,
      isAlive: true,
    };

    this.connections.set(connectionId, connection);

    // Send auth success
    ws.send(
      JSON.stringify({
        type: 'AUTH_SUCCESS',
        teamId: teamId,
      })
    );

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
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            message: 'Invalid message format',
          })
        );
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
    console.log('Starting new game V2 with terrain and economy');
    this.game = new GameV2('blitz'); // 15x10 map, 50 turns
    this.game.initialize();
    this.broadcastGameState();
    this.startHeartbeat();

    console.log(`Map generated: ${this.game.mapWidth}x${this.game.mapHeight}`);
    const fields = this.game.map.filter((t) => t.type === 'FIELD').length;
    const mountains = this.game.map.filter((t) => t.type === 'MOUNTAIN').length;
    const water = this.game.map.filter((t) => t.type === 'WATER').length;
    console.log(`Terrain: ${fields} fields, ${mountains} mountains, ${water} water`);
  }

  handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    switch (message.type) {
      case 'SUBMIT_ACTIONS':
        this.handleActions(connection.teamId, message.actions);
        break;

      case 'ADMIN_COMMAND':
        this.handleAdminCommand(message);
        break;

      case 'PING':
        connection.ws.send(JSON.stringify({ type: 'PONG' }));
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  handleAdminCommand(command) {
    // Handle admin commands (would need auth in production)
    switch (command.action) {
      case 'DISABLE_TIMEOUT':
        this.timeoutEnabled = false;
        console.log('Timeout disabled for manual play');
        this.broadcast({
          type: 'ADMIN_MESSAGE',
          message: 'Timeout disabled - manual play mode',
        });
        break;

      case 'ENABLE_TIMEOUT':
        this.timeoutEnabled = true;
        this.turnTimeout = command.timeout || 250;
        console.log(`Timeout enabled: ${this.turnTimeout}ms`);
        break;

      case 'RESET_GAME':
        console.log('Admin requested game reset');
        this.reset();
        break;
    }
  }

  handleActions(teamId, actions) {
    if (!this.game) return;

    console.log(`Team ${teamId} submitted ${actions?.length || 0} actions`);
    this.pendingActions.set(teamId, actions || []);

    // Clear existing timer
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    // Process turn IMMEDIATELY if both submitted (no delay)
    if (this.pendingActions.size === 2) {
      // Process synchronously for maximum speed
      this.processTurn();
    } else if (this.timeoutEnabled) {
      // Set timeout for missing player (only if enabled)
      this.turnTimer = setTimeout(() => {
        console.log('Turn timeout reached');
        this.processTurn();
      }, this.turnTimeout);
    } else {
      // No timeout - wait for other player
      console.log('Waiting for other player (timeout disabled)');
    }
  }

  processTurn() {
    if (!this.game) return;

    const team0Actions = this.pendingActions.get(0) || [];
    const team1Actions = this.pendingActions.get(1) || [];

    console.log(`Processing turn ${this.game.turn + 1}`);

    // Process the turn
    const turnResult = this.game.processActions(team0Actions, team1Actions);

    // Log any errors
    if (turnResult.errors && turnResult.errors.length > 0) {
      turnResult.errors.forEach((err) => {
        console.log(`Action error [Team ${err.teamId}]: ${err.reason}`);
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
        connection.ws.send(
          JSON.stringify({
            type: 'GAME_STATE',
            yourTeamId: connection.teamId,
            state: state,
          })
        );
      }
    });
  }

  broadcast(message) {
    this.connections.forEach((connection) => {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }

  handleGameOver() {
    const winner = this.game.getWinner();
    const scores = this.game.getScores();

    console.log(`Game over! Winner: ${winner === null ? 'TIE' : `Team ${winner}`}`);
    console.log('Final scores:', scores);

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(
          JSON.stringify({
            type: 'GAME_OVER',
            winner: winner,
            scores: scores,
            reason: this.game.turn >= this.game.maxTurns ? 'TURN_LIMIT' : 'ELIMINATION',
          })
        );
      }
    });

    // Reset after delay
    setTimeout(() => this.reset(), 5000);
  }

  handleDisconnect(connectionId) {
    this.connections.delete(connectionId);

    if (this.game && this.connections.size === 0) {
      console.log('All players disconnected, resetting game');
      this.reset();
    } else if (this.game) {
      console.log('Player disconnected during game, waiting for reconnection...');
      // In production, might want to pause or end game
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

    // Reset to default timeout
    this.timeoutEnabled = true;
    this.turnTimeout = 250;
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

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.reset();
  process.exit(0);
});