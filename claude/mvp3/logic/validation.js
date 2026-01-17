/**
 * Action validation for Civilization Clash
 */

const {
  ACTIONS,
  UNIT_TYPES,
  UNIT_STATS,
  TERRAIN,
  TERRAIN_PROPS,
  ECONOMY,
  DISTANCE_1_OFFSETS,
  DISTANCE_2_OFFSETS
} = require('./constants');

/**
 * Get tiles at distance 1 from a position
 */
function getTilesAtDistance1(x, y) {
  return DISTANCE_1_OFFSETS.map(({ dx, dy }) => ({ x: x + dx, y: y + dy }));
}

/**
 * Get tiles at distance 1 or 2 from a position
 */
function getTilesAtDistance2(x, y) {
  return DISTANCE_2_OFFSETS.map(({ dx, dy }) => ({ x: x + dx, y: y + dy }));
}

/**
 * Calculate Chebyshev distance (used for distance 1 adjacency - includes diagonals)
 */
function chebyshevDistance(x1, y1, x2, y2) {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

/**
 * Calculate Manhattan distance (used for archer targeting)
 */
function manhattanDistance(x1, y1, x2, y2) {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

/**
 * Check if a position is within map bounds
 */
function isInBounds(x, y, mapWidth, mapHeight) {
  return x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;
}

/**
 * Get tile at position from map
 */
function getTile(state, x, y) {
  return state.map.tiles.find(t => t.x === x && t.y === y);
}

/**
 * Get unit at position
 */
function getUnit(state, x, y) {
  return state.units.find(u => u.x === x && u.y === y);
}

/**
 * Get city at position
 */
function getCity(state, x, y) {
  return state.cities.find(c => c.x === x && c.y === y);
}

/**
 * Check if a tile is passable
 */
function isPassable(state, x, y) {
  const tile = getTile(state, x, y);
  if (!tile) return false;
  return TERRAIN_PROPS[tile.type]?.passable ?? false;
}

/**
 * Check if unit is in enemy soldier's Zone of Control
 */
function isInZoC(state, unit) {
  // Soldiers are immune to ZoC
  if (UNIT_STATS[unit.type].immuneToZoC) return false;

  // Find enemy soldiers
  const enemySoldiers = state.units.filter(
    u => u.owner !== unit.owner && u.type === UNIT_TYPES.SOLDIER
  );

  // Check if within distance 2 of any enemy soldier
  for (const soldier of enemySoldiers) {
    const dist = chebyshevDistance(unit.x, unit.y, soldier.x, soldier.y);
    if (dist <= UNIT_STATS[UNIT_TYPES.SOLDIER].zocRange) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a tile is adjacent to player's territory
 */
function isAdjacentToOwnTerritory(state, x, y, playerId) {
  const adjacent = getTilesAtDistance1(x, y);
  for (const pos of adjacent) {
    const tile = getTile(state, pos.x, pos.y);
    if (tile && tile.owner === playerId) {
      return true;
    }
  }
  return false;
}

/**
 * Validate a MOVE action
 */
function validateMove(state, playerId, action) {
  const { from_x, from_y, to_x, to_y } = action;

  // Check unit exists at from position
  const unit = getUnit(state, from_x, from_y);
  if (!unit) {
    return { valid: false, error: `No unit at (${from_x}, ${from_y})` };
  }

  // Check unit belongs to player
  if (unit.owner !== playerId) {
    return { valid: false, error: `Unit at (${from_x}, ${from_y}) belongs to another player` };
  }

  // Check unit can move
  if (!unit.canMove) {
    return { valid: false, error: `Unit at (${from_x}, ${from_y}) cannot move this turn` };
  }

  // Check in bounds
  if (!isInBounds(to_x, to_y, state.map.width, state.map.height)) {
    return { valid: false, error: `Target (${to_x}, ${to_y}) is out of bounds` };
  }

  // Check target is passable
  if (!isPassable(state, to_x, to_y)) {
    return { valid: false, error: `Target (${to_x}, ${to_y}) is not passable` };
  }

  // Check no unit at target (except for city capture)
  const unitAtTarget = getUnit(state, to_x, to_y);
  if (unitAtTarget) {
    return { valid: false, error: `Target (${to_x}, ${to_y}) is occupied by another unit` };
  }

  // Check movement distance
  const stats = UNIT_STATS[unit.type];
  const dist = chebyshevDistance(from_x, from_y, to_x, to_y);
  if (dist > stats.movement) {
    return { valid: false, error: `Movement distance ${dist} exceeds unit's movement ${stats.movement}` };
  }

  // Check ZoC (unit can't move if trapped)
  if (isInZoC(state, unit)) {
    return { valid: false, error: `Unit at (${from_x}, ${from_y}) is trapped in Zone of Control` };
  }

  return { valid: true };
}

/**
 * Validate a BUILD_UNIT action
 */
function validateBuildUnit(state, playerId, action) {
  const { city_x, city_y, unit_type } = action;

  // Check unit type is valid
  if (!UNIT_STATS[unit_type]) {
    return { valid: false, error: `Invalid unit type: ${unit_type}` };
  }

  // Check city exists at position
  const city = getCity(state, city_x, city_y);
  if (!city) {
    return { valid: false, error: `No city at (${city_x}, ${city_y})` };
  }

  // Check city belongs to player
  if (city.owner !== playerId) {
    return { valid: false, error: `City at (${city_x}, ${city_y}) belongs to another player` };
  }

  // Check no unit blocking spawn
  const unitAtCity = getUnit(state, city_x, city_y);
  if (unitAtCity) {
    return { valid: false, error: `City at (${city_x}, ${city_y}) is blocked by a unit` };
  }

  // Check player has enough gold
  const cost = UNIT_STATS[unit_type].cost;
  const player = state.players.find(p => p.id === playerId);
  if (player.gold < cost) {
    return { valid: false, error: `Not enough gold (have ${player.gold}, need ${cost})` };
  }

  return { valid: true };
}

/**
 * Validate a BUILD_CITY action
 */
function validateBuildCity(state, playerId, action) {
  const { x, y } = action;

  // Check in bounds
  if (!isInBounds(x, y, state.map.width, state.map.height)) {
    return { valid: false, error: `Position (${x}, ${y}) is out of bounds` };
  }

  // Check tile is passable (field)
  const tile = getTile(state, x, y);
  if (!tile || tile.type !== TERRAIN.FIELD) {
    return { valid: false, error: `Position (${x}, ${y}) is not a field` };
  }

  // Check tile is owned by player
  if (tile.owner !== playerId) {
    return { valid: false, error: `Position (${x}, ${y}) is not owned by you` };
  }

  // Check no city already there
  const existingCity = getCity(state, x, y);
  if (existingCity) {
    return { valid: false, error: `City already exists at (${x}, ${y})` };
  }

  // Check no unit blocking
  const unitAtPos = getUnit(state, x, y);
  if (unitAtPos) {
    return { valid: false, error: `Position (${x}, ${y}) is blocked by a unit` };
  }

  // Check player has enough gold
  const player = state.players.find(p => p.id === playerId);
  if (player.gold < ECONOMY.CITY_COST) {
    return { valid: false, error: `Not enough gold (have ${player.gold}, need ${ECONOMY.CITY_COST})` };
  }

  return { valid: true };
}

/**
 * Validate an EXPAND_TERRITORY action
 */
function validateExpandTerritory(state, playerId, action) {
  const { x, y } = action;

  // Check in bounds
  if (!isInBounds(x, y, state.map.width, state.map.height)) {
    return { valid: false, error: `Position (${x}, ${y}) is out of bounds` };
  }

  // Check tile is controllable
  const tile = getTile(state, x, y);
  if (!tile || !TERRAIN_PROPS[tile.type]?.controllable) {
    return { valid: false, error: `Position (${x}, ${y}) cannot be controlled` };
  }

  // Check tile is neutral (not owned)
  if (tile.owner !== null) {
    return { valid: false, error: `Position (${x}, ${y}) is already owned` };
  }

  // Check adjacent to player's territory
  if (!isAdjacentToOwnTerritory(state, x, y, playerId)) {
    return { valid: false, error: `Position (${x}, ${y}) is not adjacent to your territory` };
  }

  // Check player has enough gold
  const player = state.players.find(p => p.id === playerId);
  if (player.gold < ECONOMY.EXPAND_COST) {
    return { valid: false, error: `Not enough gold (have ${player.gold}, need ${ECONOMY.EXPAND_COST})` };
  }

  return { valid: true };
}

/**
 * Validate a single action
 */
function validateAction(state, playerId, action) {
  if (!action || !action.action) {
    return { valid: false, error: 'Invalid action format' };
  }

  switch (action.action) {
    case ACTIONS.MOVE:
      return validateMove(state, playerId, action);
    case ACTIONS.BUILD_UNIT:
      return validateBuildUnit(state, playerId, action);
    case ACTIONS.BUILD_CITY:
      return validateBuildCity(state, playerId, action);
    case ACTIONS.EXPAND_TERRITORY:
      return validateExpandTerritory(state, playerId, action);
    case ACTIONS.PASS:
      return { valid: true };
    default:
      return { valid: false, error: `Unknown action type: ${action.action}` };
  }
}

/**
 * Validate all actions for a player
 * Returns { valid: boolean, errors: string[] }
 */
function validateActions(state, playerId, actions) {
  if (!Array.isArray(actions)) {
    return { valid: false, errors: ['Actions must be an array'] };
  }

  const errors = [];
  for (let i = 0; i < actions.length; i++) {
    const result = validateAction(state, playerId, actions[i]);
    if (!result.valid) {
      errors.push(`Action ${i}: ${result.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateAction,
  validateActions,
  validateMove,
  validateBuildUnit,
  validateBuildCity,
  validateExpandTerritory,
  getTilesAtDistance1,
  getTilesAtDistance2,
  chebyshevDistance,
  manhattanDistance,
  isInBounds,
  getTile,
  getUnit,
  getCity,
  isPassable,
  isInZoC,
  isAdjacentToOwnTerritory
};
