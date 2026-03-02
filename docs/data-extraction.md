# Data & Training

The logic layer is stateless with zero dependencies. You can run games headlessly without a server or frontend.

## Game State Format

```json
{
  "turn": 42,
  "maxTurns": 200,
  "gameOver": false,
  "winner": null,
  "players": [{ "id": 0, "name": "Bot0", "gold": 150.0, "score": 245, "income": 12.5 }],
  "map": {
    "width": 25,
    "height": 15,
    "tiles": [
      { "x": 0, "y": 0, "type": "FIELD", "owner": 0 },
      { "x": 0, "y": 1, "type": "MOUNTAIN", "owner": null }
    ]
  },
  "units": [{ "x": 10, "y": 5, "owner": 0, "type": "SOLDIER", "hp": 3, "canMove": true }],
  "cities": [{ "x": 2, "y": 7, "owner": 0 }],
  "monument": {
    "x": 12,
    "y": 7,
    "controlledBy": 0
  }
}
```

- Units identified by position, one per tile
- `tiles` is a flat array (`width * height`)
- `owner` is `null`, `0`, or `1`
- `controlledBy` is `null` if uncontrolled

## Standalone Logic

```bash
cd logic
# No install needed
```

```javascript
const logic = require('./logic');

// Create a game
const state = logic.createInitialState({ mode: 'standard' });

// Process a turn
const result = logic.processTurn(state, {
  player0: [
    { action: 'MOVE', from_x: 2, from_y: 7, to_x: 3, to_y: 7 },
    { action: 'EXPAND_TERRITORY', x: 3, y: 6 },
  ],
  player1: [{ action: 'BUILD_UNIT', city_x: 22, city_y: 7, unit_type: 'SOLDIER' }],
});
// result.newState, result.errors, result.info

// Validate an action
logic.validateAction(state, 0, {
  action: 'MOVE',
  from_x: 5,
  from_y: 5,
  to_x: 6,
  to_y: 5,
});
// { valid: true } or { valid: false, reason: '...' }

// ASCII visualization
logic.printState(state);
logic.printEvents(result.info.events);
```

## Headless Self-Play

```javascript
const logic = require('./logic');

function runGame(agent0, agent1, mode = 'blitz') {
  let state = logic.createInitialState({ mode });
  const history = [JSON.parse(JSON.stringify(state))];

  while (!state.gameOver) {
    const actions = {
      player0: agent0(state, 0),
      player1: agent1(state, 1),
    };
    const result = logic.processTurn(state, actions);
    state = result.newState;
    history.push(JSON.parse(JSON.stringify(state)));
  }

  return {
    winner: state.winner,
    finalScores: state.players.map((p) => p.score),
    turns: state.turn,
    history,
  };
}
```

Batch example:

```javascript
const results = [];
for (let i = 0; i < 1000; i++) {
  results.push(runGame(myAgent, baselineAgent, 'blitz'));
}
const winRate = results.filter((r) => r.winner === 0).length / results.length;
console.log(`Win rate: ${(winRate * 100).toFixed(1)}%`);
```

## Save File Format

Games auto-save to `server/saves/`:

```json
{
  "id": "2026-03-02T17-18-00_Bot0-vs-Bot1",
  "timestamp": "2026-03-02T17:18:00.238Z",
  "mode": "standard",
  "players": [
    {"id": 0, "name": "Bot0"},
    {"id": 1, "name": "Bot1"}
  ],
  "winner": 0,
  "winReason": "score",
  "finalTurn": 200,
  "maxTurns": 200,
  "states": [ ... ]
}
```

### Loading saves

```javascript
const fs = require('fs');
const save = JSON.parse(fs.readFileSync('server/saves/somefile.json', 'utf-8'));

for (const state of save.states) {
  const p0 = state.players[0];
  console.log(`Turn ${state.turn}: Gold=${p0.gold}, Score=${p0.score}`);
}
```

### Via WebSocket

```javascript
// List saves
ws.send(JSON.stringify({ type: 'LIST_SAVES' }));
// -> { type: 'SAVES_LIST', saves: [{id, timestamp, mode, players, winner}] }

// Load a save
ws.send(JSON.stringify({ type: 'LOAD_SAVE', saveId: 'some-save-id' }));
// -> { type: 'SAVE_LOADED', states: [...], players: [...] }
```

## API Reference

| Function              | Signature                                        | Description                 |
| --------------------- | ------------------------------------------------ | --------------------------- |
| `createInitialState`  | `(options)` -> `state`                           | New game                    |
| `processTurn`         | `(state, actions)` -> `{newState, errors, info}` | Process one turn            |
| `validateAction`      | `(state, teamId, action)` -> `{valid, reason}`   | Check one action            |
| `generateMap`         | `(width, height, mode)` -> `map`                 | Generate map                |
| `getTilesAtDistance1` | `(x, y)` -> `[{x, y}]`                           | 8 adjacent positions        |
| `getTilesAtDistance2` | `(x, y)` -> `[{x, y}]`                           | 24 positions within range 2 |
| `chebyshevDistance`   | `(x1, y1, x2, y2)` -> `number`                   | `max(\|dx\|, \|dy\|)`       |
| `manhattanDistance`   | `(x1, y1, x2, y2)` -> `number`                   | `\|dx\| + \|dy\|`           |
| `isInZoC`             | `(state, unit)` -> `boolean`                     | In enemy soldier ZoC?       |
| `getTile`             | `(state, x, y)` -> `tile`                        | Tile at position            |
| `getUnit`             | `(state, x, y)` -> `unit/null`                   | Unit at position            |
| `getCity`             | `(state, x, y)` -> `city/null`                   | City at position            |
| `isPassable`          | `(state, x, y)` -> `boolean`                     | Can units enter?            |

## Constants

`const { UNIT_STATS, ECONOMY, SCORING } = require('./logic');`

| Unit    | cost | hp  | dmg | move | deathScore | ZoC     | ZoC immune |
| ------- | ---- | --- | --- | ---- | ---------- | ------- | ---------- |
| SOLDIER | 20   | 3   | 1   | 1    | 10         | range 2 | yes        |
| ARCHER  | 25   | 2   | 1   | 1    | 12         | --      | no         |
| RAIDER  | 10   | 1   | 1   | 2    | 3          | --      | no         |

**Economy**: FIELD_INCOME: 0.5, CITY_INCOME: 5, EXPAND_COST: 5, CITY_COST: 80

**Scoring**: DAMAGE_DEALT: 5, KILL_BONUS: 7, MONUMENT_EARLY: 5, MONUMENT_MID: 10, MONUMENT_LATE: 15

**Multipliers**: Turns 1-100: x1, 101-150: x1.5, 151-200: x2 (combat only, not monument)
