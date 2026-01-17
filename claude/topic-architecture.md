# AIBG Civilization Clash - Architecture Design

## Documentation Guidelines
**Important**: Future planning documents in `/claude` should focus on specifications and architecture, not full code implementations. Use pseudocode and interface definitions to illustrate concepts. Actual code belongs in the implementation files.

## Implementation Status
**MVP Complete** ✅
- Basic game logic with soldiers, movement, and combat
- WebSocket server handling 2 players
- Frontend visualization with grid display
- Test client for automated play

## Overview
A turn-based strategy game for the AIBG hackathon where teams develop AI bots to compete. The architecture prioritizes simplicity and modularity, with completely independent game logic that can run standalone for RL training or be embedded in any environment.

## Tech Stack
- **Server**: Node.js v18+ (vanilla, only ws package for WebSockets)
- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks, no build step)
- **Game Logic**: Pure JavaScript module with zero dependencies
- **Container**: Simple Docker for server deployment
- **Testing**: Node's built-in test runner

## Project Structure
```
Civilisation-Clash/
├── agents/               # Example bot implementations [TODO]
│   ├── js/              # JavaScript bot examples
│   │   ├── random.js
│   │   └── smart.js
│   └── python/          # Python bot examples
│       ├── random.py
│       └── smart.py
├── docs/                # Documentation and presentations [TODO]
│   ├── AIBG - Topic manual - Civilization Clash.pdf
│   └── AIBG - Topic presentation - Civilization Clash.pdf
├── logic/               # STANDALONE game logic (zero dependencies) [MVP DONE]
│   ├── game.js          # Main game class [IMPLEMENTED]
│   ├── map.js           # Map generation and territory [TODO]
│   ├── units.js         # Unit mechanics [BASIC DONE]
│   ├── combat.js        # Combat resolution [BASIC DONE]
│   ├── economy.js       # TP/BP calculations [TODO]
│   └── tests/           # Game logic tests [BASIC TESTS DONE]
│       ├── game.test.js
│       ├── combat.test.js
│       └── scenarios/    # Test game states
├── server/              # WebSocket server wrapper [MVP DONE]
│   ├── server.js        # Main server file [IMPLEMENTED]
│   ├── test-client.js   # Test WebSocket client [IMPLEMENTED]
│   ├── passwords.json   # Team passwords [TODO]
│   ├── package.json     # Server dependencies (ws) [DONE]
│   └── Dockerfile       # Simple container [TODO]
├── visuals/             # Frontend visualization [MVP DONE]
│   ├── index.html       # Single page app [IMPLEMENTED]
│   ├── style.css        # Game styles [INLINE IN HTML]
│   ├── game.js          # Rendering logic [INLINE IN HTML]
│   └── assets/          # Sprites and images [TODO]
└── README.md            # [TEMPLATE ONLY]
```

## Component Design

### Game Logic (Standalone Module)
The game logic is a **pure JavaScript module** with zero dependencies that can be imported and run anywhere:

```javascript
// Example usage in any environment
import { Game } from './logic/game.js';

const game = new Game('standard'); // or 'blitz'
const state = game.getState();

// Make moves
game.processActions(player0Actions, player1Actions);
const newState = game.getState();

// Check if game over
if (game.isOver()) {
  const winner = game.getWinner();
  const scores = game.getScores();
}
```

**Key Design**:
- Pure functions for all game mechanics
- Immutable state updates (can snapshot at any point)
- No async operations, no external dependencies
- Deterministic execution (same inputs = same outputs)
- Can be run in Node.js, browser, or any JS environment

This allows:
- RL teams to run thousands of games locally without network overhead
- Frontend to potentially run games client-side for instant feedback
- Easy testing with predictable outcomes
- Simple replay system (just store actions)

### Server Architecture
Thin WebSocket wrapper around the game logic:

```javascript
// server/server.js
const WebSocket = require('ws');
const { Game } = require('../logic/game.js');
const passwords = require('./passwords.json');

// Simple auth: check if password matches passwords.json
// Frontend connects with password="frontend" for viewing only
// Dev mode: multiple agents can join same team
// Tournament mode: one agent per team
// Broadcasts state after each turn
```

**Authentication Flow**:
1. Client connects via WebSocket
2. Client sends within 5 seconds:
   ```json
   {"type": "AUTH", "password": "team_password", "name": "BotName", "teamId": 0}
   ```
3. Server checks password against `passwords.json`:
   - Team password → playing bot
   - Admin password → full control
   - Spectator password → view only
4. Team bots:
   - Can specify teamId or get auto-assigned
   - Multiple bots per team allowed
   - Names shown on frontend
5. Admin connections:
   - Multiple admins allowed simultaneously
   - Can pause/resume game
   - Can change timeout settings
   - Can disconnect problematic bots
   - Can query server status
   - Can save/load game states for debugging or recovery
6. Invalid password or timeout → connection closed

**Game Management**:
- Server runs ONE game at a time
- Can switch between BLITZ and STANDARD without restart
- When game ends, server waits for new game command
- Admin triggers: `{"type": "NEW_GAME", "mode": "blitz"}`
- Admin can disable timeout for debugging (waits for all bots)
- PASS action advances turn when timeout disabled
- Multiple bots per team allowed (last actions win)
- RL teams run game logic directly without server for training

### Frontend Architecture
Pure HTML/CSS/JS that connects to server via WebSocket:

```javascript
// visuals/game.js
const ws = new WebSocket('ws://localhost:8080');
ws.send(JSON.stringify({id: 'frontend'}));

ws.onmessage = (event) => {
  const gameState = JSON.parse(event.data);
  render(gameState);
};
```

**Debug Mode**:
- Manual control buttons for testing
- Shows game state JSON
- Displays combat calculations
- Territory ownership overlay

### Bot Client Interface
Simple WebSocket clients in any language:

```python
# Python example
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:8080")
# Choose which team to play as (0 or 1)
ws.send(json.dumps({"password": "myPassword", "teamId": 0}))

while True:
    state = json.loads(ws.recv())
    if state["type"] == "GAME_STATE":
        # Server tells you which team you are
        my_team = state["yourTeamId"]
        actions = compute_actions(state, my_team)
        ws.send(json.dumps({
            "type": "SUBMIT_TURN",
            "actions": actions
        }))
```

**Debug/Dev Features**:
- Multiple bots can connect with same password to same team
- Last submitted actions per team are used (allows override)
- PASS action to advance game when timeout disabled
- Admin can disable timeout for step-by-step debugging
- Auto-assign teams when `teamId` omitted
- Bot names displayed on frontend for identification

## API Design

### Game Logic API (Standalone Module)

The game logic is a pure JavaScript module that exposes these methods:

```javascript
class Game {
  constructor(mode = 'standard') // 'standard' or 'blitz'

  // Core game flow
  processActions(team0Actions, team1Actions) // Apply one turn
  getState() // Get current game state
  isOver() // Check if game ended
  getWinner() // Returns 0, 1, or null (tie)
  getScores() // Returns {0: territoryPts, 1: territoryPts, bloodPoints: {...}}

  // For testing/debugging
  setState(state) // Load a specific game state
  validateAction(teamId, action) // Check if action is legal
  getPossibleActions(teamId) // Get all legal actions for a team

  // For replays
  getHistory() // Returns all actions taken
  replayToTurn(turnNumber) // Replay game to specific turn
}
```

**Action Format**:
```javascript
// All actions for one team in one turn
[
  {type: "MOVE", unitId: 42, targetX: 10, targetY: 5},
  {type: "BUILD_UNIT", cityId: 1, unitType: "SOLDIER"},
  {type: "BUILD_CITY", x: 20, y: 12},
  {type: "EXPAND_TERRITORY", x: 16, y: 8},  // Target tile to claim
  {type: "PASS"}  // Special action for debug mode (no-op in game logic)
]
```

**State Format**:
```javascript
{
  mode: "standard",
  turn: 42,
  maxTurns: 200,
  map: {
    width: 25,
    height: 15,
    tiles: [
      {x: 0, y: 0, type: "FIELD", owner: 0},
      {x: 0, y: 1, type: "MOUNTAIN", owner: null},
      // ... all tiles
    ]
  },
  teams: [
    {
      id: 0,
      territoryPoints: 150,
      bloodPoints: 45,
      income: 12
    },
    {
      id: 1,
      territoryPoints: 132,
      bloodPoints: 60,
      income: 10
    }
  ],
  units: [
    {
      id: 42,
      owner: 0,
      type: "SOLDIER",
      x: 10,
      y: 5,
      hp: 3,
      canMove: true,
      capturedThisTurn: false
    }
    // ... all units
  ],
  cities: [
    {
      id: 1,
      owner: 0,
      x: 2,
      y: 7,
      captureProgress: 0,
      capturingUnit: null,
      turnsUntilComplete: 0  // For cities under construction
    }
    // ... all cities
  ],
  monument: {
    x: 12,
    y: 7,
    controlledBy: 0  // or null
  }
}
```

### Server WebSocket Protocol

### Client → Server

**1. Authentication** (must be first message within 5 seconds):
```json
// Team authentication
{
  "type": "AUTH",
  "password": "alpha2025",
  "name": "AlphaBot v2.1",  // Display name for frontend
  "teamId": 0  // Optional - omit to auto-assign available team
}

// Admin authentication
{
  "type": "AUTH",
  "password": "admin2025",
  "name": "Admin",
  "admin": true
}
```

**2. Submit Actions** (sent each turn):
```json
{
  "type": "SUBMIT_ACTIONS",
  "actions": [
    {"type": "MOVE", "unitId": 42, "targetX": 10, "targetY": 5},
    {"type": "BUILD_UNIT", "cityId": 1, "unitType": "SOLDIER"}
  ]
}

// Or pass control (when timeout disabled)
{
  "type": "SUBMIT_ACTIONS",
  "actions": [{"type": "PASS"}]
}
```

**3. Admin Commands** (admin connections only):
```json
{"type": "NEW_GAME", "mode": "blitz"}
{"type": "PAUSE_GAME"}
{"type": "RESUME_GAME"}
{"type": "SET_TIMEOUT", "enabled": false}  // Disable timeout for debugging
{"type": "SET_TIMEOUT", "enabled": true, "ms": 250}  // Re-enable with value
{"type": "DISCONNECT_BOT", "name": "SmartBot"}  // Disconnect specific bot
{"type": "GET_STATUS"}  // Request current server status
{"type": "GET_GAME_STATE"}  // Request current game state (for spectators)
{"type": "RESET_GAME"}  // Reset to turn 0
{"type": "LOAD_GAME", "state": {...}}  // Load specific game state
{"type": "SAVE_GAME", "filename": "game_turn_42.json"}  // Save current state
```

### Server → Client

**1. Auth Response**:
```json
{
  "type": "AUTH_SUCCESS",
  "teamId": 0  // Assigned team (important if auto-assigned)
}
```
or
```json
{
  "type": "AUTH_FAILED",
  "reason": "Invalid password"  // or "Game full", "Already connected"
}
```

**2. Game State** (broadcast to all after each turn):
```json
{
  "type": "GAME_STATE",
  "yourTeamId": 0,  // -1 for spectators
  "state": {
    // Full game state object as defined above
  }
}
```
// Note: Spectators automatically receive this upon connecting
// Playing bots receive after TURN_PROCESSED

**3. Turn Result** (sent to players only, before new state):
```json
{
  "type": "TURN_PROCESSED",
  "turn": 43,
  "actionsReceived": {
    "0": true,
    "1": false  // Team 1 timed out
  }
}
```
// Purpose: Lets bots know if their actions were received before timeout
// Useful for debugging connection issues and adjusting timing

**4. Game Over**:
```json
{
  "type": "GAME_OVER",
  "winner": 0,  // 0, 1, or null for tie
  "reason": "TURN_LIMIT",  // or "ELIMINATION"
  "finalScores": {
    "0": {"territory": 250, "blood": 180, "total": 610},
    "1": {"territory": 200, "blood": 150, "total": 500}
  }
}
```

**5. Error Messages**:
```json
{
  "type": "ERROR",
  "message": "All your actions were invalid this turn"
}
```

**6. Server Status** (response to GET_STATUS):
```json
{
  "type": "SERVER_STATUS",
  "gameMode": "standard",
  "turn": 42,
  "paused": false,
  "timeoutEnabled": false,
  "timeoutMs": 250,
  "connectedBots": [
    {"name": "SmartBot", "team": 0, "connected": true},
    {"name": "Manual", "team": 0, "connected": true},
    {"name": "EnemyBot", "team": 1, "connected": true}
  ],
  "admins": ["Admin", "Admin2"]  // Multiple admins allowed
}
```

## Complete API Flow Example

### Standard Game Flow (With Timeout)
```
1. Team Alpha connects:
   → {"type": "AUTH", "password": "alpha2025", "name": "AlphaBot", "teamId": 0}
   ← {"type": "AUTH_SUCCESS", "teamId": 0}

2. Team Beta connects:
   → {"type": "AUTH", "password": "beta2025", "name": "BetaBot v3"}
   ← {"type": "AUTH_SUCCESS", "teamId": 1}  // Auto-assigned

3. Game starts when both teams have at least one bot:
   ← {"type": "GAME_STATE", "yourTeamId": 0, "state": {...}}

4. Each turn:
   Team Alpha → {"type": "SUBMIT_ACTIONS", "actions": [...]}
   Team Beta → {"type": "SUBMIT_ACTIONS", "actions": [...]}

   After 250ms timeout OR both submitted:
   ← {"type": "TURN_PROCESSED", "turn": 1, "actionsReceived": {"0": true, "1": true}}
   ← {"type": "GAME_STATE", "yourTeamId": 0, "state": {...}}

5. Game ends:
   ← {"type": "GAME_OVER", "winner": 0, "reason": "TURN_LIMIT", "finalScores": {...}}
```

### Debug Mode Flow (No Timeout + PASS)
```
1. Admin disables timeout:
   → {"type": "AUTH", "password": "admin2025", "name": "Admin", "admin": true}
   ← {"type": "AUTH_SUCCESS", "admin": true}
   → {"type": "SET_TIMEOUT", "enabled": false}

2. Bot connects:
   → {"type": "AUTH", "password": "alpha2025", "name": "SmartBot"}
   ← {"type": "AUTH_SUCCESS", "teamId": 0}

3. Manual controller connects (same team):
   → {"type": "AUTH", "password": "alpha2025", "name": "Manual"}
   ← {"type": "AUTH_SUCCESS", "teamId": 0}

4. Opponent bot:
   → {"type": "AUTH", "password": "beta2025", "name": "Enemy"}
   ← {"type": "AUTH_SUCCESS", "teamId": 1}

5. Each turn (no timeout - waits for ALL bots):
   SmartBot → {"type": "SUBMIT_ACTIONS", "actions": [...]}  // Sends immediately
   Enemy → {"type": "SUBMIT_ACTIONS", "actions": [...]}     // Sends immediately

   // Game waits indefinitely for Manual...

   Manual → {"type": "SUBMIT_ACTIONS", "actions": [{"type": "PASS"}]}  // Let bot play
   OR
   Manual → {"type": "SUBMIT_ACTIONS", "actions": [{"type": "MOVE", ...}]}  // Override

   // Now turn processes (last actions per team win)
   ← {"type": "TURN_PROCESSED", ...}
   ← {"type": "GAME_STATE", ...}

6. Admin manages connections:
   Admin → {"type": "DISCONNECT_BOT", "name": "Manual"}  // Remove stuck bot
   Admin → {"type": "GET_STATUS"}  // Check who's connected
```

## Testing Strategy

### Unit Tests (logic/tests/)
Test each game mechanic in isolation:
- Combat damage calculations
- Zone of Control trapping
- Territory income
- City capture progress
- Monument BP generation
- Victory conditions

### Integration Tests
Full game scenarios:
```javascript
// Test archer range behavior
const game = new Game('blitz');
game.setState(archerScenario);
game.processActions(
  [{type: "MOVE", unitId: 1, targetX: 5, targetY: 5}],
  []  // Team 1 passes
);
assert(game.getUnit(1).hp === 1); // Archer shot it
```

### Test Scenarios
Pre-defined game states for reproducible testing:
- `endgame.json` - Test victory conditions
- `combat.json` - Complex combat scenarios
- `economy.json` - Territory/city income

## Development Workflow

### Quick Start
```bash
# Install (only server needs dependencies)
cd server && npm install

# Run tests
cd logic && node --test

# Start server
node server/server.js

# Open frontend
# Open visuals/index.html in browser

# Run example bot
node agents/js/random.js
```

### For RL Training

**JavaScript teams**:
```javascript
// Direct access to game logic
import { Game } from './logic/game.js';

const game = new Game('blitz');
while (!game.isOver()) {
  const state = game.getState();
  const actions0 = yourRLAgent(state, 0);
  const actions1 = yourRLAgent(state, 1);
  game.processActions(actions0, actions1);
}
```

**Python/C++ teams**:
```bash
# Use CLI wrapper for fair access
node logic/cli.js simulate state.json actions.json
# Returns: new_state.json
```

```python
import subprocess
import json

# Python wrapper for game logic
def simulate_turn(state, actions):
    result = subprocess.run(
        ['node', 'logic/cli.js', 'simulate'],
        input=json.dumps({'state': state, 'actions': actions}),
        capture_output=True, text=True
    )
    return json.loads(result.stdout)
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY logic ./logic
COPY server ./server
WORKDIR /app/server
RUN npm install
EXPOSE 8080
CMD ["node", "server.js"]
```

```bash
docker build -t aibg-server .
docker run -p 8080:8080 aibg-server
```

## Key Design Decisions

### Why Standalone Game Logic?
- RL teams can train without network overhead
- Easy to test deterministically
- Can embed in browser for instant play
- Simplifies debugging (just function calls)

### Why No Concurrent Games on Server?
- Hackathon only needs one game at a time for finals
- RL teams use logic directly (don't need server)
- Eliminates room management complexity
- Simplifies state management

### Why Simple Password Auth?
- Teams get password at event start
- No registration system needed
- No database required
- Proven to work from last year

### Why No Build Step?
- Frontend works instantly in any browser
- No npm install for frontend
- Easy to modify during hackathon
- Reduces setup time to seconds

### Game State Persistence
- Server saves each turn to `games/game_${timestamp}.json`
- Can replay any game by loading action sequence
- Useful for debugging disputed games

### Logging
- Simple console.log for development
- `DEBUG=true` environment variable for verbose output
- Each action logged with timestamp and player

## Configuration

### Environment Variables
```bash
PORT=8080              # WebSocket server port
DEBUG=false            # Verbose logging
GAME_MODE=standard     # or 'blitz'
TURN_TIMEOUT=250       # milliseconds
SAVE_GAMES=true        # Save game replays
```

### passwords.json
```json
{
  "teams": [
    {"password": "alpha2025", "teamName": "Team Alpha"},
    {"password": "beta2025", "teamName": "Team Beta"},
    {"password": "gamma2025", "teamName": "Team Gamma"}
  ],
  "admins": [
    {"password": "admin2025"},
    {"password": "bestadmin"}
  ],
  "spectators": [
    {"password": "frontend"}
  ]
}
```


## Success Metrics
- Setup time: < 2 minutes (just `npm install` in server/)
- Game logic runs 100+ games/second locally (for RL training)
- All game mechanics have corresponding tests
- Zero external dependencies for game logic
- Bots can connect and play within 5 minutes of reading docs

## Current MVP Implementation Details

For more detail, refer `claude/completed/mvp-v1/creating_minimal_MVP.md`.
### Completed Features (MVP)
1. **Game Logic (`logic/game.js`)** ✅
   - Fixed 15x10 map with field terrain only
   - 2 players with 3 soldiers each
   - Basic movement (1 tile per turn)
   - Simple combat (adjacent units deal 1 damage)
   - Territory Points calculation
   - Win conditions: elimination or 50 turns
   - Turn processing with action validation

2. **Server (`server/server.js`)** ✅
   - WebSocket server on port 8080
   - Accepts exactly 2 connections
   - Auto-assigns teams (0 and 1)
   - 250ms turn timeout
   - Broadcasts game state after each turn
   - Sends GAME_OVER messages
   - Auto-resets after game ends

3. **Frontend (`visuals/index.html`)** ✅
   - 15x10 grid display
   - Units shown as colored squares (blue/red)
   - HP bars on units
   - Turn counter and unit counts
   - Manual connect button (requires web server due to CORS)
   - Optional auto-play mode for testing
   - Game over display

4. **Test Client (`server/test-client.js`)** ✅
   - Automated WebSocket client
   - Simple AI moving toward center
   - Demonstrates connection protocol

### Not Yet Implemented
- Multiple unit types (Archers, Raiders)
- Terrain variety (Mountains, Water)
- Cities and city building
- Monument and Blood Points
- Zone of Control
- Territory expansion action
- Map generation
- Authentication system
- Admin commands
- Spectator mode
- Docker deployment
- Comprehensive test suite

### Known Issues
- Frontend must be served via web server (not file://) due to WebSocket CORS restrictions
- No reconnection handling for disconnected players
- No save/load game state functionality
- Basic graphics (no sprites or animations)