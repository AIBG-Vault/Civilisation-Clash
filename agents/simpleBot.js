/**
 * SimpleBot - A tactical bot with basic strategy
 *
 * Requires: Node.js v22.4.0+ (uses built-in WebSocket API)
 * No npm install required!
 *
 * Strategy:
 * 1. Build soldiers when TP > 20
 * 2. Expand territory to neutral tiles
 * 3. Attack enemy territory and units
 * 4. Prioritize capturing over expansion
 *
 * Usage: node simpleBot.js [teamPassword] [botName]
 */

// Helper function: get adjacent tile positions
function getAdjacentPositions(x, y, mapWidth, mapHeight) {
  const positions = [];
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];

  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
      positions.push({ x: nx, y: ny });
    }
  }

  return positions;
}

// Helper function: get possible moves for a unit
function getPossibleMoves(unit, map, units, mapWidth, mapHeight) {
  if (!unit.canMove) return [];

  const moves = [];
  const adjacent = getAdjacentPositions(unit.x, unit.y, mapWidth, mapHeight);

  for (const pos of adjacent) {
    const tile = map.find((t) => t.x === pos.x && t.y === pos.y);
    if (!tile) continue;

    // Can't move to impassable terrain
    if (tile.type === 'MOUNTAIN' || tile.type === 'WATER') continue;

    // Can't move to occupied tile
    const occupied = units.some((u) => u.x === pos.x && u.y === pos.y);
    if (occupied) continue;

    moves.push(pos);
  }

  return moves;
}

class SimpleBot {
  constructor(name = 'SimpleBot', password = 'password0') {
    this.name = name;
    this.password = password;
    this.ws = null;
    this.teamId = -1;
    this.gameState = null;
  }

  connect() {
    // Use Node.js built-in WebSocket (v22.4.0+)
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log(`${this.name}: Connecting to server...`);
      this.ws.send(
        JSON.stringify({
          type: 'AUTH',
          password: this.password,
          name: this.name,
        })
      );
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onclose = () => {
      console.log(`${this.name}: Disconnected from server`);
      process.exit(0);
    };

    this.ws.onerror = (error) => {
      console.error(`${this.name}: WebSocket error:`, error.message);
    };
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'AUTH_SUCCESS':
        this.teamId = msg.teamId;
        console.log(
          `${this.name}: Authenticated as Team ${this.teamId} (${this.teamId === 0 ? 'Blue' : 'Red'})`
        );
        console.log(`${this.name}: Ready to deploy simple tactics`);
        break;

      case 'GAME_STATE':
        this.gameState = msg.state;
        if (msg.yourTeamId >= 0) {
          this.teamId = msg.yourTeamId;
        }

        this.logTurnInfo();

        if (!msg.state.gameOver && this.teamId >= 0) {
          this.executeTurn();
        }
        break;

      case 'GAME_OVER':
        console.log(`\n${this.name}: ========== GAME OVER ==========`);
        console.log(`${this.name}: Winner: ${msg.winner === null ? 'TIE' : `Team ${msg.winner}`}`);
        console.log(`${this.name}: Reason: ${msg.reason}`);
        if (msg.scores) {
          console.log(`${this.name}: Final scores:`, msg.scores);
        }
        console.log(`${this.name}: ==============================\n`);
        this.ws.close();
        break;

      case 'ERROR':
        console.error(`${this.name}: Server error:`, msg.message);
        break;

      case 'GAME_CONTROL_MESSAGE':
        console.log(`${this.name}: Game control: ${msg.message}`);
        break;
    }
  }

  logTurnInfo() {
    const state = this.gameState;
    console.log(`\n${this.name}: === Turn ${state.turn}/${state.maxTurns} ===`);

    // Log both teams for comparison
    state.teams.forEach((team) => {
      const units = state.units.filter((u) => u.owner === team.id).length;
      const tiles = state.map.filter((t) => t.owner === team.id).length;
      const isMine = team.id === this.teamId;
      console.log(
        `${this.name}: ${isMine ? '>>> ' : '    '}Team ${team.id}: ${team.territoryPoints} TP (+${team.income}), ${units} units, ${tiles} tiles`
      );
    });
  }

  getMapDimensions() {
    const mapWidth = Math.max(...this.gameState.map.map((t) => t.x)) + 1;
    const mapHeight = Math.max(...this.gameState.map.map((t) => t.y)) + 1;
    return { mapWidth, mapHeight };
  }

  executeTurn() {
    const actions = [];
    const myTeam = this.gameState.teams.find((t) => t.id === this.teamId);
    const myUnits = this.gameState.units.filter((u) => u.owner === this.teamId);
    const enemyUnits = this.gameState.units.filter(
      (u) => u.owner !== this.teamId && u.owner !== null
    );

    console.log(
      `${this.name}: Planning actions... (TP: ${myTeam.territoryPoints}, Units: ${myUnits.length} vs ${enemyUnits.length})`
    );

    let remainingTP = myTeam.territoryPoints;

    // 1. Build soldiers while we have enough TP and fewer units than enemy + 2
    while (
      remainingTP >= 20 &&
      myUnits.length + actions.filter((a) => a.type === 'BUILD_UNIT').length <=
        enemyUnits.length + 2
    ) {
      const buildAction = this.tryBuildUnit(actions);
      if (buildAction) {
        actions.push(buildAction);
        remainingTP -= 20;
        console.log(`${this.name}: Building soldier at (${buildAction.x}, ${buildAction.y})`);
      } else {
        break; // No valid build location
      }
    }

    // 2. Move units with tactical priorities
    myUnits.forEach((unit) => {
      if (!unit.canMove) {
        console.log(`${this.name}: Unit ${unit.id} cannot move (capture fatigue)`);
        return;
      }

      const moveAction = this.findBestMove(unit, enemyUnits);
      if (moveAction) {
        actions.push(moveAction);
      }
    });

    // 3. Expand territory while we have spare TP and at least as many soldiers as opponent
    while (remainingTP >= 5 && myUnits.length >= enemyUnits.length) {
      const expandAction = this.tryExpandTerritory(actions);
      if (expandAction) {
        actions.push(expandAction);
        remainingTP -= 5;
        console.log(`${this.name}: Expanding to tile (${expandAction.x}, ${expandAction.y})`);
      } else {
        break; // No valid expansion location
      }
    }

    // Submit actions
    if (actions.length === 0) {
      actions.push({ type: 'PASS' });
      console.log(`${this.name}: No viable actions, passing turn`);
    }

    console.log(`${this.name}: Submitting ${actions.length} action(s)`);

    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: actions,
      })
    );
  }

  tryBuildUnit(pendingActions = []) {
    const { mapWidth, mapHeight } = this.getMapDimensions();

    // Get tiles already used by pending build actions
    const pendingBuildTiles = pendingActions
      .filter((a) => a.type === 'BUILD_UNIT')
      .map((a) => `${a.x},${a.y}`);

    // Find valid build locations on our territory
    const validBuildTiles = this.gameState.map.filter((tile) => {
      if (tile.owner !== this.teamId) return false;
      if (tile.type !== 'FIELD') return false;
      const occupied = this.gameState.units.some((u) => u.x === tile.x && u.y === tile.y);
      if (occupied) return false;
      // Exclude tiles with pending builds
      if (pendingBuildTiles.includes(`${tile.x},${tile.y}`)) return false;
      return true;
    });

    if (validBuildTiles.length === 0) return null;

    // Prefer building near the front line (tiles adjacent to enemy/neutral territory)
    let bestTile = validBuildTiles[0];
    let bestScore = -1;

    validBuildTiles.forEach((tile) => {
      const adjacentPositions = getAdjacentPositions(tile.x, tile.y, mapWidth, mapHeight);
      const adjacentEnemyTiles = adjacentPositions
        .map((pos) => this.gameState.map.find((t) => t.x === pos.x && t.y === pos.y))
        .filter((t) => t && t.owner !== this.teamId);
      const score = adjacentEnemyTiles.length;

      if (score > bestScore) {
        bestScore = score;
        bestTile = tile;
      }
    });

    return {
      type: 'BUILD_UNIT',
      unitType: 'SOLDIER',
      x: bestTile.x,
      y: bestTile.y,
    };
  }

  findBestMove(unit, enemyUnits) {
    const { mapWidth, mapHeight } = this.getMapDimensions();

    const possibleMoves = getPossibleMoves(
      unit,
      this.gameState.map,
      this.gameState.units,
      mapWidth,
      mapHeight
    );
    if (possibleMoves.length === 0) return null;

    let bestMove = null;
    let bestScore = -Infinity;

    possibleMoves.forEach((move) => {
      const score = this.evaluateMove(unit, move, enemyUnits);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });

    if (!bestMove) return null;

    const tile = this.gameState.map.find((t) => t.x === bestMove.x && t.y === bestMove.y);
    const tileDesc =
      tile.owner === null ? 'neutral' : tile.owner === this.teamId ? 'friendly' : 'enemy';
    console.log(
      `${this.name}: Moving unit ${unit.id} to (${bestMove.x}, ${bestMove.y}) - ${tileDesc} tile (score: ${bestScore.toFixed(1)})`
    );

    return {
      type: 'MOVE',
      unitId: unit.id,
      targetX: bestMove.x,
      targetY: bestMove.y,
    };
  }

  evaluateMove(unit, move, enemyUnits) {
    let score = 0;
    const tile = this.gameState.map.find((t) => t.x === move.x && t.y === move.y);

    // Priority 1: Capture enemy territory (highest priority)
    if (tile.owner !== this.teamId && tile.owner !== null) {
      score += 10;
    }

    // Priority 2: Expand to neutral territory
    if (tile.owner === null) {
      score += 5;
    }

    // Priority 3: Move adjacent to enemy units for combat
    const adjacentEnemies = enemyUnits.filter((enemy) => {
      const dist = Math.abs(enemy.x - move.x) + Math.abs(enemy.y - move.y);
      return dist === 1;
    });
    score += adjacentEnemies.length * 3;

    // Priority 4: Move toward enemy territory
    const enemyTiles = this.gameState.map.filter(
      (t) => t.owner !== this.teamId && t.owner !== null
    );
    if (enemyTiles.length > 0) {
      const minDistToEnemy = Math.min(
        ...enemyTiles.map((t) => Math.abs(t.x - move.x) + Math.abs(t.y - move.y))
      );
      score += 1 / (minDistToEnemy + 1);
    }

    // Penalty: Don't move back to friendly territory unless necessary
    if (tile.owner === this.teamId) {
      score -= 2;
    }

    return score;
  }

  tryExpandTerritory(pendingActions = []) {
    const { mapWidth, mapHeight } = this.getMapDimensions();

    // Get tiles already being expanded this turn (for chaining)
    const pendingExpansions = pendingActions
      .filter((a) => a.type === 'EXPAND_TERRITORY')
      .map((a) => ({ x: a.x, y: a.y }));

    // Find tiles adjacent to our territory OR pending expansions that we can expand to
    const myTiles = this.gameState.map.filter((t) => t.owner === this.teamId);
    const expandableTiles = [];

    // Check from owned territory
    myTiles.forEach((tile) => {
      const adjacentPositions = getAdjacentPositions(tile.x, tile.y, mapWidth, mapHeight);
      adjacentPositions.forEach((pos) => {
        const adjTile = this.gameState.map.find((t) => t.x === pos.x && t.y === pos.y);
        if (adjTile && adjTile.owner === null && adjTile.type === 'FIELD') {
          // Not already in expandable list or pending
          const alreadyListed = expandableTiles.some((t) => t.x === adjTile.x && t.y === adjTile.y);
          const alreadyPending = pendingExpansions.some(
            (t) => t.x === adjTile.x && t.y === adjTile.y
          );
          if (!alreadyListed && !alreadyPending) {
            expandableTiles.push(adjTile);
          }
        }
      });
    });

    // Check from pending expansions (chaining)
    pendingExpansions.forEach((pending) => {
      const adjacentPositions = getAdjacentPositions(pending.x, pending.y, mapWidth, mapHeight);
      adjacentPositions.forEach((pos) => {
        const adjTile = this.gameState.map.find((t) => t.x === pos.x && t.y === pos.y);
        if (adjTile && adjTile.owner === null && adjTile.type === 'FIELD') {
          const alreadyListed = expandableTiles.some((t) => t.x === adjTile.x && t.y === adjTile.y);
          const alreadyPending = pendingExpansions.some(
            (t) => t.x === adjTile.x && t.y === adjTile.y
          );
          if (!alreadyListed && !alreadyPending) {
            expandableTiles.push(adjTile);
          }
        }
      });
    });

    if (expandableTiles.length === 0) return null;

    // Choose a random expandable tile (could be improved with better strategy)
    const tile = expandableTiles[Math.floor(Math.random() * expandableTiles.length)];

    return {
      type: 'EXPAND_TERRITORY',
      x: tile.x,
      y: tile.y,
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const password = args[0] || 'password0';
const name = args[1] || 'SimpleBot';

console.log('='.repeat(50));
console.log('SimpleBot - Basic Tactical AI');
console.log('='.repeat(50));
console.log('Strategy:');
console.log('  1. Build soldiers when TP > 20');
console.log('  2. Capture enemy territory (priority)');
console.log('  3. Expand to neutral tiles');
console.log('  4. Attack enemy units');
console.log('='.repeat(50));
console.log(`Password: ${password}`);
console.log(`Name: ${name}`);
console.log('='.repeat(50));

const bot = new SimpleBot(name, password);
bot.connect();
