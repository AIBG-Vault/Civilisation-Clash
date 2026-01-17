import { WebSocketServer } from 'ws';
import { GameV2 } from '../logic/game-v2.js';
import fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const hasDisableFlag = args.includes('--disable-client-override');
const hasEnableFlag = args.includes('--enable-client-override');

// Server configuration
const SERVER_CONFIG = {
  // Default to true unless explicitly disabled
  clientCanOverrideOptions: hasDisableFlag ? false : (hasEnableFlag ? true : true),
};

// Load passwords
let passwords = { teams: {} };
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
    console.log('='.repeat(60));
    console.log(`Game server V2 running on ws://localhost:${this.port}`);
    console.log('Mode: 30s timeout (manual play)');
    console.log(`Client override options: ${SERVER_CONFIG.clientCanOverrideOptions ? 'ENABLED' : 'DISABLED'}`);
    console.log('');
    console.log('To disable client overrides, start with:');
    console.log('  node server-v2.js --disable-client-override');
    console.log('='.repeat(60));
    if (SERVER_CONFIG.clientCanOverrideOptions) {
      console.log('Game control commands available from clients:');
      console.log('  - ENABLE_BOT_TIMEOUT: Switch to 250ms timeout for fast bot play');
      console.log('  - DISABLE_TIMEOUT: Disable timeout completely');
      console.log('  - RESET_GAME: Reset the game state');
    }

    // Initialize game immediately so map is ready for all connections
    this.initializeGame();

    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  initializeGame() {
    console.log('Initializing game V2 with terrain and economy');
    this.game = new GameV2('blitz'); // 15x10 map, 50 turns
    //this.game = new GameV2('normal'); // 15x10 map, 50 turns
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

    // Check password and assign team
    let assignedTeamId = -1;
    let isSpectator = false;

    if (password === passwords.teams.team0) {
      assignedTeamId = 0;
    } else if (password === passwords.teams.team1) {
      assignedTeamId = 1;
    } else if (password === passwords.spectator) {
      assignedTeamId = -1;
      isSpectator = true;
    } else {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid password' }));
      ws.close();
      return;
    }

    const connection = {
      id: connectionId,
      ws: ws,
      teamId: assignedTeamId,
      name: name,
      isAlive: true,
      isSpectator: isSpectator,
    };

    this.connections.set(connectionId, connection);

    // Send auth success
    ws.send(
      JSON.stringify({
        type: 'AUTH_SUCCESS',
        teamId: assignedTeamId,
        isSpectator: isSpectator,
      })
    );

    if (isSpectator) {
      console.log(`Spectator '${name}' connected`);
    } else {
      console.log(`Player '${name}' connected as Team ${assignedTeamId}`);
    }

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
    const playerCount = this.connections.size;
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
        // Spectators cannot submit actions
        if (connection.isSpectator) {
          connection.ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Spectators cannot submit actions'
          }));
          return;
        }
        this.handleActions(connection.teamId, message.actions);
        break;

      case 'ADMIN_COMMAND':
      case 'GAME_CONTROL':
        // Check if client overrides are enabled
        if (SERVER_CONFIG.clientCanOverrideOptions) {
          this.handleGameControl(message);
        } else {
          connection.ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Game control commands are disabled on this server'
          }));
        }
        break;

      case 'PING':
        connection.ws.send(JSON.stringify({ type: 'PONG' }));
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  handleGameControl(command) {
    // Handle game control commands (when client overrides are enabled)
    switch (command.action) {
      case 'DISABLE_TIMEOUT':
        this.timeoutEnabled = false;
        console.log('Timeout disabled for manual play');
        this.broadcast({
          type: 'GAME_CONTROL_MESSAGE',
          message: 'Timeout disabled - manual play mode',
        });
        break;

      case 'ENABLE_BOT_TIMEOUT':
        this.timeoutEnabled = true;
        this.turnTimeout = 250; // 250ms for fast bot play
        console.log('Bot timeout enabled: 250ms');
        this.broadcast({
          type: 'GAME_CONTROL_MESSAGE',
          message: 'Bot timeout enabled - 250ms per turn',
        });
        break;

      case 'ENABLE_TIMEOUT':
        this.timeoutEnabled = true;
        this.turnTimeout = command.timeout || 250;
        console.log(`Timeout enabled: ${this.turnTimeout}ms`);
        break;

      case 'RESET_GAME':
        console.log('Game reset requested');
        this.reset();
        // State will be broadcast by reset() itself
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

    // Get active player count (exclude spectators who have teamId -1)
    const activePlayers = Array.from(this.connections.values()).filter(
      c => c.teamId >= 0 && !c.isSpectator
    );

    // Get unique teams that have players
    const activeTeams = new Set(activePlayers.map(p => p.teamId));

    // Process turn IMMEDIATELY if both teams have submitted
    // Require both team 0 and team 1 to be connected before processing
    const bothTeamsConnected = activeTeams.has(0) && activeTeams.has(1);
    if (bothTeamsConnected && this.pendingActions.size === 2) {
      // Process synchronously for maximum speed
      this.processTurn();
    } else if (bothTeamsConnected && this.timeoutEnabled) {
      // Set timeout for missing player (only if both teams connected and timeout enabled)
      this.turnTimer = setTimeout(() => {
        console.log('Turn timeout reached');
        this.processTurn();
      }, this.turnTimeout);
    } else if (!bothTeamsConnected) {
      // Wait for both teams to connect
      console.log(`Waiting for both teams to connect (Team 0: ${activeTeams.has(0) ? 'connected' : 'waiting'}, Team 1: ${activeTeams.has(1) ? 'connected' : 'waiting'})`);
    } else {
      // No timeout - wait for other players
      console.log(`Waiting for other players (${this.pendingActions.size}/2 teams submitted)`);
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

    // Reset after delay and notify clients
    setTimeout(() => {
      this.reset();
      // Broadcast new game state to all connected clients
      this.broadcastGameState();
    }, 5000);
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

    // Don't clear connections - keep clients connected
    // Just clear pending actions
    this.pendingActions.clear();

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    // Don't stop heartbeat if clients are still connected
    if (this.connections.size === 0) {
      this.stopHeartbeat();
    }

    // Reset to default timeout
    this.timeoutEnabled = true;
    this.turnTimeout = 30000; // Back to manual play timeout

    // Reinitialize game for next players
    this.initializeGame();

    // Broadcast new game state to all connected clients
    if (this.connections.size > 0) {
      console.log('Broadcasting new game state to', this.connections.size, 'connected clients');
      this.broadcastGameState();
    }
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
const port = process.env.PORT || 8080;
const server = new GameServer(port);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.reset();
  process.exit(0);
});