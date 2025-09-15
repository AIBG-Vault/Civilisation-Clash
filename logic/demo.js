import { Game } from './game.js';

console.log('=== Civilization Clash MVP Demo ===\n');

const game = new Game();

function printGameState() {
  const state = game.getState();
  console.log(`Turn ${state.turn}/${state.maxTurns}`);
  console.log(`Team 0 units: ${state.units.filter((u) => u.owner === 0).length}`);
  console.log(`Team 1 units: ${state.units.filter((u) => u.owner === 1).length}`);

  // Create a simple ASCII map
  const map = [];
  for (let y = 0; y < state.height; y++) {
    map[y] = [];
    for (let x = 0; x < state.width; x++) {
      map[y][x] = '.';
    }
  }

  // Place units on map with HP indicator
  state.units.forEach((unit) => {
    const symbol = unit.owner === 0 ? '0' : '1';
    map[unit.y][unit.x] = symbol + unit.hp;
  });

  // Print map
  console.log('\nMap:');
  map.forEach((row) => console.log(row.join(' ')));
  console.log('');
}

// Initial state
console.log('Initial setup:');
printGameState();

// Simulate a few turns
console.log('Simulating battle (units converge to center)...\n');

for (let i = 0; i < 10; i++) {
  const state = game.getState();

  // Simple AI: move units toward center
  const team0Actions = [];
  const team1Actions = [];

  state.units.forEach((unit) => {
    const actions = unit.owner === 0 ? team0Actions : team1Actions;

    // Move toward center (x=7) with some vertical spread to avoid blocking
    if (unit.x < 7) {
      // Team 0 moves right
      let targetX = unit.x + 1;
      let targetY = unit.y;

      // Add some vertical movement to spread out
      if (unit.id === 1 && unit.y > 3) targetY = unit.y - 1;
      if (unit.id === 3 && unit.y < 7) targetY = unit.y + 1;

      actions.push({
        type: 'MOVE',
        unitId: unit.id,
        targetX: targetX,
        targetY: targetY,
      });
    } else if (unit.x > 7) {
      // Team 1 moves left
      let targetX = unit.x - 1;
      let targetY = unit.y;

      // Add some vertical movement to spread out
      if (unit.id === 4 && unit.y > 3) targetY = unit.y - 1;
      if (unit.id === 6 && unit.y < 7) targetY = unit.y + 1;

      actions.push({
        type: 'MOVE',
        unitId: unit.id,
        targetX: targetX,
        targetY: targetY,
      });
    }
  });

  game.processActions(team0Actions, team1Actions);

  console.log(`After turn ${game.turn}:`);
  printGameState();

  if (game.isOver()) {
    console.log('Game Over!');
    if (game.getWinner() === null) {
      console.log('Result: TIE');
    } else {
      console.log(`Winner: Team ${game.getWinner()}`);
    }
    break;
  }
}

console.log('Demo complete!');
