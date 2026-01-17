/**
 * Map generation for Civilization Clash
 * Generates symmetrical island maps with starting positions
 */

const { TERRAIN, MODES, MODE_SETTINGS } = require('./constants');

/**
 * Generate a random symmetrical island map
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @param {number} seed - Optional seed for deterministic generation
 * @returns {Object} Map object with tiles, cities, and monument
 */
function generateMap(width, height, seed = null) {
  // Simple seeded random for reproducibility
  let randomState = seed !== null ? seed : Date.now();
  const random = () => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x7fffffff;
  };

  const tiles = [];
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  // Generate half the map, then mirror for symmetry
  // We'll generate the left half and mirror to right
  const halfWidth = Math.ceil(width / 2);

  // First pass: create base terrain for left half
  const leftHalf = [];
  for (let y = 0; y < height; y++) {
    leftHalf[y] = [];
    for (let x = 0; x < halfWidth; x++) {
      // Distance from center for island shape
      const distFromCenterX = Math.abs(x - centerX) / (width / 2);
      const distFromCenterY = Math.abs(y - centerY) / (height / 2);
      const distFromCenter = Math.sqrt(distFromCenterX ** 2 + distFromCenterY ** 2);

      // Base probability of being land (higher near center)
      let landProb = 1 - distFromCenter * 0.8;

      // Add some noise
      landProb += (random() - 0.5) * 0.3;

      // Edge tiles are always water
      if (x === 0 || y === 0 || y === height - 1) {
        leftHalf[y][x] = TERRAIN.WATER;
      } else if (landProb > 0.4) {
        // Randomly add mountains (10% of land tiles)
        if (random() < 0.1 && x !== 1 && x !== halfWidth - 1) {
          leftHalf[y][x] = TERRAIN.MOUNTAIN;
        } else {
          leftHalf[y][x] = TERRAIN.FIELD;
        }
      } else {
        leftHalf[y][x] = TERRAIN.WATER;
      }
    }
  }

  // Ensure starting positions are clear (near edges)
  const startY = centerY;
  const player0StartX = 2;
  const player1StartX = width - 3;

  // Clear area around starting positions
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const y = startY + dy;
      const x = player0StartX + dx;
      if (y >= 0 && y < height && x >= 0 && x < halfWidth) {
        leftHalf[y][x] = TERRAIN.FIELD;
      }
    }
  }

  // Create full map with point symmetry (180-degree rotation)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let terrain;

      // Center tile is monument
      if (x === centerX && y === centerY) {
        terrain = TERRAIN.MONUMENT;
      } else if (x < halfWidth) {
        terrain = leftHalf[y][x];
      } else {
        // Mirror: point at (x, y) mirrors to (width-1-x, height-1-y)
        const mirrorX = width - 1 - x;
        const mirrorY = height - 1 - y;
        if (mirrorX >= 0 && mirrorX < halfWidth && mirrorY >= 0 && mirrorY < height) {
          terrain = leftHalf[mirrorY][mirrorX];
        } else {
          terrain = TERRAIN.WATER;
        }
      }

      tiles.push({
        x,
        y,
        type: terrain,
        owner: null,
      });
    }
  }

  // Set starting territory (3x3 around starting cities)
  const setStartingTerritory = (cityX, cityY, owner) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tile = tiles.find((t) => t.x === cityX + dx && t.y === cityY + dy);
        if (tile && tile.type === TERRAIN.FIELD) {
          tile.owner = owner;
        }
      }
    }
  };

  setStartingTerritory(player0StartX, startY, 0);
  setStartingTerritory(player1StartX, startY, 1);

  // Create starting cities
  const cities = [
    { x: player0StartX, y: startY, owner: 0 },
    { x: player1StartX, y: startY, owner: 1 },
  ];

  // Create monument
  const monument = {
    x: centerX,
    y: centerY,
    controlledBy: null,
  };

  return {
    width,
    height,
    tiles,
    cities,
    monument,
  };
}

/**
 * Create initial game state
 * @param {Object} options - Game options
 * @returns {Object} Initial game state
 */
function createInitialState(options = {}) {
  const mode = options.mode || MODES.STANDARD;
  const settings = MODE_SETTINGS[mode];

  const mapWidth = options.mapWidth || settings.mapWidth;
  const mapHeight = options.mapHeight || settings.mapHeight;
  const startingGold = settings.startingGold;
  const maxTurns = settings.maxTurns;

  // Generate or use custom map
  let mapData;
  if (options.customMap) {
    mapData = options.customMap;
  } else {
    mapData = generateMap(mapWidth, mapHeight, options.seed);
  }

  // Calculate initial income for each player
  const calculateIncome = (playerId) => {
    let income = 0;
    // Territory income
    for (const tile of mapData.tiles) {
      if (tile.owner === playerId && tile.type === TERRAIN.FIELD) {
        income += 0.5;
      }
    }
    // City income
    for (const city of mapData.cities) {
      if (city.owner === playerId) {
        income += 5;
      }
    }
    return income;
  };

  return {
    turn: 1,
    maxTurns,
    gameOver: false,
    winner: null,
    mode,
    players: [
      {
        id: 0,
        gold: startingGold,
        score: 0,
        income: calculateIncome(0),
      },
      {
        id: 1,
        gold: startingGold,
        score: 0,
        income: calculateIncome(1),
      },
    ],
    map: {
      width: mapData.width,
      height: mapData.height,
      tiles: mapData.tiles,
    },
    units: [],
    cities: mapData.cities,
    monument: mapData.monument,
  };
}

/**
 * Validate a map structure
 * @param {Object} map - Map to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateMap(map) {
  const errors = [];

  if (!map.width || !map.height) {
    errors.push('Map must have width and height');
  }

  if (!Array.isArray(map.tiles)) {
    errors.push('Map must have tiles array');
  }

  // Check all tiles exist
  const expectedTiles = map.width * map.height;
  if (map.tiles.length !== expectedTiles) {
    errors.push(`Expected ${expectedTiles} tiles, got ${map.tiles.length}`);
  }

  // Check monument exists at center
  const centerX = Math.floor(map.width / 2);
  const centerY = Math.floor(map.height / 2);
  const monumentTile = map.tiles.find((t) => t.x === centerX && t.y === centerY);
  if (!monumentTile || monumentTile.type !== TERRAIN.MONUMENT) {
    errors.push('Monument must be at center of map');
  }

  // Check starting cities
  if (!Array.isArray(map.cities) || map.cities.length < 2) {
    errors.push('Map must have at least 2 starting cities');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  generateMap,
  createInitialState,
  validateMap,
};
