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
  // Enforce odd dimensions so the center tile is the true rotational center
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;

  // Seeded PRNG for reproducibility
  let randomState = seed !== null ? seed : Date.now();
  const random = () => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x7fffffff;
  };

  const tiles = [];
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  // --- Biome map ---
  // Horizontal split: above monument = plains, below = rocky.
  // Line symmetric (same biome at (x,y) and (W-1-x,y)).
  // Both biomes touch the monument area.
  // Slight wave on the boundary for a natural feel.
  const biomeWaveAmp = 0.8 + random() * 0.4;
  const biomeWaveFreq = 0.3 + random() * 0.2;
  const getBiome = (x, y) => {
    const wave = Math.sin(x * biomeWaveFreq) * biomeWaveAmp;
    return y - centerY + wave > 0 ? 'rocky' : 'plains';
  };

  // --- Generate left half (x < centerX), then 180° point-symmetric mirror ---
  // Center column handled separately for perfect symmetry.
  const leftHalf = [];

  // Simple 2D noise via scattered seed points
  const noisePoints = [];
  for (let i = 0; i < 8; i++) {
    noisePoints.push({
      x: random() * width,
      y: random() * height,
      v: random() * 0.4 - 0.2,
    });
  }
  const noise = (px, py) => {
    let val = 0;
    for (const np of noisePoints) {
      const d = Math.sqrt((px - np.x) ** 2 + (py - np.y) ** 2);
      val += np.v / (1 + d * 0.3);
    }
    return val;
  };

  // Helper: generate terrain for a tile at (x, y)
  const generateTerrain = (x, y) => {
    // Edge tiles always water
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      return TERRAIN.WATER;
    }

    // Normalized distance from center (elliptical for rectangular maps)
    const nx = (x - centerX) / (width / 2);
    const ny = (y - centerY) / (height / 2);
    const dist = Math.sqrt(nx * nx + ny * ny);

    // Island shape: land probability falls off from center
    const landProb = 1.0 - dist * 0.85 + noise(x, y);

    if (landProb > 0.35) {
      // Determine mountain probability based on biome
      const biome = getBiome(x, y);
      let mountainProb;
      if (biome === 'rocky') {
        mountainProb = 0.22 + noise(x + 50, y + 50) * 0.1;
      } else {
        mountainProb = 0.04;
      }

      // Near the monument center, reduce mountains so both biomes are accessible
      const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (distToCenter < 3) {
        mountainProb = 0;
      }

      if (random() < mountainProb) {
        return TERRAIN.MOUNTAIN;
      } else {
        return TERRAIN.FIELD;
      }
    } else {
      return TERRAIN.WATER;
    }
  };

  // Generate left half (x = 0 to centerX-1)
  for (let y = 0; y < height; y++) {
    leftHalf[y] = [];
    for (let x = 0; x < centerX; x++) {
      leftHalf[y][x] = generateTerrain(x, y);
    }
  }

  // Generate center column (x = centerX) — only top half (y < centerY),
  // bottom half mirrored for perfect symmetry
  const centerCol = [];
  for (let y = 0; y < centerY; y++) {
    centerCol[y] = generateTerrain(centerX, y);
  }

  // Clear area around starting positions (player 0 on left)
  const startY = centerY;
  const player0StartX = 2;
  const player1StartX = width - 3;

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const y = startY + dy;
      const x = player0StartX + dx;
      if (y >= 0 && y < height && x >= 0 && x < centerX) {
        leftHalf[y][x] = TERRAIN.FIELD;
      }
    }
  }

  // Clear area around monument (in leftHalf and centerCol)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const y = centerY + dy;
      const x = centerX + dx;
      if (y >= 0 && y < height) {
        if (x < centerX && x >= 0) {
          leftHalf[y][x] = TERRAIN.FIELD;
        } else if (x === centerX && y < centerY) {
          centerCol[y] = TERRAIN.FIELD;
        }
      }
    }
  }

  // --- Guarantee a connected land corridor from P0 start to monument ---
  // Carve a 3-tile-wide horizontal path along y=centerY (±1).
  // Point symmetry mirrors this for P1 automatically.
  for (let x = 1; x < centerX; x++) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = startY + dy;
      if (y > 0 && y < height - 1) {
        if (leftHalf[y][x] === TERRAIN.WATER || leftHalf[y][x] === TERRAIN.MOUNTAIN) {
          leftHalf[y][x] = TERRAIN.FIELD;
        }
      }
    }
  }
  // Also ensure the center column at centerY ±1 is passable
  for (let dy = -1; dy <= 1; dy++) {
    const y = centerY + dy;
    if (y > 0 && y < centerY) {
      if (centerCol[y] === TERRAIN.WATER || centerCol[y] === TERRAIN.MOUNTAIN) {
        centerCol[y] = TERRAIN.FIELD;
      }
    }
  }

  // Build full map with 180° point symmetry around center
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let terrain;

      if (x === centerX && y === centerY) {
        terrain = TERRAIN.MONUMENT;
      } else if (x === centerX) {
        // Center column: top half generated, bottom half mirrored
        if (y < centerY) {
          terrain = centerCol[y] || TERRAIN.WATER;
        } else {
          terrain = centerCol[height - 1 - y] || TERRAIN.WATER;
        }
      } else if (x < centerX) {
        // Left half: use generated data
        terrain = leftHalf[y][x] !== undefined ? leftHalf[y][x] : TERRAIN.WATER;
      } else {
        // Right half: 180° rotation from left half
        const mirrorX = width - 1 - x;
        const mirrorY = height - 1 - y;
        terrain =
          leftHalf[mirrorY] && leftHalf[mirrorY][mirrorX] !== undefined
            ? leftHalf[mirrorY][mirrorX]
            : TERRAIN.WATER;
      }

      tiles.push({ x, y, type: terrain, owner: null });
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

  const cities = [
    { x: player0StartX, y: startY, owner: 0 },
    { x: player1StartX, y: startY, owner: 1 },
  ];

  const monument = {
    x: centerX,
    y: centerY,
    controlledBy: null,
  };

  return { width, height, tiles, cities, monument };
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
