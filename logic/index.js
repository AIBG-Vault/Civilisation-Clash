/**
 * Civilization Clash - Game Logic
 * Main entry point and exports
 */

const { processTurn, cloneState, getScoreMultiplier, calculateIncome } = require('./processor');
const {
  generateMap,
  generateTournamentMap,
  createInitialState,
  validateMap,
} = require('./map-generator');
const {
  validateAction,
  validateActions,
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
  isAdjacentToOwnTerritory,
} = require('./validation');
const { renderState, printState, renderEvents, printEvents } = require('./terminal');
const constants = require('./constants');

// Re-export everything
module.exports = {
  // Core functions
  processTurn,
  createInitialState,
  generateMap,
  generateTournamentMap,
  validateActions,

  // Utility functions
  validateAction,
  validateMap,
  cloneState,
  getScoreMultiplier,
  calculateIncome,

  // Helper functions
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
  isAdjacentToOwnTerritory,

  // Terminal visualization
  renderState,
  printState,
  renderEvents,
  printEvents,

  // Constants
  ...constants,
};
