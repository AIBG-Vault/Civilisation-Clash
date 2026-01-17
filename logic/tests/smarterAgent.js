/**
 * Smarter Agent - Has basic strategy
 * - Builds soldiers to control map
 * - Expands territory for income
 * - Moves toward monument and enemies
 * - Prioritizes city capture
 */

const {
  ACTIONS,
  UNIT_TYPES,
  UNIT_STATS,
  ECONOMY,
  validateAction,
  getTilesAtDistance1,
  getUnit,
  chebyshevDistance,
  isInZoC,
} = require('..');

/**
 * Get all valid moves for a unit
 */
function getValidMoves(state, unit) {
  if (!unit.canMove) return [];
  if (isInZoC(state, unit)) return [];

  const moves = [];
  const movement = UNIT_STATS[unit.type].movement;

  // Check tiles within movement range
  for (let dx = -movement; dx <= movement; dx++) {
    for (let dy = -movement; dy <= movement; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (chebyshevDistance(0, 0, dx, dy) > movement) continue;

      const action = {
        action: ACTIONS.MOVE,
        from_x: unit.x,
        from_y: unit.y,
        to_x: unit.x + dx,
        to_y: unit.y + dy,
      };

      const result = validateAction(state, unit.owner, action);
      if (result.valid) {
        moves.push(action);
      }
    }
  }

  return moves;
}

/**
 * Get valid build unit actions for a specific unit type
 */
function getValidBuildsForType(state, playerId, unitType) {
  const player = state.players.find((p) => p.id === playerId);
  if (player.gold < UNIT_STATS[unitType].cost) return [];

  const builds = [];

  for (const city of state.cities) {
    if (city.owner !== playerId) continue;

    const unitAtCity = state.units.find((u) => u.x === city.x && u.y === city.y);
    if (unitAtCity) continue;

    builds.push({
      action: ACTIONS.BUILD_UNIT,
      city_x: city.x,
      city_y: city.y,
      unit_type: unitType,
    });
  }

  return builds;
}

/**
 * Get valid expand actions sorted by distance to center
 */
function getValidExpands(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (player.gold < ECONOMY.EXPAND_COST) return [];

  const expands = [];
  const seen = new Set();
  const ownedTiles = state.map.tiles.filter((t) => t.owner === playerId);
  const centerX = Math.floor(state.map.width / 2);
  const centerY = Math.floor(state.map.height / 2);

  for (const tile of ownedTiles) {
    const adjacent = getTilesAtDistance1(tile.x, tile.y);
    for (const pos of adjacent) {
      const key = `${pos.x},${pos.y}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const action = {
        action: ACTIONS.EXPAND_TERRITORY,
        x: pos.x,
        y: pos.y,
      };

      const result = validateAction(state, playerId, action);
      if (result.valid) {
        expands.push({
          action,
          distToCenter: chebyshevDistance(pos.x, pos.y, centerX, centerY),
        });
      }
    }
  }

  // Sort by distance to center (expand toward monument first)
  expands.sort((a, b) => a.distToCenter - b.distToCenter);
  return expands.map((e) => e.action);
}

/**
 * Score a move based on strategic value
 */
function scoreMoveTarget(state, unit, targetX, targetY) {
  let score = 0;
  const centerX = Math.floor(state.map.width / 2);
  const centerY = Math.floor(state.map.height / 2);

  // Prefer moving toward monument
  const currentDistToCenter = chebyshevDistance(unit.x, unit.y, centerX, centerY);
  const newDistToCenter = chebyshevDistance(targetX, targetY, centerX, centerY);
  score += (currentDistToCenter - newDistToCenter) * 10;

  // Soldiers: prefer moving toward enemy cities
  if (UNIT_STATS[unit.type].canCaptureCities) {
    const enemyCities = state.cities.filter((c) => c.owner !== unit.owner);
    for (const city of enemyCities) {
      const currentDist = chebyshevDistance(unit.x, unit.y, city.x, city.y);
      const newDist = chebyshevDistance(targetX, targetY, city.x, city.y);
      score += (currentDist - newDist) * 15;
    }
  }

  // Prefer moving toward enemies
  const enemies = state.units.filter((u) => u.owner !== unit.owner);
  for (const enemy of enemies) {
    const currentDist = chebyshevDistance(unit.x, unit.y, enemy.x, enemy.y);
    const newDist = chebyshevDistance(targetX, targetY, enemy.x, enemy.y);
    score += (currentDist - newDist) * 5;
  }

  // Check if target is enemy territory (raiding)
  const targetTile = state.map.tiles.find((t) => t.x === targetX && t.y === targetY);
  if (targetTile && targetTile.owner !== null && targetTile.owner !== unit.owner) {
    score += 8;
  }

  // Check if target is enemy city (capture!)
  const targetCity = state.cities.find((c) => c.x === targetX && c.y === targetY);
  if (targetCity && targetCity.owner !== unit.owner && UNIT_STATS[unit.type].canCaptureCities) {
    score += 100;
  }

  return score;
}

/**
 * Get best move for a unit
 */
function getBestMove(state, unit) {
  const moves = getValidMoves(state, unit);
  if (moves.length === 0) return null;

  let bestMove = null;
  let bestScore = -Infinity;

  for (const move of moves) {
    const score = scoreMoveTarget(state, unit, move.to_x, move.to_y);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  // Only move if it improves position
  return bestScore > 0 ? bestMove : null;
}

/**
 * Generate actions for a turn - strategic approach
 */
function generateActions(state, playerId) {
  const actions = [];
  const player = state.players.find((p) => p.id === playerId);
  let remainingGold = player.gold + player.income; // After income phase

  const myUnits = state.units.filter((u) => u.owner === playerId);
  const myCities = state.cities.filter((c) => c.owner === playerId);
  const enemyUnits = state.units.filter((u) => u.owner !== playerId);

  // Strategy: Build soldiers until we have a good army
  const soldierCount = myUnits.filter((u) => u.type === UNIT_TYPES.SOLDIER).length;
  const targetSoldiers = Math.min(5, myCities.length * 2);

  // Build soldiers if we need more
  if (soldierCount < targetSoldiers) {
    const soldierBuilds = getValidBuildsForType(state, playerId, UNIT_TYPES.SOLDIER);
    for (const build of soldierBuilds) {
      if (remainingGold >= UNIT_STATS[UNIT_TYPES.SOLDIER].cost) {
        actions.push(build);
        remainingGold -= UNIT_STATS[UNIT_TYPES.SOLDIER].cost;

        // Track that city will be blocked
        break; // One build per turn to start
      }
    }
  }

  // Build archers if we have extra gold and soldiers
  if (soldierCount >= 2 && remainingGold >= UNIT_STATS[UNIT_TYPES.ARCHER].cost) {
    const archerCount = myUnits.filter((u) => u.type === UNIT_TYPES.ARCHER).length;
    if (archerCount < 2) {
      const archerBuilds = getValidBuildsForType(state, playerId, UNIT_TYPES.ARCHER);
      for (const build of archerBuilds) {
        // Don't build in same city as soldier
        if (actions.find((a) => a.city_x === build.city_x && a.city_y === build.city_y)) continue;

        actions.push(build);
        remainingGold -= UNIT_STATS[UNIT_TYPES.ARCHER].cost;
        break;
      }
    }
  }

  // Expand territory if we have gold left
  const expands = getValidExpands(state, playerId);
  for (const expand of expands) {
    if (remainingGold >= ECONOMY.EXPAND_COST) {
      actions.push(expand);
      remainingGold -= ECONOMY.EXPAND_COST;

      // Limit expansions per turn
      if (actions.filter((a) => a.action === ACTIONS.EXPAND_TERRITORY).length >= 3) break;
    } else {
      break;
    }
  }

  // Move units strategically
  for (const unit of myUnits) {
    const move = getBestMove(state, unit);
    if (move) {
      actions.push(move);
    }
  }

  return actions;
}

module.exports = {
  generateActions,
  getValidMoves,
  getBestMove,
  scoreMoveTarget,
};
