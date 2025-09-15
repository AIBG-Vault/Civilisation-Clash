import { WebSocketServer } from 'ws';
import { Game } from '../logic/game.js';

const PORT = 8080;
const TURN_TIMEOUT = 250; // milliseconds

const wss = new WebSocketServer({ port: PORT });
console.log(`Server running on ws://localhost:${PORT}`);

let game = null;
let connections = [];
let pendingActions = new Map();
let timeoutId = null;

wss.on('connection', (ws) => {
  // Assign team based on connection order
  const teamId = connections.length;

  if (teamId >= 2) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Game full' }));
    ws.close();
    return;
  }

  connections.push({ ws, teamId });
  console.log(`Team ${teamId} connected`);

  // Send initial assignment
  ws.send(JSON.stringify({
    type: 'AUTH_SUCCESS',
    teamId: teamId
  }));

  // Start game when both connected
  if (connections.length === 2) {
    startGame();
  }

  // Handle messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(teamId, message);
    } catch (err) {
      console.error('Invalid message:', err);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log(`Team ${teamId} disconnected`);
    resetServer();
  });

  ws.on('error', (error) => {
    console.error(`Team ${teamId} error:`, error);
  });
});

function startGame() {
  game = new Game();
  console.log('Game started!');
  broadcastState();
}

function handleMessage(teamId, message) {
  if (!game) {
    console.log('No game active, ignoring message');
    return;
  }

  if (message.type === 'SUBMIT_ACTIONS') {
    console.log(`Team ${teamId} submitted actions`);
    pendingActions.set(teamId, message.actions || []);

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Check if both submitted
    if (pendingActions.size === 2) {
      processTurn();
    } else {
      // Set timeout for missing player
      timeoutId = setTimeout(() => {
        console.log('Timeout reached, processing turn');
        processTurn();
      }, TURN_TIMEOUT);
    }
  }
}

function processTurn() {
  if (!game) return;

  const team0Actions = pendingActions.get(0) || [];
  const team1Actions = pendingActions.get(1) || [];

  console.log(`Processing turn ${game.turn + 1}`);

  // Process the turn
  game.processActions(team0Actions, team1Actions);

  // Clear pending actions
  pendingActions.clear();
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  // Broadcast new state
  broadcastState();

  // Check if game over
  if (game.isOver()) {
    const winner = game.getWinner();
    console.log(`Game over! Winner: ${winner === null ? 'TIE' : `Team ${winner}`}`);

    // Send game over message
    connections.forEach(({ ws, teamId }) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'GAME_OVER',
          winner: winner,
          reason: game.turn >= game.maxTurns ? 'TURN_LIMIT' : 'ELIMINATION'
        }));
      }
    });

    // Reset after 5 seconds
    setTimeout(resetServer, 5000);
  }
}

function broadcastState() {
  const state = game.getState();

  connections.forEach(({ ws, teamId }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'GAME_STATE',
        yourTeamId: teamId,
        state: state
      }));
    }
  });
}

function resetServer() {
  game = null;
  connections = [];
  pendingActions.clear();
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  console.log('Server reset, waiting for players...');
}