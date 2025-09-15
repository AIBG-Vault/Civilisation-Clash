import { Game } from '../game.js';
import assert from 'node:assert';
import { test, describe } from 'node:test';

describe('Basic Game Logic', () => {
  test('initializes with correct setup', () => {
    const game = new Game();
    assert.strictEqual(game.units.length, 6);
    assert.strictEqual(game.turn, 0);
    assert.strictEqual(game.width, 15);
    assert.strictEqual(game.height, 10);
    assert.strictEqual(game.maxTurns, 50);
    assert.strictEqual(game.gameOver, false);
    assert.strictEqual(game.winner, null);
  });

  test('units can move one tile', () => {
    const game = new Game();
    const unit1Before = game.units.find((u) => u.id === 1);
    const startX = unit1Before.x;
    const startY = unit1Before.y;

    game.processActions([{ type: 'MOVE', unitId: 1, targetX: startX + 1, targetY: startY }], []);

    const unit1After = game.units.find((u) => u.id === 1);
    assert.strictEqual(unit1After.x, startX + 1);
    assert.strictEqual(unit1After.y, startY);
  });

  test('invalid moves are ignored', () => {
    const game = new Game();
    const unit1Before = game.units.find((u) => u.id === 1);
    const startX = unit1Before.x;
    const startY = unit1Before.y;

    // Try to move 2 tiles (invalid)
    game.processActions([{ type: 'MOVE', unitId: 1, targetX: startX + 2, targetY: startY }], []);

    const unit1After = game.units.find((u) => u.id === 1);
    assert.strictEqual(unit1After.x, startX); // Didn't move
    assert.strictEqual(unit1After.y, startY);
  });

  test('units cannot move out of bounds', () => {
    const game = new Game();
    const unit1 = game.units.find((u) => u.id === 1);

    // Try to move out of bounds
    game.processActions([{ type: 'MOVE', unitId: 1, targetX: -1, targetY: unit1.y }], []);

    const unit1After = game.units.find((u) => u.id === 1);
    assert.strictEqual(unit1After.x, unit1.x); // Didn't move
  });

  test('units cannot move to occupied tiles', () => {
    const game = new Game();

    // Place two units next to each other
    game.units[0].x = 5;
    game.units[0].y = 5;
    game.units[1].x = 6;
    game.units[1].y = 5;

    // Try to move unit 1 onto unit 2's position
    game.processActions([{ type: 'MOVE', unitId: 1, targetX: 6, targetY: 5 }], []);

    const unit1 = game.units.find((u) => u.id === 1);
    assert.strictEqual(unit1.x, 5); // Didn't move
    assert.strictEqual(unit1.y, 5);
  });

  test('adjacent enemy units fight and take damage', () => {
    const game = new Game();

    // Place enemy units adjacent
    game.units[0].x = 7; // Team 0 unit
    game.units[0].y = 5;
    game.units[3].x = 8; // Team 1 unit
    game.units[3].y = 5;

    const unit1HpBefore = game.units[0].hp;
    const unit2HpBefore = game.units[3].hp;

    game.processActions([], []); // No actions, just process combat

    const unit1 = game.units.find((u) => u.id === 1);
    const unit4 = game.units.find((u) => u.id === 4);

    assert.strictEqual(unit1.hp, unit1HpBefore - 1);
    assert.strictEqual(unit4.hp, unit2HpBefore - 1);
  });

  test('dead units are removed', () => {
    const game = new Game();

    // Set a unit to 1 HP
    game.units[0].hp = 1;
    game.units[0].x = 7;
    game.units[0].y = 5;

    // Place enemy adjacent
    game.units[3].x = 8;
    game.units[3].y = 5;

    game.processActions([], []); // Combat happens

    // Unit with 0 HP should be removed
    const deadUnit = game.units.find((u) => u.id === 1);
    assert.strictEqual(deadUnit, undefined);
    assert.strictEqual(game.units.length, 5); // One unit removed
  });

  test('game ends at turn 50', () => {
    const game = new Game();
    game.turn = 49;

    assert.strictEqual(game.isOver(), false);

    game.processActions([], []);

    assert.strictEqual(game.turn, 50);
    assert.strictEqual(game.isOver(), true);
  });

  test('game ends when all units of one team are eliminated', () => {
    const game = new Game();

    // Remove all team 1 units
    game.units = game.units.filter((u) => u.owner === 0);

    assert.strictEqual(game.isOver(), false);

    game.processActions([], []);

    assert.strictEqual(game.isOver(), true);
    assert.strictEqual(game.getWinner(), 0); // Team 0 wins
  });

  test('game results in tie when both teams eliminated', () => {
    const game = new Game();

    // Leave one unit per team at 1 HP, adjacent
    game.units = [
      { id: 1, owner: 0, type: 'SOLDIER', x: 7, y: 5, hp: 1, maxHp: 3 },
      { id: 4, owner: 1, type: 'SOLDIER', x: 8, y: 5, hp: 1, maxHp: 3 },
    ];

    game.processActions([], []); // They kill each other

    assert.strictEqual(game.isOver(), true);
    assert.strictEqual(game.getWinner(), null); // Tie
    assert.strictEqual(game.units.length, 0); // Both dead
  });

  test('turn increments correctly', () => {
    const game = new Game();

    assert.strictEqual(game.turn, 0);
    game.processActions([], []);
    assert.strictEqual(game.turn, 1);
    game.processActions([], []);
    assert.strictEqual(game.turn, 2);
  });

  test('getState returns correct game state', () => {
    const game = new Game();
    const state = game.getState();

    assert.strictEqual(state.turn, 0);
    assert.strictEqual(state.maxTurns, 50);
    assert.strictEqual(state.width, 15);
    assert.strictEqual(state.height, 10);
    assert.strictEqual(state.units.length, 6);
    assert.strictEqual(state.gameOver, false);
    assert.strictEqual(state.winner, null);
    assert.ok(Array.isArray(state.teams));
    assert.strictEqual(state.teams.length, 2);
  });

  test('winner determined by unit count at turn limit', () => {
    const game = new Game();

    // Remove one team 1 unit
    game.units = game.units.filter((u) => !(u.owner === 1 && u.id === 6));
    game.turn = 49;

    game.processActions([], []);

    assert.strictEqual(game.isOver(), true);
    assert.strictEqual(game.getWinner(), 0); // Team 0 has more units
  });

  test('actions from wrong team are ignored', () => {
    const game = new Game();
    const unit4 = game.units.find((u) => u.id === 4); // Team 1 unit
    const startX = unit4.x;

    // Team 0 tries to move Team 1's unit
    game.processActions([{ type: 'MOVE', unitId: 4, targetX: startX - 1, targetY: unit4.y }], []);

    const unit4After = game.units.find((u) => u.id === 4);
    assert.strictEqual(unit4After.x, startX); // Didn't move
  });
});
