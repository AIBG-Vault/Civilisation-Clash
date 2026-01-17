import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GameV2 } from '../game-v2.js';

describe('GameV2 Tests', () => {
  describe('Initialization', () => {
    it('should initialize with correct default values', () => {
      const game = new GameV2('blitz');
      game.initialize();

      assert.strictEqual(game.mode, 'blitz');
      assert.strictEqual(game.turn, 0);
      assert.strictEqual(game.maxTurns, 50);
      assert.strictEqual(game.mapWidth, 15);
      assert.strictEqual(game.mapHeight, 10);
      assert.strictEqual(game.gameOver, false);
      assert.strictEqual(game.winner, null);
    });

    it('should create teams with starting TP', () => {
      const game = new GameV2('blitz');
      game.initialize();

      assert.strictEqual(game.teams.length, 2);
      assert.strictEqual(game.teams[0].economy.territoryPoints, 20);
      assert.strictEqual(game.teams[1].economy.territoryPoints, 20);
    });

    it('should generate a map with terrain', () => {
      const game = new GameV2('blitz');
      game.initialize();

      assert.strictEqual(game.map.length, 150); // 15x10

      const fields = game.map.filter((t) => t.type === 'FIELD');
      const water = game.map.filter((t) => t.type === 'WATER');

      assert(fields.length > 0, 'Should have field tiles');
      assert(water.length > 0, 'Should have water tiles');
    });

    it('should place starting units', () => {
      const game = new GameV2('blitz');
      game.initialize();

      const team0Units = game.units.filter((u) => u.owner === 0);
      const team1Units = game.units.filter((u) => u.owner === 1);

      assert.strictEqual(team0Units.length, 3, 'Team 0 should start with 3 units');
      assert.strictEqual(team1Units.length, 3, 'Team 1 should start with 3 units');
    });
  });

  describe('Territory Mechanics', () => {
    it('soldiers should REMOVE enemy territory by moving onto it', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Find a soldier and set an adjacent tile to enemy territory
      const soldier = game.units.find((u) => u.owner === 0);
      const enemyTile = game.map.find(
        (t) => t.type === 'FIELD' && Math.abs(t.x - soldier.x) === 1 && t.y === soldier.y
      );

      if (enemyTile) {
        // Set tile to enemy territory
        enemyTile.owner = 1;

        const actions = [
          {
            type: 'MOVE',
            unitId: soldier.id,
            targetX: enemyTile.x,
            targetY: enemyTile.y,
          },
        ];

        game.processActions(actions, []);

        // Tile should now be neutral (enemy territory removed)
        const tileAfter = game.getTile(enemyTile.x, enemyTile.y);
        assert.strictEqual(
          tileAfter.owner,
          null,
          'Enemy territory should be removed and become neutral'
        );

        // Verify soldier moved
        const soldierAfter = game.units.find((u) => u.id === soldier.id);
        assert.strictEqual(soldierAfter.x, enemyTile.x, 'Soldier should have moved');
      }
    });

    it('should allow territorial expansion for 5 TP', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Give team extra TP for testing
      game.teams[0].economy.territoryPoints = 25;

      // Find an owned tile and an adjacent neutral tile
      const ownedTile = game.map.find((t) => t.owner === 0);
      const adjacentNeutral = game.map.find(
        (t) =>
          t.owner === null &&
          t.type === 'FIELD' &&
          Math.abs(t.x - ownedTile.x) + Math.abs(t.y - ownedTile.y) === 1
      );

      if (adjacentNeutral) {
        const actions = [
          {
            type: 'EXPAND_TERRITORY',
            x: adjacentNeutral.x,
            y: adjacentNeutral.y,
          },
        ];

        const initialTP = game.teams[0].economy.territoryPoints;
        game.processActions(actions, []);

        // Check tile is now owned
        const tileAfter = game.getTile(adjacentNeutral.x, adjacentNeutral.y);
        assert.strictEqual(tileAfter.owner, 0, 'Tile should be owned after expansion');

        // Check TP was spent (accounting for income collected at turn start)
        const expectedTP = initialTP - 5 + game.teams[0].economy.income;
        assert.strictEqual(
          game.teams[0].economy.territoryPoints,
          expectedTP,
          'Should cost 5 TP to expand territory (after accounting for income)'
        );
      }
    });

    it('should not allow expansion without sufficient TP', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Set low TP
      game.teams[0].economy.territoryPoints = 4;

      const ownedTile = game.map.find((t) => t.owner === 0);
      const adjacentNeutral = game.map.find(
        (t) =>
          t.owner === null &&
          t.type === 'FIELD' &&
          Math.abs(t.x - ownedTile.x) + Math.abs(t.y - ownedTile.y) === 1
      );

      if (adjacentNeutral) {
        const actions = [
          {
            type: 'EXPAND_TERRITORY',
            x: adjacentNeutral.x,
            y: adjacentNeutral.y,
          },
        ];

        const result = game.processActions(actions, []);

        // Tile should remain neutral
        const tileAfter = game.getTile(adjacentNeutral.x, adjacentNeutral.y);
        assert.strictEqual(
          tileAfter.owner,
          null,
          'Tile should remain neutral without sufficient TP'
        );

        // Should have error
        assert(
          result.errors.some((e) => e.reason.includes('Insufficient TP')),
          'Should have insufficient TP error'
        );
      }
    });

    it('should only allow expansion to adjacent tiles', () => {
      const game = new GameV2('blitz');
      game.initialize();

      game.teams[0].economy.territoryPoints = 25;

      // Find a non-adjacent neutral tile
      const ownedTile = game.map.find((t) => t.owner === 0);
      const farTile = game.map.find(
        (t) =>
          t.owner === null &&
          t.type === 'FIELD' &&
          Math.abs(t.x - ownedTile.x) + Math.abs(t.y - ownedTile.y) > 2
      );

      if (farTile) {
        const actions = [
          {
            type: 'EXPAND_TERRITORY',
            x: farTile.x,
            y: farTile.y,
          },
        ];

        const result = game.processActions(actions, []);

        // Tile should remain neutral
        const tileAfter = game.getTile(farTile.x, farTile.y);
        assert.strictEqual(tileAfter.owner, null, 'Far tile should remain neutral');

        // Should have error
        assert(
          result.errors.some((e) => e.reason.includes('adjacent')),
          'Should have adjacency error'
        );
      }
    });

    it('should not allow expanding to enemy territory', () => {
      const game = new GameV2('blitz');
      game.initialize();

      game.teams[0].economy.territoryPoints = 25;

      // Find an owned tile and set an adjacent one to enemy
      const ownedTile = game.map.find((t) => t.owner === 0);
      const adjacentTile = game.map.find(
        (t) => t.type === 'FIELD' && Math.abs(t.x - ownedTile.x) + Math.abs(t.y - ownedTile.y) === 1
      );

      if (adjacentTile) {
        // Set it to enemy territory
        adjacentTile.owner = 1;

        const actions = [
          {
            type: 'EXPAND_TERRITORY',
            x: adjacentTile.x,
            y: adjacentTile.y,
          },
        ];

        const result = game.processActions(actions, []);

        // Tile should remain enemy's
        const tileAfter = game.getTile(adjacentTile.x, adjacentTile.y);
        assert.strictEqual(tileAfter.owner, 1, 'Enemy tile should remain enemy territory');

        // Should have error
        assert(
          result.errors.some(
            (e) => e.reason.includes('neutral') || e.reason.includes('already owned')
          ),
          'Should have error about not being neutral'
        );
      }
    });

    it('should ALLOW chaining territory expansions in one turn', () => {
      const game = new GameV2('blitz');
      game.initialize();

      game.teams[0].economy.territoryPoints = 25;

      // Find two adjacent neutral tiles in a line from owned territory
      const ownedTile = game.map.find((t) => t.owner === 0);
      const firstNeutral = game.map.find(
        (t) =>
          t.owner === null &&
          t.type === 'FIELD' &&
          Math.abs(t.x - ownedTile.x) + Math.abs(t.y - ownedTile.y) === 1
      );

      if (firstNeutral) {
        // Find a tile adjacent to firstNeutral but not to ownedTile
        const secondNeutral = game.map.find(
          (t) =>
            t.owner === null &&
            t.type === 'FIELD' &&
            Math.abs(t.x - firstNeutral.x) + Math.abs(t.y - firstNeutral.y) === 1 &&
            Math.abs(t.x - ownedTile.x) + Math.abs(t.y - ownedTile.y) > 1
        );

        if (secondNeutral) {
          // Try to expand to both in one turn
          const actions = [
            {
              type: 'EXPAND_TERRITORY',
              x: firstNeutral.x,
              y: firstNeutral.y,
            },
            {
              type: 'EXPAND_TERRITORY',
              x: secondNeutral.x,
              y: secondNeutral.y,
            },
          ];

          const result = game.processActions(actions, []);

          // First should succeed
          const firstTileAfter = game.getTile(firstNeutral.x, firstNeutral.y);
          assert.strictEqual(firstTileAfter.owner, 0, 'First tile should be owned');

          // Second should ALSO succeed (chaining is allowed)
          const secondTileAfter = game.getTile(secondNeutral.x, secondNeutral.y);
          assert.strictEqual(
            secondTileAfter.owner,
            0,
            'Second tile should ALSO be owned (chaining allowed)'
          );

          // Should cost 10 TP total
          assert.strictEqual(
            game.teams[0].economy.territoryPoints,
            15 + game.teams[0].economy.income,
            'Should have spent 10 TP for two expansions'
          );
        }
      }
    });
  });

  describe('Economy System', () => {
    it('should calculate income from controlled territory', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Clear existing ownership first
      game.map.forEach((tile) => {
        tile.owner = null;
      });

      // Manually set some territory
      let fieldsOwned = 0;
      for (let i = 0; i < 10; i++) {
        if (game.map[i].type === 'FIELD') {
          game.map[i].owner = 0;
          fieldsOwned++;
        }
      }

      const income = game.teams[0].economy.calculateIncome(game.map);
      assert.strictEqual(income, fieldsOwned * 0.5, 'Income should be 0.5 TP per field');
    });

    it('should collect income at turn start', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Set some territory
      for (let i = 0; i < 4; i++) {
        if (game.map[i].type === 'FIELD') {
          game.map[i].owner = 0;
        }
      }

      const initialTP = game.teams[0].economy.territoryPoints;
      game.processActions([], []); // Process turn to collect income

      assert(game.teams[0].economy.territoryPoints > initialTP, 'TP should increase from income');
    });

    it('should cost 20 TP to build a soldier', () => {
      const game = new GameV2('blitz');
      game.initialize();

      const validTile = game.map.find(
        (t) =>
          t.owner === 0 && t.type === 'FIELD' && !game.units.some((u) => u.x === t.x && u.y === t.y)
      );

      if (validTile) {
        const initialTP = game.teams[0].economy.territoryPoints;
        const initialUnits = game.units.filter((u) => u.owner === 0).length;

        const actions = [
          {
            type: 'BUILD_UNIT',
            unitType: 'SOLDIER',
            x: validTile.x,
            y: validTile.y,
          },
        ];

        game.processActions(actions, []);

        assert.strictEqual(
          game.teams[0].economy.territoryPoints,
          initialTP - 20,
          'Building soldier should cost 20 TP'
        );

        assert.strictEqual(
          game.units.filter((u) => u.owner === 0).length,
          initialUnits + 1,
          'Should have one more unit'
        );
      }
    });
  });

  describe('Movement', () => {
    it('should only allow movement to adjacent tiles', () => {
      const game = new GameV2('blitz');
      game.initialize();

      const unit = game.units[0];

      // Try to move 2 tiles away
      const actions = [
        {
          type: 'MOVE',
          unitId: unit.id,
          targetX: unit.x + 2,
          targetY: unit.y,
        },
      ];

      const result = game.processActions(actions, []);

      assert(
        result.errors.some((e) => e.reason.includes('adjacent')),
        'Should error on non-adjacent movement'
      );
    });

    it('should not allow movement to impassable terrain', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Create a water tile next to a unit
      const unit = game.units[0];
      const waterIndex = unit.y * game.mapWidth + (unit.x + 1);
      if (waterIndex < game.map.length) {
        game.map[waterIndex].type = 'WATER';

        const actions = [
          {
            type: 'MOVE',
            unitId: unit.id,
            targetX: unit.x + 1,
            targetY: unit.y,
          },
        ];

        const result = game.processActions(actions, []);

        assert(
          result.errors.some((e) => e.reason.includes('not passable')),
          'Should error on water movement'
        );
      }
    });

    it('should not allow movement to occupied tiles', () => {
      const game = new GameV2('blitz');
      game.initialize();

      const unit1 = game.units[0];
      const unit2 = game.units[1];

      // Try to move unit1 to unit2's position
      const actions = [
        {
          type: 'MOVE',
          unitId: unit1.id,
          targetX: unit2.x,
          targetY: unit2.y,
        },
      ];

      const result = game.processActions(actions, []);

      assert(
        result.errors.some((e) => e.reason.includes('occupied')),
        'Should error on occupied tile movement'
      );
    });
  });

  describe('Combat', () => {
    it('should deal damage to adjacent enemies', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Place two enemy units adjacent
      game.units[0].x = 5;
      game.units[0].y = 5;
      game.units[0].owner = 0;
      game.units[0].hp = 3;

      game.units[3].x = 6;
      game.units[3].y = 5;
      game.units[3].owner = 1;
      game.units[3].hp = 3;

      game.processActions([], []);

      assert.strictEqual(game.units[0].hp, 2, 'Unit 0 should take 1 damage');
      assert.strictEqual(game.units[3].hp, 2, 'Unit 3 should take 1 damage');
    });

    it('should remove dead units', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Set a unit to 1 HP
      game.units[0].hp = 1;
      game.units[0].x = 5;
      game.units[0].y = 5;

      // Place enemy adjacent
      game.units[3].x = 6;
      game.units[3].y = 5;
      game.units[3].owner = 1;

      const initialCount = game.units.length;
      game.processActions([], []);

      assert.strictEqual(game.units.length, initialCount - 1, 'Dead unit should be removed');
      assert(!game.units.some((u) => u.hp <= 0), 'No units should have 0 or less HP');
    });
  });

  describe('Game End Conditions', () => {
    it('should end game at turn limit', () => {
      const game = new GameV2('blitz');
      game.initialize();
      game.turn = 49;

      assert.strictEqual(game.gameOver, false);

      game.processActions([], []);

      assert.strictEqual(game.gameOver, true, 'Game should end at turn 50');
      assert.strictEqual(game.turn, 50);
    });

    it('should end game when one team has no units', () => {
      const game = new GameV2('blitz');
      game.initialize();

      // Remove all team 1 units
      game.units = game.units.filter((u) => u.owner === 0);

      game.processActions([], []);

      assert.strictEqual(game.gameOver, true, 'Game should end when team has no units');
      assert.strictEqual(game.winner, 0, 'Team 0 should win');
    });

    it('should determine winner by territory at turn limit', () => {
      const game = new GameV2('blitz');
      game.initialize();
      game.turn = 49;

      // Give team 1 more territory
      let team0Territory = 0;
      let team1Territory = 0;

      game.map.forEach((tile, index) => {
        if (tile.type === 'FIELD') {
          if (index < 30) {
            tile.owner = 0;
            team0Territory++;
          } else if (index < 70) {
            tile.owner = 1;
            team1Territory++;
          }
        }
      });

      game.processActions([], []);

      assert.strictEqual(game.gameOver, true);
      assert.strictEqual(game.winner, team1Territory > team0Territory ? 1 : 0);
    });
  });
});
