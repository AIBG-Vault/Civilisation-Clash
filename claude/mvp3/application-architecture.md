# Civilization Clash - Application Architecture (MVP3)

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Application                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   Spectator  │  │ Manual Agent │  │   Rendering Engine    │  │
│  │    Client    │  │    Client    │  │  (Iso + Flat modes)   │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                         WebSocket
                              │
┌─────────────────────────────────────────────────────────────────┐
│                          Server                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Connection  │  │    Auth &    │  │   Client Override     │  │
│  │   Manager    │  │   Passwords  │  │      Settings         │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Game State Manager (owns state)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Calls with (state, actions)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Game Logic (stateless)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │     Turn     │  │     Map      │  │     Validation        │  │
│  │   Processor  │  │  Generation  │  │                       │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                 │
│         Returns (newState, errors, gameInfo)                    │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Component Layers

### 2.1 Game Logic Layer

**Stateless** pure functions that implement game rules. Does NOT manage state - receives state as input, returns new state as output.

**Responsibilities:**
- Implement all game rules from specification
- Process turns: take state + actions, return new state
- Generate and validate maps
- Validate actions against current state
- Calculate winners, scores, and game-over conditions

**Interface:**
```javascript
// Input
{
  state: GameState,
  actions: {
    player0: Action[],
    player1: Action[]
  }
}

// Output
{
  newState: GameState,
  errors: ActionError[],
  info: {
    gameOver: boolean,
    winner: number | null,
    turnEvents: TurnEvent[]  // Combat results, captures, etc.
  }
}
```

**Key Principle:** The logic layer is a pure function. Given the same state and actions, it always produces the same output. It holds no internal state between calls.

**Features:**
- Terminal-based visual interface for debugging
- Comprehensive test coverage for game mechanics
- Deterministic execution (same inputs = same outputs, except for monument)
- Can be used standalone for AI training without server

### 2.2 Server Layer

Wraps game logic with networking and session management. **Owns and manages the game state.**

**Responsibilities:**
- **State ownership**: Holds current game state, passes to logic for processing
- WebSocket connection management
- Player and spectator authentication
- Game session lifecycle (start, reset, load)
- Timeout management
- Client override settings
- State persistence and loading
- Broadcasting state updates to clients

**Key Features:**

| Feature | Description |
|---------|-------------|
| Authentication | Password-based with preferred team selection |
| Connection Types | Players, spectators, manual agents |
| Timeout Control | Enable/disable, configurable duration |
| State Management | Get current state, load custom state |
| Client Override | Allow clients to modify server settings |
| Name Collision | Append (1), (2) etc. for duplicate names |
| Custom Maps | Configurable map dimensions |

### 2.3 Web Application Layer

Frontend client with multiple operation modes.

**Core Modes:**
1. **Spectator Mode** (default): Watch games, no interaction

**Manual play**
2. **Manual Play Mode**: Play as a team with full controls. Works in background, does not override spectator.

## 3. Detailed Component Breakdown

### 3.1 Game Logic (`/logic`)

```
logic/
├── index.js              # Main exports (processTurn, createInitialState, etc.)
├── processor.js          # Turn processor (stateless)
├── constants.js          # Game constants (costs, stats, unit definitions)
├── map-generator.js      # Map generation
├── validation.js         # Action validation
├── terminal.js           # Terminal-based display for debugging
└── tests/
    └── logic.test.js     # All game logic tests
```

### 3.2 Server (`/server`)

```
server/
├── server.js             # Main server entry
├── game-manager.js       # Owns game state, calls logic
├── connections.js        # WebSocket, connections & authentication
├── passwords.json        # Stored credentials
└── tests/
    └── server.test.js
```

### 3.3 Web Application (`/visuals`)

```
visuals/
├── index.html            # Main entry point
├── styles.css            # All styles (with dark/light mode)
├── app.js                # Application entry & state management
├── websockets.js         # WebSocket wrapper & protocol
├── spectator.js          # Spectating options
├── renderEngine.js       # Canvas rendering (iso + flat modes)
├── ui.js                 # UI panels and controls
├── manual-play.js        # Manual play mode controller
└── assets/
    └── sprites/          # Game sprites (tiles, units, buildings)
```

## 4. Game Logic API

The game logic is a collection of **stateless pure functions**. No classes hold state.

### 4.1 Core Functions

```javascript
// Main turn processor - takes state and actions, returns new state
function processTurn(state: GameState, actions: TurnActions): TurnResult

// Create initial game state
function createInitialState(options: GameOptions): GameState

// Generate a new map
function generateMap(width: number, height: number, mode: 'blitz' | 'standard'): Map

// Validate actions against current state (optional pre-check)
function validateActions(state: GameState, teamId: number, actions: Action[]): ValidationResult
```

### 4.2 Types

```javascript
interface GameOptions {
  mode: 'blitz' | 'standard'
  mapWidth?: number
  mapHeight?: number
  customMap?: Map
}

interface TurnActions {
  player0: Action[]
  player1: Action[]
}

interface TurnResult {
  newState: GameState
  errors: ActionError[]
  info: {
    gameOver: boolean
    winner: number | null    // 0, 1, or null (tie)
    turnEvents: TurnEvent[]  // Combat, captures, deaths, etc.
  }
}

interface TurnEvent {
  type: 'COMBAT' | 'DEATH' | 'CAPTURE' | 'CITY_CAPTURED' | 'MONUMENT_CONTROL'
  data: object  // Event-specific details
}
```

### 4.3 Action Format

```javascript
// Movement
{ action: 'MOVE', from_x: number, from_y: number, to_x: number, to_y: number }

// Build unit at city
{ action: 'BUILD_UNIT', city_x: number, city_y: number, unit_type: 'SOLDIER' | 'ARCHER' | 'RAIDER' }

// Build city
{ action: 'BUILD_CITY', x: number, y: number }

// Expand territory
{ action: 'EXPAND_TERRITORY', x: number, y: number }

// Pass turn
{ action: 'PASS' }
```

### 4.4 Game State Format

```javascript
interface GameState {
  turn: number
  maxTurns: number
  gameOver: boolean
  winner: number | null

  players: Player[]
  map: Tile[]
  units: Unit[]
  cities: City[]
  monument: Monument
}

interface Player {
  id: number
  gold: number
  score: number
  income: number
}

interface Unit {
  x: number
  y: number
  owner: number
  type: 'SOLDIER' | 'ARCHER' | 'RAIDER'
  hp: number
  canMove: boolean
}

interface City {
  x: number
  y: number
  owner: number
  captureProgress: number
}
```

## 5. Server Protocol

### 5.1 Authentication

```javascript
// Client -> Server
{
  type: 'AUTH',
  password: string,
  name: string,
  preferredTeam?: 0 | 1  // Optional team preference
}

// Server -> Client
{
  type: 'AUTH_SUCCESS',
  teamId: number,        // -1 for spectator
  assignedName: string,  // May have (1) suffix if collision
  isSpectator: boolean
}
```

### 5.2 Get Current State

```javascript
// Client -> Server
{ type: 'GET_STATE' }

// Server -> Client
{
  type: 'GAME_STATE',
  // Full game state (same format as broadcast after each turn)
  ...GameState
}
```

### 5.3 Game Control (Client Override)

```javascript
// Only when CLIENT_OVERRIDE enabled
{ type: 'GAME_CONTROL', action: 'DISABLE_TIMEOUT' }
{ type: 'GAME_CONTROL', action: 'ENABLE_TIMEOUT', timeout: number }
{ type: 'GAME_CONTROL', action: 'RESET_GAME' }
{ type: 'GAME_CONTROL', action: 'LOAD_STATE', state: GameState }
{ type: 'GAME_CONTROL', action: 'SET_MAP_SIZE', width: number, height: number }
```

### 5.4 Server Status

```javascript
// Client -> Server
{ type: 'GET_STATUS' }

// Server -> Client
{
  type: 'SERVER_STATUS',
  gameActive: boolean,
  timeoutEnabled: boolean,
  timeoutMs: number,
  clientOverrideEnabled: boolean,
  mapSize: { width: number, height: number },
  connectedClients: [
    { name: string, type: 'player' | 'spectator', team?: number }
  ]
}
```

## 6. Web Application Features

### 6.1 UI Design Principles

- **Theme**: Clean, minimal, Apple/Figma inspired
- **Layout**: Foldable drawer panels, collapsed by default
- **Icons**: Lucide icons (or similar lightweight library)
- **Modes**: Dark mode and light mode support

### 6.2 Core Features

| Feature | Description |
|---------|-------------|
| Auto Spectator | Connects as spectator on load |
| Playback Control | Speed slider from slow to real-time |
| Game History | Groups and stores all recorded games |
| Turn Scrubbing | Slider to navigate through turns |
| Server Status | Display and control server settings |
| Theme Toggle | Dark/light mode switch |

### 6.3 Visual Settings

- Grid lines toggle (borders between tiles)
- Isometric / flat view toggle
- Zoom level control

### 6.4 Manual Play Mode

When enabled, provides:
- Unit selection (click to select)
- Movement visualization (valid tiles highlighted)
- Action queue display
- Build menus (units, cities, expand)
- Turn submission button
- Future: Multi-select units for group commands

### 6.5 Rendering Engine

**Responsibilities:**
- Draw game state to canvas
- Support isometric and flat projections
- Display score and economy HUD
- Handle selection highlighting (for manual play)
- Animate transitions (optional)

**Modes:**
1. **View Mode**: Pure observation, no interaction highlights
2. **Manual Play Mode**: Shows selections, valid moves, action previews

## 7. Development Guidelines

### 7.1 Team Collaboration

This codebase will be developed by ~8 people, many new to programming.

**File Organization:**
- Keep file count low - consolidate related functionality
- Clear naming conventions
- Each file should have a single clear purpose

**Benefits:**
- Easier to navigate codebase
- Less overhead finding where code lives
- Simpler imports and dependencies

### 7.2 Code Style

- Use consistent formatting (Prettier recommended)
- Comment complex logic
- Use descriptive variable/function names
- Keep functions small and focused

### 7.3 Testing Strategy

- Unit tests for all game mechanics
- Integration tests for turn processing
- Scenario tests with predefined game states
- Server protocol tests

## 8. Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Game Logic | Pure JavaScript | No dependencies, runs anywhere |
| Server | Node.js + ws | Simple, proven WebSocket support |
| Frontend | Vanilla JS + Tailwind CSS | No build step, native styling |
| Icons | Lucide | Lightweight, clean design |
| Testing | Node test runner | Built-in, no extra dependencies |

## 9. Future Extensibility

The architecture supports:
- Additional unit types
- New game modes
- Tournament management
- Replay sharing
- AI training integration
- Mobile-friendly interface
