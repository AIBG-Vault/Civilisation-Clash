/**
 * Economy Agent - Farms economy aggressively, then launches assault
 *
 * Phase 1 (economy): Expand territory, build cities, hoard gold.
 *   Only builds a token garrison soldier per city for defense.
 * Phase 2 (assault): Once income is high enough or time is running out,
 *   dumps gold into a full army and pushes toward enemies and monument.
 */

const {
  ACTIONS,
  UNIT_TYPES,
  UNIT_STATS,
  ECONOMY,
  TERRAIN,
  validateAction,
  getTilesAtDistance1,
  getUnit,
  chebyshevDistance,
  isInZoC,
} = require('../logic');

// --- Helpers (shared patterns from other agents) ---

function getValidMoves(state, unit) {
  const canMove = unit.can_move_next_turn ?? unit.canMove;
  if (!canMove) return [];
  if (isInZoC(state, unit)) return [];

  const moves = [];
  const movement = UNIT_STATS[unit.type].movement;

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

      if (validateAction(state, unit.owner, action).valid) {
        moves.push(action);
      }
    }
  }
  return moves;
}

function getValidBuildsForType(state, playerId, unitType) {
  const player = state.players.find((p) => p.id === playerId);
  if (player.gold < UNIT_STATS[unitType].cost) return [];

  const builds = [];
  for (const city of state.cities) {
    if (city.owner !== playerId) continue;
    if (state.units.some((u) => u.x === city.x && u.y === city.y)) continue;
    builds.push({
      action: ACTIONS.BUILD_UNIT,
      city_x: city.x,
      city_y: city.y,
      unit_type: unitType,
    });
  }
  return builds;
}

function getValidExpands(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (player.gold < ECONOMY.EXPAND_COST) return [];

  const expands = [];
  const seen = new Set();
  const ownedTiles = state.map.tiles.filter((t) => t.owner === playerId);
  const capital = getCapital(state, playerId);
  // Expand outward from capital in a broad circle
  const anchorX = capital ? capital.x : Math.floor(state.map.width / 2);
  const anchorY = capital ? capital.y : Math.floor(state.map.height / 2);

  const centerX = Math.floor(state.map.width / 2);
  const centerY = Math.floor(state.map.height / 2);

  for (const tile of ownedTiles) {
    const adjacent = getTilesAtDistance1(tile.x, tile.y);
    for (const pos of adjacent) {
      const key = `${pos.x},${pos.y}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const action = { action: ACTIONS.EXPAND_TERRITORY, x: pos.x, y: pos.y };
      if (validateAction(state, playerId, action).valid) {
        expands.push({
          action,
          dist: chebyshevDistance(pos.x, pos.y, anchorX, anchorY),
          centerDist: chebyshevDistance(pos.x, pos.y, centerX, centerY),
        });
      }
    }
  }

  // Expand closest to capital first, break ties by center proximity
  expands.sort((a, b) => a.dist - b.dist || a.centerDist - b.centerDist);
  return expands.map((e) => e.action);
}

function getCapital(state, playerId) {
  // Capital is the first city (starting city, furthest from center)
  const myCities = state.cities.filter((c) => c.owner === playerId);
  if (myCities.length === 0) return null;
  const centerX = Math.floor(state.map.width / 2);
  const centerY = Math.floor(state.map.height / 2);
  let best = myCities[0];
  let bestDist = 0;
  for (const c of myCities) {
    const d = chebyshevDistance(c.x, c.y, centerX, centerY);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function getValidCityLocations(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (player.gold < ECONOMY.CITY_COST) return [];

  const myCities = state.cities.filter((c) => c.owner === playerId);
  const capital = getCapital(state, playerId);
  const locations = [];

  for (const tile of state.map.tiles) {
    if (tile.owner !== playerId || tile.type !== TERRAIN.FIELD) continue;
    if (state.cities.some((c) => c.x === tile.x && c.y === tile.y)) continue;
    if (state.units.some((u) => u.x === tile.x && u.y === tile.y)) continue;

    let score = 0;
    const centerX = Math.floor(state.map.width / 2);
    const centerY = Math.floor(state.map.height / 2);
    // Strong preference for close to capital
    if (capital) {
      score -= chebyshevDistance(tile.x, tile.y, capital.x, capital.y) * 10;
    }
    // Tiebreaker: prefer tiles closer to center (symmetric for both players)
    score -= chebyshevDistance(tile.x, tile.y, centerX, centerY) * 0.5;
    // Small bonus for not being right on top of another city (min spacing 2)
    let minDistToOwn = Infinity;
    for (const c of myCities) {
      minDistToOwn = Math.min(minDistToOwn, chebyshevDistance(tile.x, tile.y, c.x, c.y));
    }
    if (minDistToOwn >= 2) score += 5;

    locations.push({ action: { action: ACTIONS.BUILD_CITY, x: tile.x, y: tile.y }, score });
  }

  locations.sort((a, b) => b.score - a.score);
  return locations;
}

// --- Decision logic ---

function isAssaultTime(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  const maxTurns = state.maxTurns || 200;
  const turnsLeft = maxTurns - state.turn;
  const myIncome = player.income;

  // Assault if: time is running out, or income is very high, or enemy is nearby
  if (turnsLeft <= 40) return true;
  if (myIncome >= 30) return true;

  // Assault if enemy units are threatening our cities
  const myCities = state.cities.filter((c) => c.owner === playerId);
  const enemyUnits = state.units.filter((u) => u.owner !== playerId);
  for (const city of myCities) {
    for (const enemy of enemyUnits) {
      if (chebyshevDistance(city.x, city.y, enemy.x, enemy.y) <= 3) return true;
    }
  }

  return false;
}

function scoreMoveEcon(state, unit, tx, ty) {
  let score = 0;
  const centerX = Math.floor(state.map.width / 2);
  const centerY = Math.floor(state.map.height / 2);

  // During econ: garrison near own cities, nudge toward center
  const myCities = state.cities.filter((c) => c.owner === unit.owner);
  let minCityDist = Infinity;
  for (const c of myCities) {
    minCityDist = Math.min(minCityDist, chebyshevDistance(tx, ty, c.x, c.y));
  }
  // Stay within 2 tiles of a city
  if (minCityDist <= 2) score += 10;
  else score -= minCityDist * 3;

  // Slight bias toward center
  const curDist = chebyshevDistance(unit.x, unit.y, centerX, centerY);
  const newDist = chebyshevDistance(tx, ty, centerX, centerY);
  score += (curDist - newDist) * 2;

  return score;
}

function scoreMoveAssault(state, unit, tx, ty) {
  let score = 0;
  const centerX = Math.floor(state.map.width / 2);
  const centerY = Math.floor(state.map.height / 2);

  // Push toward monument
  const curDist = chebyshevDistance(unit.x, unit.y, centerX, centerY);
  const newDist = chebyshevDistance(tx, ty, centerX, centerY);
  score += (curDist - newDist) * 10;

  // Soldiers push toward enemy cities
  if (UNIT_STATS[unit.type].canCaptureCities) {
    const enemyCities = state.cities.filter((c) => c.owner !== unit.owner);
    for (const city of enemyCities) {
      const cd = chebyshevDistance(unit.x, unit.y, city.x, city.y);
      const nd = chebyshevDistance(tx, ty, city.x, city.y);
      score += (cd - nd) * 15;
    }
  }

  // Move toward enemies
  const enemies = state.units.filter((u) => u.owner !== unit.owner);
  for (const enemy of enemies) {
    const cd = chebyshevDistance(unit.x, unit.y, enemy.x, enemy.y);
    const nd = chebyshevDistance(tx, ty, enemy.x, enemy.y);
    score += (cd - nd) * 5;
  }

  // Raid enemy territory
  const tile = state.map.tiles.find((t) => t.x === tx && t.y === ty);
  if (tile && tile.owner !== null && tile.owner !== unit.owner) score += 8;

  // Capture enemy city
  const city = state.cities.find((c) => c.x === tx && c.y === ty);
  if (city && city.owner !== unit.owner && UNIT_STATS[unit.type].canCaptureCities) score += 100;

  return score;
}

// --- Main entry ---

function generateActions(state, playerId) {
  const actions = [];
  const player = state.players.find((p) => p.id === playerId);
  let gold = player.gold + player.income;

  const myUnits = state.units.filter((u) => u.owner === playerId);
  const myCities = state.cities.filter((c) => c.owner === playerId);
  const myTiles = state.map.tiles.filter((t) => t.owner === playerId);
  const citiesUsed = new Set();

  const assault = isAssaultTime(state, playerId);

  if (!assault) {
    // === ECONOMY PHASE ===

    // 1. Build cities aggressively — target 1 city per ~12 tiles, up to 6
    const targetCities = Math.min(6, Math.floor(myTiles.length / 12) + 1);
    if (myCities.length < targetCities && gold >= ECONOMY.CITY_COST) {
      const locs = getValidCityLocations(state, playerId);
      if (locs.length > 0) {
        actions.push(locs[0].action);
        gold -= ECONOMY.CITY_COST;
      }
    }

    // 2. Build one garrison soldier per city that doesn't have a nearby defender
    for (const city of myCities) {
      const nearbyDefender = myUnits.some(
        (u) => u.type === UNIT_TYPES.SOLDIER && chebyshevDistance(u.x, u.y, city.x, city.y) <= 2
      );
      if (!nearbyDefender && gold >= UNIT_STATS[UNIT_TYPES.SOLDIER].cost) {
        const builds = getValidBuildsForType(state, playerId, UNIT_TYPES.SOLDIER);
        const build = builds.find((b) => b.city_x === city.x && b.city_y === city.y);
        if (build && !citiesUsed.has(`${city.x},${city.y}`)) {
          actions.push(build);
          gold -= UNIT_STATS[UNIT_TYPES.SOLDIER].cost;
          citiesUsed.add(`${city.x},${city.y}`);
        }
      }
    }

    // 3. Expand territory — dump remaining gold into expansion
    const expands = getValidExpands(state, playerId);
    for (const expand of expands) {
      if (gold < ECONOMY.EXPAND_COST) break;
      actions.push(expand);
      gold -= ECONOMY.EXPAND_COST;
    }

    // 4. Move garrison units — stay near cities, drift toward center
    for (const unit of myUnits) {
      const moves = getValidMoves(state, unit);
      if (moves.length === 0) continue;

      let bestScore = -Infinity;
      let bestMoves = [];
      for (const m of moves) {
        const s = scoreMoveEcon(state, unit, m.to_x, m.to_y);
        if (s > bestScore) {
          bestScore = s;
          bestMoves = [m];
        } else if (s === bestScore) bestMoves.push(m);
      }
      if (bestMoves.length > 0 && bestScore > 0) {
        actions.push(bestMoves[Math.floor(Math.random() * bestMoves.length)]);
      }
    }
  } else {
    // === ASSAULT PHASE ===

    // 1. Still build a city if we can and have few
    if (myCities.length < 3 && gold >= ECONOMY.CITY_COST + 60) {
      const locs = getValidCityLocations(state, playerId);
      if (locs.length > 0) {
        actions.push(locs[0].action);
        gold -= ECONOMY.CITY_COST;
      }
    }

    // 2. Build army — soldiers first, then archers, then raiders
    const soldierCount = myUnits.filter((u) => u.type === UNIT_TYPES.SOLDIER).length;
    const archerCount = myUnits.filter((u) => u.type === UNIT_TYPES.ARCHER).length;

    // Soldiers
    const targetSoldiers = myCities.length * 2;
    if (soldierCount < targetSoldiers) {
      const builds = getValidBuildsForType(state, playerId, UNIT_TYPES.SOLDIER);
      for (const build of builds) {
        const key = `${build.city_x},${build.city_y}`;
        if (citiesUsed.has(key)) continue;
        if (gold < UNIT_STATS[UNIT_TYPES.SOLDIER].cost) break;
        actions.push(build);
        gold -= UNIT_STATS[UNIT_TYPES.SOLDIER].cost;
        citiesUsed.add(key);
      }
    }

    // Archers
    if (archerCount < Math.ceil(myCities.length * 1.5)) {
      const builds = getValidBuildsForType(state, playerId, UNIT_TYPES.ARCHER);
      for (const build of builds) {
        const key = `${build.city_x},${build.city_y}`;
        if (citiesUsed.has(key)) continue;
        if (gold < UNIT_STATS[UNIT_TYPES.ARCHER].cost) break;
        actions.push(build);
        gold -= UNIT_STATS[UNIT_TYPES.ARCHER].cost;
        citiesUsed.add(key);
      }
    }

    // Raiders from remaining cities
    const rBuilds = getValidBuildsForType(state, playerId, UNIT_TYPES.RAIDER);
    for (const build of rBuilds) {
      const key = `${build.city_x},${build.city_y}`;
      if (citiesUsed.has(key)) continue;
      if (gold < UNIT_STATS[UNIT_TYPES.RAIDER].cost) break;
      actions.push(build);
      gold -= UNIT_STATS[UNIT_TYPES.RAIDER].cost;
      citiesUsed.add(key);
    }

    // 3. Expand with leftover gold
    const expands = getValidExpands(state, playerId);
    for (const expand of expands) {
      if (gold < ECONOMY.EXPAND_COST) break;
      actions.push(expand);
      gold -= ECONOMY.EXPAND_COST;
    }

    // 4. Move units aggressively
    for (const unit of myUnits) {
      const moves = getValidMoves(state, unit);
      if (moves.length === 0) continue;

      let bestScore = -Infinity;
      let bestMoves = [];
      for (const m of moves) {
        const s = scoreMoveAssault(state, unit, m.to_x, m.to_y);
        if (s > bestScore) {
          bestScore = s;
          bestMoves = [m];
        } else if (s === bestScore) bestMoves.push(m);
      }
      if (bestMoves.length > 0 && bestScore > 0) {
        actions.push(bestMoves[Math.floor(Math.random() * bestMoves.length)]);
      }
    }
  }

  return actions;
}

module.exports = {
  generateActions,
};
