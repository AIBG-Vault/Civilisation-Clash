/**
 * Turn processor for Civilization Clash
 * Stateless - takes state and actions, returns new state
 */

const {
  ACTIONS,
  UNIT_TYPES,
  UNIT_STATS,
  TERRAIN,
  TERRAIN_PROPS,
  ECONOMY,
  SCORING,
  SCORE_MULTIPLIERS,
  DISTANCE_1_OFFSETS,
  DISTANCE_2_OFFSETS
} = require('./constants');

const {
  validateAction,
  getTile,
  getUnit,
  getCity,
  isInZoC,
  chebyshevDistance,
  manhattanDistance,
  getTilesAtDistance1,
  getTilesAtDistance2
} = require('./validation');

/**
 * Deep clone game state
 */
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Get score multiplier based on turn
 */
function getScoreMultiplier(turn) {
  if (turn >= SCORE_MULTIPLIERS.LATE.turn) return SCORE_MULTIPLIERS.LATE.multiplier;
  if (turn >= SCORE_MULTIPLIERS.MID.turn) return SCORE_MULTIPLIERS.MID.multiplier;
  return SCORE_MULTIPLIERS.EARLY.multiplier;
}

/**
 * Get monument score based on turn
 */
function getMonumentScore(turn) {
  if (turn >= 151) return SCORING.MONUMENT_LATE;
  if (turn >= 101) return SCORING.MONUMENT_MID;
  return SCORING.MONUMENT_EARLY;
}

/**
 * Calculate income for a player
 */
function calculateIncome(state, playerId) {
  let income = 0;

  // Territory income
  for (const tile of state.map.tiles) {
    if (tile.owner === playerId && TERRAIN_PROPS[tile.type]?.controllable) {
      income += TERRAIN_PROPS[tile.type].income;
    }
  }

  // City income
  for (const city of state.cities) {
    if (city.owner === playerId) {
      income += ECONOMY.CITY_INCOME;
    }
  }

  return income;
}

/**
 * Phase 1: Income - Collect gold from territory and cities
 */
function processIncomePhase(state, events) {
  for (const player of state.players) {
    const income = calculateIncome(state, player.id);
    player.gold += income;
    player.income = income;
  }
}

/**
 * Phase 2: Archer - Archers shoot enemies
 */
function processArcherPhase(state, events) {
  const archers = state.units.filter(u => u.type === UNIT_TYPES.ARCHER);
  const multiplier = getScoreMultiplier(state.turn);

  for (const archer of archers) {
    // Find enemies within range 2
    const enemies = state.units.filter(u => {
      if (u.owner === archer.owner) return false;
      const dist = chebyshevDistance(archer.x, archer.y, u.x, u.y);
      return dist >= 1 && dist <= UNIT_STATS[UNIT_TYPES.ARCHER].rangedRange;
    });

    if (enemies.length === 0) continue;

    // Select target: nearest (Manhattan distance), then lowest HP
    enemies.sort((a, b) => {
      const distA = manhattanDistance(archer.x, archer.y, a.x, a.y);
      const distB = manhattanDistance(archer.x, archer.y, b.x, b.y);
      if (distA !== distB) return distA - distB;
      if (a.hp !== b.hp) return a.hp - b.hp;
      // Deterministic tiebreaker: by position
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    const target = enemies[0];
    const damage = UNIT_STATS[UNIT_TYPES.ARCHER].damage;

    // Apply damage
    target.hp -= damage;

    // Mark archer as unable to move
    archer.canMove = false;

    // Score for damage
    const attackerOwner = state.players.find(p => p.id === archer.owner);
    const isKill = target.hp <= 0;
    const scoreGain = Math.floor((isKill ? SCORING.KILL_BONUS : SCORING.DAMAGE_DEALT) * multiplier);
    attackerOwner.score += scoreGain;

    events.push({
      type: 'COMBAT',
      data: {
        phase: 'archer',
        attacker: { x: archer.x, y: archer.y, type: archer.type, owner: archer.owner },
        target: { x: target.x, y: target.y, type: target.type, owner: target.owner },
        damage,
        isKill,
        scoreGain
      }
    });

    // If killed, give death bonus to target owner
    if (isKill) {
      const targetOwner = state.players.find(p => p.id === target.owner);
      const deathScore = UNIT_STATS[target.type].deathScore;
      targetOwner.score += deathScore;

      events.push({
        type: 'DEATH',
        data: {
          unit: { x: target.x, y: target.y, type: target.type, owner: target.owner },
          deathScore
        }
      });
    }
  }

  // Remove dead units
  state.units = state.units.filter(u => u.hp > 0);
}

/**
 * Phase 3: Movement - Process move actions
 */
function processMovementPhase(state, actions, events) {
  // Collect all valid move actions
  const moves = [];

  for (const playerId of [0, 1]) {
    const playerActions = actions[`player${playerId}`] || [];
    for (const action of playerActions) {
      if (action.action !== ACTIONS.MOVE) continue;

      const result = validateAction(state, playerId, action);
      if (!result.valid) continue;

      const unit = state.units.find(
        u => u.x === action.from_x && u.y === action.from_y && u.owner === playerId
      );
      if (!unit || !unit.canMove) continue;

      // Check ZoC
      if (isInZoC(state, unit)) continue;

      moves.push({ playerId, action, unit });
    }
  }

  // Process moves
  for (const { playerId, action, unit } of moves) {
    const { to_x, to_y } = action;

    // Check if target still available (no collision with other moved units)
    const unitAtTarget = state.units.find(u => u.x === to_x && u.y === to_y);
    if (unitAtTarget) continue;

    // Get target tile
    const targetTile = state.map.tiles.find(t => t.x === to_x && t.y === to_y);
    if (!targetTile) continue;

    // Move unit
    unit.x = to_x;
    unit.y = to_y;

    // Check for city capture (soldier walking into enemy city)
    if (UNIT_STATS[unit.type].canCaptureCities) {
      const city = state.cities.find(c => c.x === to_x && c.y === to_y);
      if (city && city.owner !== playerId) {
        const previousOwner = city.owner;
        city.owner = playerId;

        // Transfer city's tile to captor
        targetTile.owner = playerId;

        events.push({
          type: 'CITY_CAPTURED',
          data: {
            city: { x: city.x, y: city.y },
            previousOwner,
            newOwner: playerId,
            capturedBy: { x: unit.x, y: unit.y, type: unit.type }
          }
        });
      }
    }

    // Check for territory raiding
    if (targetTile.owner !== null && targetTile.owner !== playerId) {
      // Raid: make neutral and stop movement
      const previousOwner = targetTile.owner;
      targetTile.owner = null;
      unit.canMove = false; // Stop further movement this turn

      events.push({
        type: 'CAPTURE',
        data: {
          tile: { x: to_x, y: to_y },
          previousOwner,
          raidedBy: { x: unit.x, y: unit.y, type: unit.type, owner: playerId }
        }
      });
    }
  }
}

/**
 * Phase 4: Combat - Melee combat resolves
 */
function processCombatPhase(state, events) {
  const multiplier = getScoreMultiplier(state.turn);

  // Collect all damage to apply (simultaneous resolution)
  const damageQueue = []; // { target, damage, attacker }

  for (const unit of state.units) {
    // Only soldiers and raiders do melee
    if (!UNIT_STATS[unit.type].meleeAttack) continue;

    const damage = UNIT_STATS[unit.type].damage;

    // Find all adjacent enemies
    const adjacent = getTilesAtDistance1(unit.x, unit.y);
    for (const pos of adjacent) {
      const enemy = state.units.find(
        u => u.x === pos.x && u.y === pos.y && u.owner !== unit.owner
      );
      if (enemy) {
        damageQueue.push({ target: enemy, damage, attacker: unit });
      }
    }
  }

  // Apply all damage simultaneously
  for (const { target, damage, attacker } of damageQueue) {
    target.hp -= damage;

    const attackerOwner = state.players.find(p => p.id === attacker.owner);
    const isKill = target.hp <= 0;
    const scoreGain = Math.floor((isKill ? SCORING.KILL_BONUS : SCORING.DAMAGE_DEALT) * multiplier);
    attackerOwner.score += scoreGain;

    events.push({
      type: 'COMBAT',
      data: {
        phase: 'melee',
        attacker: { x: attacker.x, y: attacker.y, type: attacker.type, owner: attacker.owner },
        target: { x: target.x, y: target.y, type: target.type, owner: target.owner },
        damage,
        isKill,
        scoreGain
      }
    });
  }

  // Process deaths and give death bonuses
  const deadUnits = state.units.filter(u => u.hp <= 0);
  for (const unit of deadUnits) {
    const owner = state.players.find(p => p.id === unit.owner);
    const deathScore = UNIT_STATS[unit.type].deathScore;
    owner.score += deathScore;

    events.push({
      type: 'DEATH',
      data: {
        unit: { x: unit.x, y: unit.y, type: unit.type, owner: unit.owner },
        deathScore
      }
    });
  }

  // Remove dead units
  state.units = state.units.filter(u => u.hp > 0);
}

/**
 * Phase 5: Build - Process builds and expansions
 */
function processBuildPhase(state, actions, events) {
  for (const playerId of [0, 1]) {
    const playerActions = actions[`player${playerId}`] || [];
    const player = state.players.find(p => p.id === playerId);

    for (const action of playerActions) {
      // Skip non-build actions
      if (![ACTIONS.BUILD_UNIT, ACTIONS.BUILD_CITY, ACTIONS.EXPAND_TERRITORY].includes(action.action)) {
        continue;
      }

      const result = validateAction(state, playerId, action);
      if (!result.valid) continue;

      if (action.action === ACTIONS.BUILD_UNIT) {
        const cost = UNIT_STATS[action.unit_type].cost;
        if (player.gold < cost) continue;

        // Check city not blocked
        const unitAtCity = state.units.find(
          u => u.x === action.city_x && u.y === action.city_y
        );
        if (unitAtCity) continue;

        // Deduct cost and create unit
        player.gold -= cost;
        state.units.push({
          x: action.city_x,
          y: action.city_y,
          owner: playerId,
          type: action.unit_type,
          hp: UNIT_STATS[action.unit_type].hp,
          canMove: false // Units can't move on spawn turn
        });
      } else if (action.action === ACTIONS.BUILD_CITY) {
        if (player.gold < ECONOMY.CITY_COST) continue;

        // Check no unit or city at position
        const unitAtPos = state.units.find(u => u.x === action.x && u.y === action.y);
        const cityAtPos = state.cities.find(c => c.x === action.x && c.y === action.y);
        if (unitAtPos || cityAtPos) continue;

        player.gold -= ECONOMY.CITY_COST;
        state.cities.push({
          x: action.x,
          y: action.y,
          owner: playerId
        });
      } else if (action.action === ACTIONS.EXPAND_TERRITORY) {
        if (player.gold < ECONOMY.EXPAND_COST) continue;

        const tile = state.map.tiles.find(t => t.x === action.x && t.y === action.y);
        if (!tile || tile.owner !== null) continue;

        player.gold -= ECONOMY.EXPAND_COST;
        tile.owner = playerId;
      }
    }
  }
}

/**
 * Phase 6: Scoring - Monument control and end-of-turn scoring
 */
function processScoringPhase(state, events) {
  // Determine monument control
  const monumentX = state.monument.x;
  const monumentY = state.monument.y;

  // Find units adjacent to monument
  const adjacent = getTilesAtDistance1(monumentX, monumentY);
  const adjacentUnits = { 0: [], 1: [] };

  for (const pos of adjacent) {
    const unit = state.units.find(u => u.x === pos.x && u.y === pos.y);
    if (unit) {
      adjacentUnits[unit.owner].push(unit);
    }
  }

  const team0Adjacent = adjacentUnits[0].length > 0;
  const team1Adjacent = adjacentUnits[1].length > 0;

  if (team0Adjacent && team1Adjacent) {
    // Both teams adjacent - random control
    // Use deterministic "random" based on turn number
    state.monument.controlledBy = state.turn % 2;
  } else if (team0Adjacent) {
    state.monument.controlledBy = 0;
  } else if (team1Adjacent) {
    state.monument.controlledBy = 1;
  }
  // If no one adjacent, keep previous control

  // Award monument score
  if (state.monument.controlledBy !== null) {
    const monumentScore = getMonumentScore(state.turn);
    const controller = state.players.find(p => p.id === state.monument.controlledBy);
    controller.score += monumentScore;

    events.push({
      type: 'MONUMENT_CONTROL',
      data: {
        controlledBy: state.monument.controlledBy,
        scoreAwarded: monumentScore
      }
    });
  }
}

/**
 * Check for game end conditions
 */
function checkGameEnd(state) {
  // Check elimination (no cities)
  for (const player of state.players) {
    const playerCities = state.cities.filter(c => c.owner === player.id);
    if (playerCities.length === 0) {
      state.gameOver = true;
      state.winner = player.id === 0 ? 1 : 0; // Other player wins
      return;
    }
  }

  // Check max turns
  if (state.turn >= state.maxTurns) {
    state.gameOver = true;

    // Compare scores
    const score0 = state.players[0].score;
    const score1 = state.players[1].score;

    if (score0 > score1) {
      state.winner = 0;
    } else if (score1 > score0) {
      state.winner = 1;
    } else {
      state.winner = null; // Tie
    }
  }
}

/**
 * Reset unit movement flags for next turn
 */
function resetUnitFlags(state) {
  for (const unit of state.units) {
    unit.canMove = true;
  }
}

/**
 * Main turn processor - stateless function
 * @param {Object} state - Current game state
 * @param {Object} actions - Actions from both players { player0: [], player1: [] }
 * @returns {Object} { newState, errors, info }
 */
function processTurn(state, actions) {
  // Clone state for immutability
  const newState = cloneState(state);
  const events = [];
  const errors = [];

  // Don't process if game is over
  if (newState.gameOver) {
    return {
      newState,
      errors: ['Game is already over'],
      info: {
        gameOver: true,
        winner: newState.winner,
        turnEvents: []
      }
    };
  }

  // Process all phases in order
  processIncomePhase(newState, events);
  processArcherPhase(newState, events);
  processMovementPhase(newState, actions, events);
  processCombatPhase(newState, events);
  processBuildPhase(newState, actions, events);
  processScoringPhase(newState, events);

  // Check game end
  checkGameEnd(newState);

  // If game not over, prepare for next turn
  if (!newState.gameOver) {
    resetUnitFlags(newState);
    newState.turn++;

    // Recalculate income for display
    for (const player of newState.players) {
      player.income = calculateIncome(newState, player.id);
    }
  }

  return {
    newState,
    errors,
    info: {
      gameOver: newState.gameOver,
      winner: newState.winner,
      turnEvents: events
    }
  };
}

module.exports = {
  processTurn,
  cloneState,
  getScoreMultiplier,
  getMonumentScore,
  calculateIncome
};
