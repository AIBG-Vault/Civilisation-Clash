export class Game {
  constructor() {
    this.width = 15;
    this.height = 10;
    this.turn = 0;
    this.maxTurns = 50;
    this.teams = [
      { id: 0, territoryPoints: 100 },
      { id: 1, territoryPoints: 100 },
    ];
    this.units = this.initializeUnits();
    this.gameOver = false;
    this.winner = null;
  }

  initializeUnits() {
    // Team 0 (blue) starts on left, Team 1 (red) starts on right
    return [
      { id: 1, owner: 0, type: 'SOLDIER', x: 1, y: 4, hp: 3, maxHp: 3 },
      { id: 2, owner: 0, type: 'SOLDIER', x: 1, y: 5, hp: 3, maxHp: 3 },
      { id: 3, owner: 0, type: 'SOLDIER', x: 1, y: 6, hp: 3, maxHp: 3 },
      { id: 4, owner: 1, type: 'SOLDIER', x: 13, y: 4, hp: 3, maxHp: 3 },
      { id: 5, owner: 1, type: 'SOLDIER', x: 13, y: 5, hp: 3, maxHp: 3 },
      { id: 6, owner: 1, type: 'SOLDIER', x: 13, y: 6, hp: 3, maxHp: 3 },
    ];
  }

  processActions(team0Actions, team1Actions) {
    if (this.gameOver) return;

    // Process movements for both teams
    this.processMovements(0, team0Actions || []);
    this.processMovements(1, team1Actions || []);

    // Process combat between adjacent units
    this.processCombat();

    // Remove dead units
    this.units = this.units.filter((unit) => unit.hp > 0);

    // Increment turn
    this.turn++;

    // Check win conditions
    this.checkGameOver();
  }

  processMovements(teamId, actions) {
    const moveActions = actions.filter((a) => a.type === 'MOVE');

    for (const action of moveActions) {
      const unit = this.units.find((u) => u.id === action.unitId && u.owner === teamId);

      if (!unit) continue;

      // Validate move (must be within 1 tile)
      const dx = Math.abs(action.targetX - unit.x);
      const dy = Math.abs(action.targetY - unit.y);

      if (dx + dy !== 1) continue; // Not adjacent move

      // Check bounds
      if (action.targetX < 0 || action.targetX >= this.width) continue;
      if (action.targetY < 0 || action.targetY >= this.height) continue;

      // Check if target tile is occupied
      const occupied = this.units.some((u) => u.x === action.targetX && u.y === action.targetY);

      if (!occupied) {
        unit.x = action.targetX;
        unit.y = action.targetY;
      }
    }
  }

  processCombat() {
    // Find all pairs of adjacent enemy units
    const combatPairs = [];

    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const unit1 = this.units[i];
        const unit2 = this.units[j];

        // Skip if same team
        if (unit1.owner === unit2.owner) continue;

        // Check if adjacent
        const dx = Math.abs(unit1.x - unit2.x);
        const dy = Math.abs(unit1.y - unit2.y);

        if (dx + dy === 1) {
          // They're adjacent and enemies
          combatPairs.push([unit1, unit2]);
        }
      }
    }

    // Apply damage (simultaneous)
    for (const [unit1, unit2] of combatPairs) {
      unit1.hp -= 1;
      unit2.hp -= 1;
    }
  }

  checkGameOver() {
    // Check turn limit
    if (this.turn >= this.maxTurns) {
      this.gameOver = true;
      // Winner is whoever has more units
      const team0Units = this.units.filter((u) => u.owner === 0).length;
      const team1Units = this.units.filter((u) => u.owner === 1).length;

      if (team0Units > team1Units) {
        this.winner = 0;
      } else if (team1Units > team0Units) {
        this.winner = 1;
      } else {
        this.winner = null; // Tie
      }
      return;
    }

    // Check elimination
    const team0Units = this.units.filter((u) => u.owner === 0).length;
    const team1Units = this.units.filter((u) => u.owner === 1).length;

    if (team0Units === 0 && team1Units === 0) {
      this.gameOver = true;
      this.winner = null; // Both eliminated = tie
    } else if (team0Units === 0) {
      this.gameOver = true;
      this.winner = 1;
    } else if (team1Units === 0) {
      this.gameOver = true;
      this.winner = 0;
    }
  }

  getState() {
    return {
      turn: this.turn,
      maxTurns: this.maxTurns,
      width: this.width,
      height: this.height,
      teams: this.teams,
      units: this.units.map((u) => ({ ...u })), // Clone units
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
}
