# Creating Minimal MVP - Strategy & Incremental Tasks

## Goal
Create a working game that can be played end-to-end, even if missing many features. See something on screen, move units, win/lose.

## MVP Feature Selection

### What We WILL Include (Absolute Minimum)
- [ ] Fixed 15x10 map (no generation, hardcoded)
- [ ] Basic terrain: Fields only (no mountains/water yet)
- [ ] 2 players with starting positions
- [ ] ONE unit type: Soldier (no archers/raiders yet)
- [ ] Basic movement (no Zone of Control yet)
- [ ] Simple combat (adjacent units deal 1 damage)
- [ ] Territory Points only (no Blood Points yet)
- [ ] Win by elimination or turn limit (50 turns)
- [ ] Basic WebSocket connection
- [ ] Visual grid with units

### What We SKIP for Now
- ❌ Map generation (use hardcoded map)
- ❌ Mountains and water
- ❌ Archers and Raiders
- ❌ Zone of Control
- ❌ Blood Points system
- ❌ Cities
- ❌ Monument
- ❌ Territory expansion action
- ❌ Complex combat phases
- ❌ Authentication (just player 0 and 1)
- ❌ Admin commands
- ❌ Spectator mode
- ❌ PASS action

## Implementation Phases

### Phase 1: Core Game Loop Works
1. Hardcoded map
2. Place soldiers
3. Move soldiers
4. Fight when adjacent
5. Check win conditions

### Phase 2: Server Wraps Game
1. Accept WebSocket connections
2. Start game when 2 connect
3. Receive moves
4. Send state updates

### Phase 3: Frontend Shows Game
1. Draw grid
2. Show units
3. Display whose turn
4. Show winner

## Task Files

---

# Task 02: Implement Basic Game Logic

Create `logic/game.js` with minimal features:

```javascript
class Game {
  constructor() {
    // Fixed 15x10 map
    // 2 players start at opposite sides
    // Each has 3 soldiers
  }

  processActions(team0Actions, team1Actions) {
    // Only handle MOVE actions
    // Simple combat: if adjacent, deal 1 damage
  }

  getState() {
    // Return current game state
  }

  isOver() {
    // Check if turn 50 or one player has no units
  }
}
```

**Files to create:**
- `logic/game.js` - Main game class (200 lines max)
- `logic/tests/game.test.js` - Basic tests

**Test scenarios:**
1. Game initializes correctly
2. Units can move
3. Combat works (units take damage)
4. Game ends at turn 50
5. Game ends when all units dead

**Success: Can run a game locally in Node.js**

---

# Task 03: Create Basic Server

Create `server/server.js` that:

```javascript
// Minimal WebSocket server
const WebSocket = require('ws');
const { Game } = require('../logic/game.js');

// When 2 clients connect, start game
// Receive: {type: "SUBMIT_ACTIONS", actions: [...]}
// Send: {type: "GAME_STATE", state: {...}}
```

**Files to create:**
- `server/server.js` - WebSocket wrapper (100 lines max)
- `server/package.json` - Only ws dependency

**Features:**
- No authentication (first = player 0, second = player 1)
- Fixed 250ms timeout
- Auto-start when 2 connected
- Broadcast state after each turn

**Success: Two clients can connect and play**

---

# Task 04: Create Basic Frontend

Create `visuals/index.html` with inline CSS/JS:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Grid styling */
    .cell { width: 40px; height: 40px; }
    .soldier { background: red; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script>
    // Connect WebSocket
    // Draw 15x10 grid
    // Show soldiers as colored squares
    // Update on state change
  </script>
</body>
</html>
```

**Single file:** `visuals/index.html` (300 lines max)

**Features:**
- Grid display
- Units as colored squares (red/blue)
- Turn counter
- Winner display

**Success: Can see game happening in browser**

---

## Verification Checklist

### After Task 02:
- [x] Can create game instance
- [x] Can move units
- [x] Combat reduces HP
- [x] Game ends properly
- [x] Tests pass

### After Task 03:
- [x] Server starts
- [x] Accepts 2 connections
- [x] Processes actions
- [x] Broadcasts state
- [x] Game completes

### After Task 04:
- [x] Frontend connects
- [x] Grid displays
- [x] Units visible
- [x] Updates each turn
- [x] Shows winner

## Next Steps (After MVP)
Once this works, we can incrementally add:
1. **Task 05**: Add other unit types (Archer, Raider)
2. **Task 06**: Add terrain (Mountains, Water)
3. **Task 07**: Add Cities and Monument
4. **Task 08**: Add Blood Points system
5. **Task 09**: Add Zone of Control
6. **Task 10**: Add proper authentication
7. **Task 11**: Add map generation
8. **Task 12**: Polish frontend with sprites

## Key Principle
**WORKING > COMPLETE**

Better to have a playable game missing features than a broken game with all features attempted.