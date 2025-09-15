import { WebSocketServer } from 'ws';
import { GameV2 } from '../logic/game-v2.js';
import fs from 'fs';

// Load passwords
let passwords = { teams: {}, admin: 'admin123', spectator: 'spectator' };
try {
  passwords = JSON.parse(fs.readFileSync('./passwords.json', 'utf-8'));
} catch (err) {
  console.log('No passwords.json found, using defaults');
}

class GameServer {
  constructor(port = 8080) {
    this.port = port;
    this.wss = null;
    this.game = null;
    this.connections = new Map();
    this.pendingActions = new Map();
    this.turnTimer = null;
    this.turnTimeout = 30000; // 30s default for manual play
    this.timeoutEnabled = true;
    this.heartbeatInterval = null;

    this.initServer();
  }

  initServer() {
    this.wss = new WebSocketServer({ port: this.port });
    console.log(`Game server V2 running on ws://localhost:${this.port}`);
    console.log('Mode: 30s timeout (manual play)');
    console.log('Admin commands:');
    console.log('  - ENABLE_BOT_TIMEOUT: Switch to 250ms timeout for fast bot play');
    console.log('  - DISABLE_TIMEOUT: Disable timeout completely');

    // Initialize game immediately so map is ready for all connections
    this.initializeGame();

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  initializeGame() {
    console.log('Initializing game V2 with terrain and economy');
    this.game = new GameV2('blitz'); // 15x10 map, 50 turns
    this.game.initialize();

    console.log(`Map generated: ${this.game.mapWidth}x${this.game.mapHeight}`);
    const fields = this.game.map.filter((t) => t.type === 'FIELD').length;
    const mountains = this.game.map.filter((t) => t.type === 'MOUNTAIN').length;
    const water = this.game.map.filter((t) => t.type === 'WATER').length;
    console.log(`Terrain: ${fields} fields, ${mountains} mountains, ${water} water`);
  }

  handleConnection(ws) {
    const connectionId = this.generateId();

    // Wait for AUTH message
    let authTimeout = setTimeout(() => {
      console.log(`Connection ${connectionId} failed to authenticate`);
      ws.close();
    }, 5000); // 5 second timeout for auth

    ws.once('message', (data) => {
      clearTimeout(authTimeout);
      try {
        const authMsg = JSON.parse(data);
        if (authMsg.type !== 'AUTH') {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'First message must be AUTH' }));
          ws.close();
          return;
        }

        this.handleAuth(connectionId, ws, authMsg);
      } catch (err) {
        console.error('Invalid auth message:', err);
        ws.close();
      }
    });
  }

  handleAuth(connectionId, ws, authMsg) {
    const { password, name = 'Unknown', teamId } = authMsg;

    // Check password type
    let role = null;
    let assignedTeamId = -1;

    if (password === passwords.admin) {
      role = 'admin';
    } else if (password === passwords.spectator) {
      role = 'spectator';
    } else if (password === passwords.teams.team0 || password === passwords.teams.team1) {
      role = 'player';
      // Get team ID from password
      assignedTeamId = password === passwords.teams.team0 ? 0 : 1;
    } else {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid password' }));
      ws.close();
      return;
    }

    const connection = {
      id: connectionId,
      ws: ws,
      teamId: assignedTeamId,
      role: role,
      name: name,
      isAlive: true,
    };

    this.connections.set(connectionId, connection);

    // Send auth success
    ws.send(
      JSON.stringify({
        type: 'AUTH_SUCCESS',
        teamId: assignedTeamId,
        role: role,
      })
    );

    console.log(`${role} '${name}' connected as ${assignedTeamId >= 0 ? `Team ${assignedTeamId}` : role}`);

    // Send current game state
    if (this.game) {
      const state = this.game.getState();
      ws.send(
        JSON.stringify({
          type: 'GAME_STATE',
          yourTeamId: assignedTeamId,
          state: state,
        })
      );
    }

    // Start heartbeat when we have players
    const playerCount = Array.from(this.connections.values()).filter(c => c.role === 'player').length;
    if (playerCount >= 2 && !this.heartbeatInterval) {
      this.startHeartbeat();
    }

    // Setup message handlers
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


  handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    switch (message.type) {
      case 'SUBMIT_ACTIONS':
        // Only players can submit actions
        if (connection.role === 'player') {
          this.handleActions(connection.teamId, message.actions);
        }
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

      case 'ENABLE_BOT_TIMEOUT':
        this.timeoutEnabled = true;
        this.turnTimeout = 250; // 250ms for fast bot play
        console.log('Bot timeout enabled: 250ms');
        this.broadcast({
          type: 'ADMIN_MESSAGE',
          message: 'Bot timeout enabled - 250ms per turn',
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

    // Process turn IMMEDIATELY if both submitted (no delay - instant processing)
    // This means bot games can run as fast as the bots can submit actions
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
    this.connections.clear();
    this.pendingActions.clear();

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    this.stopHeartbeat();

    // Reset to default timeout
    this.timeoutEnabled = true;
    this.turnTimeout = 30000; // Back to manual play timeout

    // Reinitialize game for next players
    this.initializeGame();
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