// Civilization Clash - WebSocket Game Server

const { WebSocketServer } = require('ws');
const { ConnectionManager } = require('./connections');
const { GameManager } = require('./game-manager');

const PORT = process.env.PORT || 8080;

const CLIENT_MESSAGES = {
  AUTH: 'AUTH',
  GET_STATE: 'GET_STATE',
  GET_STATUS: 'GET_STATUS',
  SUBMIT_ACTIONS: 'SUBMIT_ACTIONS',
  GAME_CONTROL: 'GAME_CONTROL',
};

const SERVER_MESSAGES = {
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILED: 'AUTH_FAILED',
  GAME_STATE: 'GAME_STATE',
  SERVER_STATUS: 'SERVER_STATUS',
  GAME_STARTED: 'GAME_STARTED',
  TURN_START: 'TURN_START',
  ACTIONS_RECEIVED: 'ACTIONS_RECEIVED',
  TURN_RESULT: 'TURN_RESULT',
  GAME_OVER: 'GAME_OVER',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  ERROR: 'ERROR',
};

function createServer(options = {}) {
  const { port = PORT, clientOverride = false, turnTimeout = 2000 } = options;

  const wss = new WebSocketServer({ port });
  const connectionManager = new ConnectionManager();
  const gameManager = new GameManager(connectionManager, { clientOverride, turnTimeout });

  gameManager.setEventCallback((event, data) => {
    handleGameEvent(connectionManager, event, data);
  });

  console.log(`Civilization Clash server starting on port ${port}...`);

  wss.on('connection', (ws) => {
    console.log('New connection');
    connectionManager.addConnection(ws);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message, connectionManager, gameManager);
      } catch (err) {
        connectionManager.send(ws, { type: SERVER_MESSAGES.ERROR, error: 'Invalid JSON message' });
      }
    });

    ws.on('close', () => {
      const info = connectionManager.getConnectionInfo(ws);
      const wasPlayer = info?.authenticated && !info?.isSpectator;
      const teamId = info?.teamId;
      const name = info?.name;

      connectionManager.removeConnection(ws);

      if (wasPlayer) {
        console.log(`Player ${name} (team ${teamId}) disconnected`);
        connectionManager.broadcast({ type: SERVER_MESSAGES.PLAYER_LEFT, team: teamId, name });
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });
  });

  wss.on('listening', () => {
    console.log(`Server listening on port ${port}`);
  });

  return { wss, connectionManager, gameManager };
}

function handleMessage(ws, message, connectionManager, gameManager) {
  const { type } = message;
  const info = connectionManager.getConnectionInfo(ws);

  if (type === CLIENT_MESSAGES.AUTH) {
    handleAuth(ws, message, connectionManager, gameManager);
    return;
  }

  if (!info?.authenticated) {
    connectionManager.send(ws, { type: SERVER_MESSAGES.ERROR, error: 'Not authenticated' });
    return;
  }

  switch (type) {
    case CLIENT_MESSAGES.GET_STATE:
      handleGetState(ws, connectionManager, gameManager);
      break;
    case CLIENT_MESSAGES.GET_STATUS:
      handleGetStatus(ws, connectionManager, gameManager);
      break;
    case CLIENT_MESSAGES.SUBMIT_ACTIONS:
      handleSubmitActions(ws, message, info, connectionManager, gameManager);
      break;
    case CLIENT_MESSAGES.GAME_CONTROL:
      handleGameControl(ws, message, info, connectionManager, gameManager);
      break;
    default:
      connectionManager.send(ws, { type: SERVER_MESSAGES.ERROR, error: `Unknown message type: ${type}` });
  }
}

function handleAuth(ws, message, connectionManager, gameManager) {
  const result = connectionManager.authenticate(ws, message);

  if (!result.success) {
    connectionManager.send(ws, { type: SERVER_MESSAGES.AUTH_FAILED, reason: result.reason });
    ws.close();
    return;
  }

  console.log(`Authenticated: ${result.assignedName} as ${result.isSpectator ? 'spectator' : `team ${result.teamId}`}`);

  connectionManager.send(ws, {
    type: SERVER_MESSAGES.AUTH_SUCCESS,
    teamId: result.teamId,
    name: result.assignedName,
    isSpectator: result.isSpectator,
  });

  if (!result.isSpectator) {
    connectionManager.broadcast({ type: SERVER_MESSAGES.PLAYER_JOINED, team: result.teamId, name: result.assignedName });
  }

  gameManager.checkAndStartGame();
}

function handleGetState(ws, connectionManager, gameManager) {
  connectionManager.send(ws, {
    type: SERVER_MESSAGES.GAME_STATE,
    state: gameManager.getClientState(),
    gameState: gameManager.gameState,
  });
}

function handleGetStatus(ws, connectionManager, gameManager) {
  connectionManager.send(ws, { type: SERVER_MESSAGES.SERVER_STATUS, ...gameManager.getStatus() });
}

function handleSubmitActions(ws, message, info, connectionManager, gameManager) {
  if (info.isSpectator) {
    connectionManager.send(ws, { type: SERVER_MESSAGES.ERROR, error: 'Spectators cannot submit actions' });
    return;
  }

  const { actions } = message;
  if (!Array.isArray(actions)) {
    connectionManager.send(ws, { type: SERVER_MESSAGES.ERROR, error: 'Actions must be an array' });
    return;
  }

  const result = gameManager.submitActions(info.teamId, actions);
  connectionManager.send(ws, { type: SERVER_MESSAGES.ACTIONS_RECEIVED, ...result });
}

function handleGameControl(ws, message, info, connectionManager, gameManager) {
  const { command, settings } = message;

  switch (command) {
    case 'update_settings':
      connectionManager.send(ws, { type: 'SETTINGS_UPDATED', ...gameManager.updateSettings(settings, true) });
      break;
    case 'reset':
      gameManager.reset();
      connectionManager.send(ws, { type: 'GAME_RESET', success: true });
      break;
    default:
      connectionManager.send(ws, { type: SERVER_MESSAGES.ERROR, error: `Unknown command: ${command}` });
  }
}

function handleGameEvent(connectionManager, event, data) {
  switch (event) {
    case 'game_started':
      connectionManager.broadcast({ type: SERVER_MESSAGES.GAME_STARTED, ...data });
      break;
    case 'turn_started':
      connectionManager.broadcast({ type: SERVER_MESSAGES.TURN_START, ...data });
      break;
    case 'turn_processed':
      connectionManager.broadcast({ type: SERVER_MESSAGES.TURN_RESULT, ...data });
      break;
    case 'game_ended':
      connectionManager.broadcast({ type: SERVER_MESSAGES.GAME_OVER, ...data });
      break;
    case 'settings_changed':
      connectionManager.broadcast({ type: 'SETTINGS_CHANGED', settings: data });
      break;
    case 'game_reset':
      connectionManager.broadcast({ type: 'GAME_RESET' });
      break;
  }
}

// Start server if run directly
if (require.main === module) {
  const clientOverride = process.argv.includes('--client-override');
  createServer({ clientOverride });
}

module.exports = { createServer, CLIENT_MESSAGES, SERVER_MESSAGES };
