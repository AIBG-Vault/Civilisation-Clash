// Game V2 - Enhanced with terrain, economy, and better structure

const TERRAIN_TYPES = {
  FIELD: {
    passable: true,
    controllable: true,
    income: 0.5, // TP per turn when controlled
  },
  MOUNTAIN: {
    passable: false,
    controllable: false,
    income: 0,
  },
  WATER: {
    passable: false,
    controllable: false,
    income: 0,
  },
};

const UNIT_COSTS = {
  SOLDIER: 20, // TP cost to build
};

// Export for tests
export const UNIT_TYPES = {
  SOLDIER: {
    cost: 20,
    hp: 3,
    damage: 1,
  },
};

export class Unit {
  constructor(id, type, owner, x, y) {
    this.id = id;
    this.type = type;
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.hp = UNIT_TYPES[type].hp;
    this.maxHp = UNIT_TYPES[type].hp;
    this.canMove = true;
    this.capturedThisTurn = false;
  }
}

class Economy {
  constructor(teamId) {
    this.teamId = teamId;
    this.territoryPoints = 20; // Starting TP
    this.income = 0; // TP per turn
    this.controlledTiles = new Set();
  }

  calculateIncome(map) {
    let income = 0;
    for (const tile of map) {
      if (tile.owner === this.teamId) {
        income += TERRAIN_TYPES[tile.type].income;
      }
    }
    return income;
  }

  collectIncome(map) {
    this.income = this.calculateIncome(map);
    this.territoryPoints += this.income;
  }

  canAfford(cost) {
    return this.territoryPoints >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.territoryPoints -= cost;
    return true;
  }
}

export class GameV2 {
  constructor(mode = 'blitz') {
    this.mode = mode;
    this.turn = 0;
    this.maxTurns = mode === 'blitz' ? 50 : 200;
    this.mapWidth = mode === 'blitz' ? 15 : 25;
    this.mapHeight = mode === 'blitz' ? 10 : 15;

    this.map = [];
    this.units = [];
    this.teams = [
      {
        id: 0,
        economy: new Economy(0),
      },
      {
        id: 1,
        economy: new Economy(1),
      },
    ];

    this.nextUnitId = 1;
    this.gameOver = false;
    this.winner = null;
  }

  initialize() {
    this.generateMap();
    this.placeStartingUnits();
  }

  generateMap() {
    const centerX = Math.floor(this.mapWidth / 2);
    const centerY = Math.floor(this.mapHeight / 2);

    // Create base map
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const distFromCenter = Math.abs(x - centerX) + Math.abs(y - centerY);
        const distFromEdge = Math.min(x, y, this.mapWidth - x - 1, this.mapHeight - y - 1);

        let type = 'WATER';
        if (distFromEdge > 1 && distFromCenter < (this.mapWidth + this.mapHeight) / 3) {
          // Island area
          if (Math.random() < 0.15 && distFromEdge > 2) {
            type = 'MOUNTAIN'; // 15% mountains
          } else {
            type = 'FIELD';
          }
        }

        this.map.push({
          x,
          y,
          type,
          owner: null,
          id: `${x},${y}`,
        });
      }
    }

    // Ensure symmetry (mirror across center)
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < centerX; x++) {
        const mirrorX = this.mapWidth - x - 1;
        const leftIndex = y * this.mapWidth + x;
        const rightIndex = y * this.mapWidth + mirrorX;
        this.map[rightIndex].type = this.map[leftIndex].type;
      }
    }

    // Ensure starting positions are clear fields
    const startPositions = [
      { x: 2, y: Math.floor(this.mapHeight / 2) },
      { x: this.mapWidth - 3, y: Math.floor(this.mapHeight / 2) },
    ];

    startPositions.forEach((pos, teamId) => {
      // Clear 3x3 area around start
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = pos.x + dx;
          const y = pos.y + dy;
          if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight) {
            const index = y * this.mapWidth + x;
            this.map[index].type = 'FIELD';
            if (dx === 0 && dy === 0) {
              this.map[index].owner = teamId; // Starting tile owned
            }
          }
        }
      }
    });
  }

  placeStartingUnits() {
    const startPositions = [
      { x: 2, y: Math.floor(this.mapHeight / 2) },
      { x: this.mapWidth - 3, y: Math.floor(this.mapHeight / 2) },
    ];

    // Each team starts with 3 soldiers
    startPositions.forEach((pos, teamId) => {
      // Place main soldier at center
      this.createUnit(pos.x, pos.y, teamId, 'SOLDIER');

      // Place two more soldiers nearby
      const offsets = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
      ];
      offsets.forEach((offset) => {
        const x = pos.x + offset.dx;
        const y = pos.y + offset.dy;
        if (this.isTileValid(x, y) && this.getTile(x, y).type === 'FIELD') {
          this.createUnit(x, y, teamId, 'SOLDIER');
        }
      });
    });
  }

  createUnit(x, y, owner, type) {
    const unit = {
      id: this.nextUnitId++,
      x,
      y,
      owner,
      type,
      hp: 3,
      maxHp: 3,
      canMove: true,
      capturedThisTurn: false,
    };
    this.units.push(unit);
    return unit;
  }

  processActions(team0Actions, team1Actions) {
    if (this.gameOver) return { success: false, errors: [] };

    this.turn++;
    const errors = [];

    // Income phase
    this.teams[0].economy.collectIncome(this.map);
    this.teams[1].economy.collectIncome(this.map);

    // No longer tracking turn-start territory - chaining is allowed

    // Process actions for each team
    this.processTeamActions(0, team0Actions, errors);
    this.processTeamActions(1, team1Actions, errors);

    // Combat phase - adjacent units fight
    this.processCombat();

    // Remove dead units
    this.units = this.units.filter((u) => u.hp > 0);

    // Reset unit flags
    this.units.forEach((unit) => {
      unit.canMove = true;
      unit.capturedThisTurn = false;
    });

    // Check game over
    this.checkGameOver();

    return { success: true, errors };
  }

  processTeamActions(teamId, actions, errors) {
    if (!actions || !Array.isArray(actions)) return;

    actions.forEach((action) => {
      try {
        switch (action.type) {
          case 'MOVE':
            this.processMoveAction(teamId, action, errors);
            break;
          case 'BUILD_UNIT':
            this.processBuildAction(teamId, action, errors);
            break;
          case 'EXPAND_TERRITORY':
            this.processExpandTerritoryAction(teamId, action, errors);
            break;
          case 'PASS':
            // No-op, used for manual play when timeout disabled
            break;
          default:
            errors.push({
              teamId,
              action,
              reason: `Unknown action type: ${action.type}`,
            });
        }
      } catch (err) {
        errors.push({
          teamId,
          action,
          reason: err.message,
        });
      }
    });
  }

  processMoveAction(teamId, action, errors) {
    const unit = this.units.find((u) => u.id === action.unitId && u.owner === teamId);
    if (!unit) {
      errors.push({ teamId, action, reason: 'Unit not found or not owned' });
      return;
    }

    if (!unit.canMove) {
      errors.push({ teamId, action, reason: 'Unit cannot move this turn' });
      return;
    }

    // Check if move is valid (adjacent tile)
    const dx = Math.abs(action.targetX - unit.x);
    const dy = Math.abs(action.targetY - unit.y);
    if (dx + dy !== 1) {
      errors.push({ teamId, action, reason: 'Can only move to adjacent tiles' });
      return;
    }

    // Check if target tile is valid
    const targetTile = this.getTile(action.targetX, action.targetY);
    if (!targetTile) {
      errors.push({ teamId, action, reason: 'Target tile out of bounds' });
      return;
    }

    if (!TERRAIN_TYPES[targetTile.type].passable) {
      errors.push({ teamId, action, reason: 'Target tile is not passable' });
      return;
    }

    // Check if occupied
    const occupant = this.units.find((u) => u.x === action.targetX && u.y === action.targetY);
    if (occupant) {
      errors.push({ teamId, action, reason: 'Target tile is occupied' });
      return;
    }

    // Move unit
    unit.x = action.targetX;
    unit.y = action.targetY;

    // Soldiers remove enemy territory when they move onto it
    if (
      targetTile.owner !== null &&
      targetTile.owner !== teamId &&
      TERRAIN_TYPES[targetTile.type].controllable
    ) {
      targetTile.owner = null; // Remove enemy territory, making it neutral
    }
  }

  processBuildAction(teamId, action, errors) {
    const team = this.teams[teamId];

    if (!team.economy.canAfford(UNIT_COSTS[action.unitType])) {
      errors.push({ teamId, action, reason: 'Insufficient TP' });
      return;
    }

    const tile = this.getTile(action.x, action.y);
    if (!tile) {
      errors.push({ teamId, action, reason: 'Invalid build location' });
      return;
    }

    if (tile.owner !== teamId) {
      errors.push({ teamId, action, reason: 'Must build on your territory' });
      return;
    }

    if (!TERRAIN_TYPES[tile.type].passable) {
      errors.push({ teamId, action, reason: 'Cannot build on this terrain' });
      return;
    }

    const occupant = this.units.find((u) => u.x === action.x && u.y === action.y);
    if (occupant) {
      errors.push({ teamId, action, reason: 'Tile is occupied' });
      return;
    }

    // Build unit
    team.economy.spend(UNIT_COSTS[action.unitType]);
    this.createUnit(action.x, action.y, teamId, action.unitType);
  }

  processExpandTerritoryAction(teamId, action, errors) {
    const team = this.teams[teamId];
    const EXPANSION_COST = 5;

    // Check if team has enough TP
    if (!team.economy.canAfford(EXPANSION_COST)) {
      errors.push({ teamId, action, reason: 'Insufficient TP for expansion (need 5 TP)' });
      return;
    }

    // Check if tile exists and is valid
    const tile = this.getTile(action.x, action.y);
    if (!tile) {
      errors.push({ teamId, action, reason: 'Invalid tile coordinates' });
      return;
    }

    // Check if tile is neutral (not owned by anyone)
    if (tile.owner !== null) {
      if (tile.owner === teamId) {
        errors.push({ teamId, action, reason: 'Tile already owned by you' });
      } else {
        errors.push({
          teamId,
          action,
          reason: 'Cannot expand to enemy territory - must be neutral',
        });
      }
      return;
    }

    // Check if tile is controllable
    if (!TERRAIN_TYPES[tile.type].controllable) {
      errors.push({ teamId, action, reason: 'Tile type cannot be controlled' });
      return;
    }

    // Check if tile is adjacent to team's CURRENT territory
    // This ALLOWS chaining expansions in a single turn
    const adjacentToTerritory = this.getAdjacentTiles(action.x, action.y).some(
      (adjTile) => adjTile.owner === teamId
    );

    if (!adjacentToTerritory) {
      errors.push({ teamId, action, reason: 'Tile must be adjacent to your territory' });
      return;
    }

    // Expand territory
    tile.owner = teamId;

    // Deduct cost
    team.economy.spend(EXPANSION_COST);
  }

  getAdjacentTiles(x, y) {
    const adjacent = [];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    for (const [dx, dy] of dirs) {
      const tile = this.getTile(x + dx, y + dy);
      if (tile) adjacent.push(tile);
    }

    return adjacent;
  }

  processCombat() {
    // Simple combat: adjacent units deal 1 damage to each other
    this.units.forEach((unit) => {
      const enemies = this.units.filter((enemy) => {
        if (enemy.owner === unit.owner) return false;
        const dx = Math.abs(enemy.x - unit.x);
        const dy = Math.abs(enemy.y - unit.y);
        return dx + dy === 1; // Adjacent
      });

      enemies.forEach((enemy) => {
        enemy.hp -= 1;
      });
    });
  }

  getTile(x, y) {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return null;
    return this.map[y * this.mapWidth + x];
  }

  isTileValid(x, y) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
  }

  checkGameOver() {
    const team0Units = this.units.filter((u) => u.owner === 0);
    const team1Units = this.units.filter((u) => u.owner === 1);

    if (team0Units.length === 0 || team1Units.length === 0 || this.turn >= this.maxTurns) {
      this.gameOver = true;

      // Determine winner
      if (team0Units.length === 0 && team1Units.length === 0) {
        this.winner = null; // Tie
      } else if (team0Units.length === 0) {
        this.winner = 1;
      } else if (team1Units.length === 0) {
        this.winner = 0;
      } else {
        // Turn limit reached - winner by territory
        const team0Territory = this.map.filter((t) => t.owner === 0).length;
        const team1Territory = this.map.filter((t) => t.owner === 1).length;

        if (team0Territory > team1Territory) {
          this.winner = 0;
        } else if (team1Territory > team0Territory) {
          this.winner = 1;
        } else {
          this.winner = null; // Tie
        }
      }
    }
  }

  getState() {
    return {
      mode: this.mode,
      turn: this.turn,
      maxTurns: this.maxTurns,
      map: this.map,
      units: this.units.map((u) => ({ ...u })),
      teams: this.teams.map((t) => ({
        id: t.id,
        territoryPoints: t.economy.territoryPoints,
        income: t.economy.income,
      })),
      gameOver: this.gameOver,
      winner: this.winner,
    };
  }

  isOver() {
    return this.gameOver;
  }

  getWinner() {
    return this.winner;
  }

  getScores() {
    const team0Territory = this.map.filter((t) => t.owner === 0).length;
    const team1Territory = this.map.filter((t) => t.owner === 1).length;

    return {
      0: {
        territory: team0Territory,
        territoryPoints: this.teams[0].economy.territoryPoints,
      },
      1: {
        territory: team1Territory,
        territoryPoints: this.teams[1].economy.territoryPoints,
      },
    };
  }
}
