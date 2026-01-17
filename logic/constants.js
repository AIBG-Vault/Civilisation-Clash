/**
 * Game constants for Civilization Clash
 */

// Game modes
const MODES = {
  STANDARD: 'standard',
  BLITZ: 'blitz',
};

// Mode-specific settings
const MODE_SETTINGS = {
  [MODES.STANDARD]: {
    maxTurns: 200,
    mapWidth: 25,
    mapHeight: 15,
    startingGold: 20,
  },
  [MODES.BLITZ]: {
    maxTurns: 50,
    mapWidth: 15,
    mapHeight: 10,
    startingGold: 50,
  },
};

// Terrain types
const TERRAIN = {
  FIELD: 'FIELD',
  MOUNTAIN: 'MOUNTAIN',
  WATER: 'WATER',
  MONUMENT: 'MONUMENT',
};

// Terrain properties
const TERRAIN_PROPS = {
  [TERRAIN.FIELD]: { passable: true, controllable: true, income: 0.5 },
  [TERRAIN.MOUNTAIN]: { passable: false, controllable: false, income: 0 },
  [TERRAIN.WATER]: { passable: false, controllable: false, income: 0 },
  [TERRAIN.MONUMENT]: { passable: false, controllable: false, income: 0 },
};

// Unit types
const UNIT_TYPES = {
  SOLDIER: 'SOLDIER',
  ARCHER: 'ARCHER',
  RAIDER: 'RAIDER',
};

// Unit stats
const UNIT_STATS = {
  [UNIT_TYPES.SOLDIER]: {
    cost: 20,
    hp: 3,
    damage: 1,
    movement: 1,
    deathScore: 10, // Score given to owner when this unit dies
    hasZoC: true, // Projects Zone of Control
    zocRange: 2, // ZoC radius
    immuneToZoC: true, // Ignores enemy ZoC
    canCaptureCities: true,
    meleeAttack: true, // Auto-attacks adjacent enemies
    rangedAttack: false,
  },
  [UNIT_TYPES.ARCHER]: {
    cost: 25,
    hp: 2,
    damage: 1,
    movement: 1,
    deathScore: 12,
    hasZoC: false,
    zocRange: 0,
    immuneToZoC: false,
    canCaptureCities: false,
    meleeAttack: false, // Does NOT melee
    rangedAttack: true,
    rangedRange: 2, // Can shoot up to distance 2
  },
  [UNIT_TYPES.RAIDER]: {
    cost: 10,
    hp: 1,
    damage: 1,
    movement: 2,
    deathScore: 3,
    hasZoC: false,
    zocRange: 0,
    immuneToZoC: false,
    canCaptureCities: false,
    meleeAttack: true,
    rangedAttack: false,
  },
};

// Economy
const ECONOMY = {
  FIELD_INCOME: 0.5, // Gold per turn per controlled field
  CITY_INCOME: 5, // Gold per turn per city
  EXPAND_COST: 5, // Cost to expand territory by one tile
  CITY_COST: 80, // Cost to build a city
};

// Scoring
const SCORING = {
  DAMAGE_DEALT: 5, // Score per damage dealt
  KILL_BONUS: 7, // Score when killing an enemy unit (instead of 5)
  MONUMENT_EARLY: 5, // Turns 1-100
  MONUMENT_MID: 10, // Turns 101-150
  MONUMENT_LATE: 15, // Turns 151-200
};

// Score multipliers (for combat score only, not monument)
const SCORE_MULTIPLIERS = {
  EARLY: { turn: 1, multiplier: 1 },
  MID: { turn: 101, multiplier: 1.5 },
  LATE: { turn: 151, multiplier: 2 },
};

// Action types
const ACTIONS = {
  MOVE: 'MOVE',
  BUILD_UNIT: 'BUILD_UNIT',
  BUILD_CITY: 'BUILD_CITY',
  EXPAND_TERRITORY: 'EXPAND_TERRITORY',
  PASS: 'PASS',
};

// Direction offsets for distance 1 (8 surrounding tiles)
const DISTANCE_1_OFFSETS = [
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
];

// Direction offsets for distance 2 (additional 12 tiles beyond distance 1)
const DISTANCE_2_ONLY_OFFSETS = [
  { dx: -2, dy: -1 },
  { dx: -2, dy: 0 },
  { dx: -2, dy: 1 },
  { dx: 2, dy: -1 },
  { dx: 2, dy: 0 },
  { dx: 2, dy: 1 },
  { dx: -1, dy: -2 },
  { dx: 0, dy: -2 },
  { dx: 1, dy: -2 },
  { dx: -1, dy: 2 },
  { dx: 0, dy: 2 },
  { dx: 1, dy: 2 },
];

// All distance 2 offsets (distance 1 + distance 2 only = 20 tiles)
const DISTANCE_2_OFFSETS = [...DISTANCE_1_OFFSETS, ...DISTANCE_2_ONLY_OFFSETS];

module.exports = {
  MODES,
  MODE_SETTINGS,
  TERRAIN,
  TERRAIN_PROPS,
  UNIT_TYPES,
  UNIT_STATS,
  ECONOMY,
  SCORING,
  SCORE_MULTIPLIERS,
  ACTIONS,
  DISTANCE_1_OFFSETS,
  DISTANCE_2_ONLY_OFFSETS,
  DISTANCE_2_OFFSETS,
};
