/**
 * Comprehensive tests for Civilization Clash game logic
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const {
  processTurn,
  createInitialState,
  generateMap,
  validateActions,
  validateAction,
  cloneState,
  getTilesAtDistance1,
  getTilesAtDistance2,
  chebyshevDistance,
  manhattanDistance,
  isInZoC,
  getScoreMultiplier,
  calculateIncome,
  MODES,
  TERRAIN,
  UNIT_TYPES,
  UNIT_STATS,
  ACTIONS,
  ECONOMY,
  SCORING,
} = require('../index');

// Helper to create a minimal test state
function createTestState(overrides = {}) {
  const state = {
    turn: 1,
    maxTurns: 200,
    gameOver: false,
    winner: null,
    mode: MODES.STANDARD,
    players: [
      { id: 0, gold: 100, score: 0, income: 5 },
      { id: 1, gold: 100, score: 0, income: 5 },
    ],
    map: {
      width: 10,
      height: 10,
      tiles: [],
    },
    units: [],
    cities: [
      { x: 1, y: 5, owner: 0 },
      { x: 8, y: 5, owner: 1 },
    ],
    monument: { x: 5, y: 5, controlledBy: null },
  };

  // Create tiles
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      let type = TERRAIN.FIELD;
      let owner = null;

      // Make edges water
      if (x === 0 || x === 9 || y === 0 || y === 9) {
        type = TERRAIN.WATER;
      }
      // Monument at center
      else if (x === 5 && y === 5) {
        type = TERRAIN.MONUMENT;
      }
      // Starting territories
      else if (x >= 1 && x <= 2 && y >= 4 && y <= 6) {
        owner = 0;
      } else if (x >= 7 && x <= 8 && y >= 4 && y <= 6) {
        owner = 1;
      }

      state.map.tiles.push({ x, y, type, owner });
    }
  }

  // Apply overrides
  return { ...state, ...overrides };
}

// ===== DISTANCE TESTS =====

describe('Distance calculations', () => {
  it('chebyshevDistance calculates correct distance', () => {
    assert.strictEqual(chebyshevDistance(0, 0, 0, 0), 0);
    assert.strictEqual(chebyshevDistance(0, 0, 1, 0), 1);
    assert.strictEqual(chebyshevDistance(0, 0, 1, 1), 1); // Diagonal is distance 1
    assert.strictEqual(chebyshevDistance(0, 0, 2, 2), 2);
    assert.strictEqual(chebyshevDistance(0, 0, 3, 1), 3);
  });

  it('manhattanDistance calculates correct distance', () => {
    assert.strictEqual(manhattanDistance(0, 0, 0, 0), 0);
    assert.strictEqual(manhattanDistance(0, 0, 1, 0), 1);
    assert.strictEqual(manhattanDistance(0, 0, 1, 1), 2); // Manhattan: 1+1=2
    assert.strictEqual(manhattanDistance(0, 0, 2, 3), 5);
  });

  it('getTilesAtDistance1 returns 8 tiles', () => {
    const tiles = getTilesAtDistance1(5, 5);
    assert.strictEqual(tiles.length, 8);

    // Check all expected positions
    const expected = [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ];

    for (const exp of expected) {
      const found = tiles.find((t) => t.x === exp.x && t.y === exp.y);
      assert.ok(found, `Expected tile at (${exp.x}, ${exp.y})`);
    }
  });

  it('getTilesAtDistance2 returns 20 tiles', () => {
    const tiles = getTilesAtDistance2(5, 5);
    assert.strictEqual(tiles.length, 20);
  });
});

// ===== MAP GENERATION TESTS =====

describe('Map generation', () => {
  it('generates map with correct dimensions', () => {
    const map = generateMap(25, 15);
    assert.strictEqual(map.width, 25);
    assert.strictEqual(map.height, 15);
    assert.strictEqual(map.tiles.length, 25 * 15);
  });

  it('places monument at center', () => {
    const map = generateMap(25, 15);
    const centerX = Math.floor(25 / 2);
    const centerY = Math.floor(15 / 2);

    const monumentTile = map.tiles.find((t) => t.x === centerX && t.y === centerY);
    assert.strictEqual(monumentTile.type, TERRAIN.MONUMENT);
  });

  it('creates two starting cities', () => {
    const map = generateMap(25, 15);
    assert.strictEqual(map.cities.length, 2);
    assert.strictEqual(map.cities[0].owner, 0);
    assert.strictEqual(map.cities[1].owner, 1);
  });

  it('generates deterministic map with same seed', () => {
    const map1 = generateMap(15, 10, 12345);
    const map2 = generateMap(15, 10, 12345);

    assert.deepStrictEqual(map1.tiles, map2.tiles);
  });
});

// ===== INITIAL STATE TESTS =====

describe('Initial state creation', () => {
  it('creates standard mode state correctly', () => {
    const state = createInitialState({ mode: MODES.STANDARD });

    assert.strictEqual(state.turn, 1);
    assert.strictEqual(state.maxTurns, 200);
    assert.strictEqual(state.map.width, 25);
    assert.strictEqual(state.map.height, 15);
    assert.strictEqual(state.players[0].gold, 20);
    assert.strictEqual(state.players[1].gold, 20);
  });

  it('creates blitz mode state correctly', () => {
    const state = createInitialState({ mode: MODES.BLITZ });

    assert.strictEqual(state.maxTurns, 50);
    assert.strictEqual(state.map.width, 15);
    assert.strictEqual(state.map.height, 10);
    assert.strictEqual(state.players[0].gold, 50);
    assert.strictEqual(state.players[1].gold, 50);
  });

  it('starts with no units', () => {
    const state = createInitialState({ mode: MODES.BLITZ });
    assert.strictEqual(state.units.length, 0);
  });
});

// ===== VALIDATION TESTS =====

describe('Action validation', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  describe('MOVE validation', () => {
    it('validates valid move', () => {
      state.units.push({
        x: 2,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 2,
        from_y: 5,
        to_x: 3,
        to_y: 5,
      });

      assert.ok(result.valid);
    });

    it('rejects move from empty tile', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 3,
        from_y: 3,
        to_x: 4,
        to_y: 3,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('No unit'));
    });

    it('rejects move of enemy unit', () => {
      state.units.push({
        x: 2,
        y: 5,
        owner: 1,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 2,
        from_y: 5,
        to_x: 3,
        to_y: 5,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('another player'));
    });

    it('rejects move to occupied tile', () => {
      state.units.push(
        { x: 2, y: 5, owner: 0, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true },
        { x: 3, y: 5, owner: 0, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true }
      );

      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 2,
        from_y: 5,
        to_x: 3,
        to_y: 5,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('occupied'));
    });

    it('rejects move to impassable terrain', () => {
      state.units.push({
        x: 1,
        y: 1,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 1,
        from_y: 1,
        to_x: 0,
        to_y: 1,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('not passable'));
    });

    it('rejects move exceeding movement distance', () => {
      state.units.push({
        x: 2,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 2,
        from_y: 5,
        to_x: 4,
        to_y: 5,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('exceeds'));
    });

    it('allows raider to move 2 tiles', () => {
      state.units.push({
        x: 2,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.RAIDER,
        hp: 1,
        canMove: true,
      });

      const result = validateAction(state, 0, {
        action: ACTIONS.MOVE,
        from_x: 2,
        from_y: 5,
        to_x: 4,
        to_y: 5,
      });

      assert.ok(result.valid);
    });
  });

  describe('BUILD_UNIT validation', () => {
    it('validates valid unit build', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.BUILD_UNIT,
        city_x: 1,
        city_y: 5,
        unit_type: UNIT_TYPES.SOLDIER,
      });

      assert.ok(result.valid);
    });

    it('rejects build at non-existent city', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.BUILD_UNIT,
        city_x: 5,
        city_y: 5,
        unit_type: UNIT_TYPES.SOLDIER,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('No city'));
    });

    it('rejects build at enemy city', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.BUILD_UNIT,
        city_x: 8,
        city_y: 5,
        unit_type: UNIT_TYPES.SOLDIER,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('another player'));
    });

    it('rejects build when city blocked', () => {
      state.units.push({
        x: 1,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const result = validateAction(state, 0, {
        action: ACTIONS.BUILD_UNIT,
        city_x: 1,
        city_y: 5,
        unit_type: UNIT_TYPES.SOLDIER,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('blocked'));
    });

    it('rejects build with insufficient gold', () => {
      state.players[0].gold = 10;

      const result = validateAction(state, 0, {
        action: ACTIONS.BUILD_UNIT,
        city_x: 1,
        city_y: 5,
        unit_type: UNIT_TYPES.SOLDIER,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('Not enough gold'));
    });
  });

  describe('EXPAND_TERRITORY validation', () => {
    it('validates valid expansion', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.EXPAND_TERRITORY,
        x: 3,
        y: 5,
      });

      assert.ok(result.valid);
    });

    it('rejects expansion to already owned tile', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.EXPAND_TERRITORY,
        x: 2,
        y: 5,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('already owned'));
    });

    it('rejects expansion not adjacent to territory', () => {
      const result = validateAction(state, 0, {
        action: ACTIONS.EXPAND_TERRITORY,
        x: 5,
        y: 3,
      });

      assert.ok(!result.valid);
      assert.ok(result.error.includes('not adjacent'));
    });
  });
});

// ===== ZONE OF CONTROL TESTS =====

describe('Zone of Control', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  it('soldier traps raider within 2 tiles', () => {
    // Enemy soldier at (5, 3)
    state.units.push({
      x: 5,
      y: 3,
      owner: 1,
      type: UNIT_TYPES.SOLDIER,
      hp: 3,
      canMove: true,
    });

    // Friendly raider at (5, 5) - within 2 tiles
    const raider = {
      x: 5,
      y: 5,
      owner: 0,
      type: UNIT_TYPES.RAIDER,
      hp: 1,
      canMove: true,
    };
    state.units.push(raider);

    assert.ok(isInZoC(state, raider));
  });

  it('soldier does not trap other soldiers', () => {
    state.units.push({
      x: 5,
      y: 3,
      owner: 1,
      type: UNIT_TYPES.SOLDIER,
      hp: 3,
      canMove: true,
    });

    const soldier = {
      x: 5,
      y: 5,
      owner: 0,
      type: UNIT_TYPES.SOLDIER,
      hp: 3,
      canMove: true,
    };
    state.units.push(soldier);

    assert.ok(!isInZoC(state, soldier));
  });

  it('raider outside ZoC range can move', () => {
    state.units.push({
      x: 5,
      y: 3,
      owner: 1,
      type: UNIT_TYPES.SOLDIER,
      hp: 3,
      canMove: true,
    });

    // Raider at (5, 6) - 3 tiles away
    const raider = {
      x: 5,
      y: 6,
      owner: 0,
      type: UNIT_TYPES.RAIDER,
      hp: 1,
      canMove: true,
    };
    state.units.push(raider);

    assert.ok(!isInZoC(state, raider));
  });
});

// ===== TURN PROCESSING TESTS =====

describe('Turn processing', () => {
  let state;

  beforeEach(() => {
    state = createTestState();
  });

  describe('Income phase', () => {
    it('collects gold from territory and cities', () => {
      const initialGold = state.players[0].gold;
      const { newState } = processTurn(state, { player0: [], player1: [] });

      // Player 0 has 6 field tiles + 1 city = 0.5*6 + 5 = 8 income
      assert.ok(newState.players[0].gold > initialGold);
    });
  });

  describe('Archer phase', () => {
    it('archer shoots nearest enemy', () => {
      state.units.push(
        { x: 2, y: 5, owner: 0, type: UNIT_TYPES.ARCHER, hp: 2, canMove: true },
        { x: 4, y: 5, owner: 1, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true }
      );

      const { newState, info } = processTurn(state, { player0: [], player1: [] });

      // Enemy should have taken 1 damage
      const enemy = newState.units.find((u) => u.owner === 1);
      assert.strictEqual(enemy.hp, 2);

      // Archer should be marked as unable to move
      const archer = newState.units.find((u) => u.type === UNIT_TYPES.ARCHER);
      assert.ok(archer.canMove); // Reset at end of turn for next turn

      // Check combat event
      const combatEvent = info.turnEvents.find((e) => e.type === 'COMBAT');
      assert.ok(combatEvent);
      assert.strictEqual(combatEvent.data.phase, 'archer');
    });

    it('archer prioritizes lowest HP on tie', () => {
      state.units.push(
        { x: 3, y: 5, owner: 0, type: UNIT_TYPES.ARCHER, hp: 2, canMove: true },
        { x: 4, y: 4, owner: 1, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true },
        { x: 4, y: 6, owner: 1, type: UNIT_TYPES.SOLDIER, hp: 2, canMove: true }
      );

      const { newState } = processTurn(state, { player0: [], player1: [] });

      // Lower HP soldier (at 4,6) should be targeted
      const lowHpSoldier = newState.units.find((u) => u.x === 4 && u.y === 6);
      assert.strictEqual(lowHpSoldier.hp, 1);

      const highHpSoldier = newState.units.find((u) => u.x === 4 && u.y === 4);
      assert.strictEqual(highHpSoldier.hp, 3);
    });
  });

  describe('Movement phase', () => {
    it('processes valid move', () => {
      state.units.push({
        x: 2,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const { newState } = processTurn(state, {
        player0: [{ action: ACTIONS.MOVE, from_x: 2, from_y: 5, to_x: 3, to_y: 5 }],
        player1: [],
      });

      const unit = newState.units.find((u) => u.owner === 0);
      assert.strictEqual(unit.x, 3);
      assert.strictEqual(unit.y, 5);
    });

    it('raiding enemy territory makes it neutral', () => {
      state.units.push({
        x: 6,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const { newState, info } = processTurn(state, {
        player0: [{ action: ACTIONS.MOVE, from_x: 6, from_y: 5, to_x: 7, to_y: 5 }],
        player1: [],
      });

      const raidedTile = newState.map.tiles.find((t) => t.x === 7 && t.y === 5);
      assert.strictEqual(raidedTile.owner, null);

      const captureEvent = info.turnEvents.find((e) => e.type === 'CAPTURE');
      assert.ok(captureEvent);
    });
  });

  describe('Combat phase', () => {
    it('soldiers auto-attack adjacent enemies', () => {
      state.units.push(
        { x: 3, y: 5, owner: 0, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true },
        { x: 4, y: 5, owner: 1, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true }
      );

      const { newState, info } = processTurn(state, { player0: [], player1: [] });

      // Both should have taken damage (simultaneous)
      const unit0 = newState.units.find((u) => u.owner === 0);
      const unit1 = newState.units.find((u) => u.owner === 1);

      assert.strictEqual(unit0.hp, 2);
      assert.strictEqual(unit1.hp, 2);
    });

    it('killing unit awards kill bonus', () => {
      state.units.push(
        { x: 3, y: 5, owner: 0, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true },
        { x: 4, y: 5, owner: 1, type: UNIT_TYPES.RAIDER, hp: 1, canMove: true }
      );

      const { newState, info } = processTurn(state, { player0: [], player1: [] });

      // Raider should be dead
      assert.strictEqual(newState.units.filter((u) => u.owner === 1).length, 0);

      // Check for kill score (7 instead of 5)
      const combatEvent = info.turnEvents.find((e) => e.type === 'COMBAT' && e.data.isKill);
      assert.ok(combatEvent);
      assert.strictEqual(combatEvent.data.scoreGain, SCORING.KILL_BONUS);

      // Death bonus should go to raider owner
      const deathEvent = info.turnEvents.find((e) => e.type === 'DEATH');
      assert.ok(deathEvent);
      assert.strictEqual(deathEvent.data.deathScore, UNIT_STATS[UNIT_TYPES.RAIDER].deathScore);
    });
  });

  describe('Build phase', () => {
    it('builds unit at city', () => {
      const { newState } = processTurn(state, {
        player0: [
          { action: ACTIONS.BUILD_UNIT, city_x: 1, city_y: 5, unit_type: UNIT_TYPES.SOLDIER },
        ],
        player1: [],
      });

      const newUnit = newState.units.find((u) => u.x === 1 && u.y === 5);
      assert.ok(newUnit);
      assert.strictEqual(newUnit.type, UNIT_TYPES.SOLDIER);
      assert.strictEqual(newUnit.owner, 0);
      assert.strictEqual(newUnit.hp, 3);

      // Gold should be deducted
      assert.strictEqual(newState.players[0].gold, state.players[0].gold + 8 - 20); // +income -cost
    });

    it('expands territory', () => {
      const { newState } = processTurn(state, {
        player0: [{ action: ACTIONS.EXPAND_TERRITORY, x: 3, y: 5 }],
        player1: [],
      });

      const tile = newState.map.tiles.find((t) => t.x === 3 && t.y === 5);
      assert.strictEqual(tile.owner, 0);

      // Gold deducted
      assert.strictEqual(newState.players[0].gold, state.players[0].gold + 8 - 5);
    });
  });

  describe('Scoring phase', () => {
    it('awards monument control to adjacent unit owner', () => {
      state.units.push({
        x: 5,
        y: 4,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const { newState, info } = processTurn(state, { player0: [], player1: [] });

      assert.strictEqual(newState.monument.controlledBy, 0);

      const monumentEvent = info.turnEvents.find((e) => e.type === 'MONUMENT_CONTROL');
      assert.ok(monumentEvent);
    });
  });

  describe('City capture', () => {
    it('soldier captures enemy city instantly', () => {
      state.units.push({
        x: 7,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      const { newState, info } = processTurn(state, {
        player0: [{ action: ACTIONS.MOVE, from_x: 7, from_y: 5, to_x: 8, to_y: 5 }],
        player1: [],
      });

      const city = newState.cities.find((c) => c.x === 8 && c.y === 5);
      assert.strictEqual(city.owner, 0);

      const captureEvent = info.turnEvents.find((e) => e.type === 'CITY_CAPTURED');
      assert.ok(captureEvent);
    });
  });

  describe('Game end', () => {
    it('ends game when player loses all cities', () => {
      // Give player 0 a soldier next to player 1's only city
      state.units.push({
        x: 7,
        y: 5,
        owner: 0,
        type: UNIT_TYPES.SOLDIER,
        hp: 3,
        canMove: true,
      });

      // Remove player 0's city from state (to simulate they only have one)
      // Actually let's capture the enemy city
      const { newState, info } = processTurn(state, {
        player0: [{ action: ACTIONS.MOVE, from_x: 7, from_y: 5, to_x: 8, to_y: 5 }],
        player1: [],
      });

      // After capture, player 1 has no cities
      const player1Cities = newState.cities.filter((c) => c.owner === 1);
      assert.strictEqual(player1Cities.length, 0);

      // Game should be over
      assert.ok(newState.gameOver);
      assert.strictEqual(newState.winner, 0);
    });

    it('ends game at max turns with score comparison', () => {
      state.turn = 200;
      state.players[0].score = 100;
      state.players[1].score = 50;

      const { newState } = processTurn(state, { player0: [], player1: [] });

      assert.ok(newState.gameOver);
      assert.strictEqual(newState.winner, 0);
    });

    it('handles tie at max turns', () => {
      state.turn = 200;
      state.players[0].score = 100;
      state.players[1].score = 100;

      const { newState } = processTurn(state, { player0: [], player1: [] });

      assert.ok(newState.gameOver);
      assert.strictEqual(newState.winner, null);
    });
  });
});

// ===== SCORE MULTIPLIER TESTS =====

describe('Score multipliers', () => {
  it('returns 1x for early turns', () => {
    assert.strictEqual(getScoreMultiplier(1), 1);
    assert.strictEqual(getScoreMultiplier(50), 1);
    assert.strictEqual(getScoreMultiplier(100), 1);
  });

  it('returns 1.5x for mid turns', () => {
    assert.strictEqual(getScoreMultiplier(101), 1.5);
    assert.strictEqual(getScoreMultiplier(125), 1.5);
    assert.strictEqual(getScoreMultiplier(150), 1.5);
  });

  it('returns 2x for late turns', () => {
    assert.strictEqual(getScoreMultiplier(151), 2);
    assert.strictEqual(getScoreMultiplier(175), 2);
    assert.strictEqual(getScoreMultiplier(200), 2);
  });
});

describe('Monument score', () => {
  it('awards score based on total cities in the game', () => {
    const state = createTestState();
    // Place soldier adjacent to monument
    state.units = [{ x: 5, y: 4, owner: 0, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true }];
    // Test state has 2 cities by default
    assert.strictEqual(state.cities.length, 2);

    const { newState, info } = processTurn(state, { player0: [], player1: [] });

    assert.strictEqual(newState.monument.controlledBy, 0);
    const monumentEvent = info.turnEvents.find((e) => e.type === 'MONUMENT_CONTROL');
    assert.ok(monumentEvent);
    assert.strictEqual(monumentEvent.data.scoreAwarded, 2 * SCORING.MONUMENT_PER_CITY);
  });

  it('scales with more cities', () => {
    const state = createTestState();
    state.units = [{ x: 5, y: 4, owner: 0, type: UNIT_TYPES.SOLDIER, hp: 3, canMove: true }];
    // Add extra cities
    state.cities.push({ x: 3, y: 3, owner: 0 });
    state.cities.push({ x: 7, y: 7, owner: 1 });

    const { newState, info } = processTurn(state, { player0: [], player1: [] });

    const monumentEvent = info.turnEvents.find((e) => e.type === 'MONUMENT_CONTROL');
    assert.ok(monumentEvent);
    assert.strictEqual(monumentEvent.data.scoreAwarded, 4 * SCORING.MONUMENT_PER_CITY);
  });
});

// ===== IMMUTABILITY TEST =====

describe('State immutability', () => {
  it('processTurn does not modify original state', () => {
    const state = createTestState();
    const originalGold = state.players[0].gold;
    const originalTurn = state.turn;

    processTurn(state, { player0: [], player1: [] });

    assert.strictEqual(state.players[0].gold, originalGold);
    assert.strictEqual(state.turn, originalTurn);
  });
});

console.log('All tests loaded. Run with: node --test');
