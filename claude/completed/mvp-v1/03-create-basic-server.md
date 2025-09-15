# Task 03: Create Basic WebSocket Server (MVP)

## Objective
Wrap the game logic in a minimal WebSocket server that allows two clients to connect and play.

## Prerequisites
- Task 02 completed (basic game.js exists and works)

## What to Build

### Minimal Server Features
- Accept WebSocket connections
- Start game when 2 players connect
- Receive actions from players
- Process turn when both submit (or timeout)
- Broadcast game state to all
- Handle disconnections

### What We Skip
- No authentication (first = team 0, second = team 1)
- No admin commands
- No spectator mode
- No PASS action
- No configurable timeout

## Files to Create

### `server/server.js`
```javascript
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
    ws.send(JSON.stringify({type: 'ERROR', message: 'Game full'}));
    ws.close();
    return;
  }

  connections.push({ws, teamId});
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
    handleMessage(teamId, JSON.parse(data));
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log(`Team ${teamId} disconnected`);
    resetServer();
  });
});

function startGame() {
  game = new Game();
  console.log('Game started!');
  broadcastState();
}

function handleMessage(teamId, message) {
  if (!game) return;

  if (message.type === 'SUBMIT_ACTIONS') {
    pendingActions.set(teamId, message.actions || []);

    // Clear existing timeout
    if (timeoutId) clearTimeout(timeoutId);

    // Check if both submitted
    if (pendingActions.size === 2) {
      processTurn();
    } else {
      // Set timeout for missing player
      timeoutId = setTimeout(processTurn, TURN_TIMEOUT);
    }
  }
}

function processTurn() {
  if (!game) return;

  const team0Actions = pendingActions.get(0) || [];
  const team1Actions = pendingActions.get(1) || [];

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
    console.log(`Game over! Winner: ${game.getWinner()}`);
    setTimeout(resetServer, 5000); // Reset after 5 seconds
  }
}

function broadcastState() {
  const state = game.getState();

  connections.forEach(({ws, teamId}) => {
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
```

### `server/package.json`
```json
{
  "name": "civilization-clash-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ws": "^8.14.0"
  }
}
```

## Implementation Steps

1. **Setup server directory**
   ```bash
   cd server
   npm init -y
   npm install ws
   ```

2. **Create server.js** with WebSocket setup

3. **Handle connections** - Track who is team 0 vs 1

4. **Process messages** - Store actions, handle timeout

5. **Broadcast state** - Send to all connected clients

6. **Test with wscat** or simple client

## Testing the Server

### Quick Test Client
Create `server/test-client.js`:
```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected!');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Received:', msg.type);

  if (msg.type === 'GAME_STATE') {
    // Send a random move
    const state = msg.state;
    const myUnits = state.units.filter(u => u.owner === msg.yourTeamId);
    if (myUnits.length > 0) {
      const unit = myUnits[0];
      ws.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{
          type: 'MOVE',
          unitId: unit.id,
          targetX: unit.x + (Math.random() > 0.5 ? 1 : -1),
          targetY: unit.y
        }]
      }));
    }
  }
});
```

Run two instances to test:
```bash
# Terminal 1
node server.js

# Terminal 2
node test-client.js

# Terminal 3
node test-client.js
```

## Success Criteria
- [x] Server starts on port 8080
- [x] Accepts exactly 2 connections
- [x] Assigns team 0 and 1 correctly
- [x] Starts game when both connected
- [x] Processes actions with timeout
- [x] Broadcasts state after each turn
- [x] Detects game over
- [x] Resets for new game

## Common Issues & Solutions
- **Port in use**: Change PORT or kill existing process
- **Module errors**: Ensure "type": "module" in package.json
- **Path issues**: Run from server/ directory

## Next Task
Task 04 will create a visual frontend that connects to this server and displays the game.