# Task 02: Implement Basic Game Logic (MVP)

## Objective
Create a minimal working game that can process moves and determine a winner. Focus on getting something playable, not feature-complete.

## What to Build

### Simplified Rules for MVP
- **Map**: Fixed 15x10 grid, all fields (no terrain types)
- **Units**: Only Soldiers (HP: 3, Damage: 1, Move: 1)
- **Players**: 2 teams, each starts with 3 soldiers
- **Actions**: Only MOVE action
- **Combat**: If adjacent after movement, deal 1 damage (simplified)
- **Victory**: Elimination or reach turn 50 (highest unit count wins)
- **No**: Cities, monument, blood points, zone of control, other unit types

## Files to Create

### `logic/game.js`
```javascript
export class Game {
  constructor() {
    this.width = 15;
    this.height = 10;
    this.turn = 0;
    this.maxTurns = 50;
    this.teams = [
      {id: 0, territoryPoints: 100},  // Start with some TP
      {id: 1, territoryPoints: 100}
    ];
    this.units = this.initializeUnits();
  }

  initializeUnits() {
    // Team 0: 3 soldiers on left side
    // Team 1: 3 soldiers on right side
    return [
      {id: 1, owner: 0, type: 'SOLDIER', x: 1, y: 4, hp: 3},
      {id: 2, owner: 0, type: 'SOLDIER', x: 1, y: 5, hp: 3},
      {id: 3, owner: 0, type: 'SOLDIER', x: 1, y: 6, hp: 3},
      {id: 4, owner: 1, type: 'SOLDIER', x: 13, y: 4, hp: 3},
      {id: 5, owner: 1, type: 'SOLDIER', x: 13, y: 5, hp: 3},
      {id: 6, owner: 1, type: 'SOLDIER', x: 13, y: 6, hp: 3}
    ];
  }

  processActions(team0Actions, team1Actions) {
    // 1. Process movements
    // 2. Check for combat (adjacent units)
    // 3. Remove dead units
    // 4. Increment turn
  }

  getState() {
    return {
      turn: this.turn,
      maxTurns: this.maxTurns,
      width: this.width,
      height: this.height,
      teams: this.teams,
      units: this.units,
      gameOver: this.isOver(),
      winner: this.getWinner()
    };
  }

  isOver() {
    // Game ends if turn 50 or one team has no units
  }

  getWinner() {
    // Return 0, 1, or null (tie)
  }
}
```

### `logic/tests/game.test.js`
```javascript
import { Game } from '../game.js';
import assert from 'node:assert';
import { test, describe } from 'node:test';

describe('Basic Game Logic', () => {
  test('initializes with correct setup', () => {
    const game = new Game();
    assert.equal(game.units.length, 6);
    assert.equal(game.turn, 0);
  });

  test('units can move', () => {
    const game = new Game();
    game.processActions(
      [{type: 'MOVE', unitId: 1, targetX: 2, targetY: 4}],
      []
    );
    const unit = game.units.find(u => u.id === 1);
    assert.equal(unit.x, 2);
  });

  test('adjacent units fight', () => {
    const game = new Game();
    // Setup units to be adjacent
    game.units[0].x = 7;
    game.units[3].x = 8;
    game.processActions([], []);
    // Check damage was dealt
    assert.equal(game.units[0].hp, 2);
    assert.equal(game.units[3].hp, 2);
  });

  test('game ends at turn 50', () => {
    const game = new Game();
    game.turn = 49;
    game.processActions([], []);
    assert.equal(game.isOver(), true);
  });

  test('game ends when team eliminated', () => {
    const game = new Game();
    // Remove all team 1 units
    game.units = game.units.filter(u => u.owner === 0);
    assert.equal(game.isOver(), true);
    assert.equal(game.getWinner(), 0);
  });
});
```

### `logic/package.json`
```json
{
  "name": "civilization-clash-logic",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

## Implementation Steps

1. **Create game.js** with basic structure
2. **Implement movement** - validate moves are within 1 tile
3. **Implement combat** - check adjacency, deal damage
4. **Add win conditions** - elimination and turn limit
5. **Write tests** - ensure each piece works
6. **Run tests** - `npm test` in logic directory

## What NOT to Do Yet
- Don't implement Zone of Control
- Don't add other unit types
- Don't implement territory mechanics
- Don't add Blood Points
- Don't generate maps
- Keep it under 200 lines!

## Success Criteria
- [x] Game initializes with units
- [x] Units can move 1 tile per turn
- [x] Adjacent units deal damage
- [x] Dead units are removed
- [x] Game ends at turn 50 or elimination
- [x] All tests pass
- [x] Can play a full game in Node.js console

## Testing the Implementation
```javascript
// Quick test in Node REPL
import { Game } from './logic/game.js';
const game = new Game();
console.log(game.getState());
game.processActions(
  [{type: 'MOVE', unitId: 1, targetX: 2, targetY: 4}],
  [{type: 'MOVE', unitId: 4, targetX: 12, targetY: 4}]
);
console.log(game.getState());
```

## Next Task
Once this works, Task 03 will wrap this in a WebSocket server.