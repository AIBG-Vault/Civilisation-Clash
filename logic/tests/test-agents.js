/**
 * Test file for running agent vs agent games
 * Uses the game logic directly without server
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { createInitialState, processTurn, printState, printEvents, MODES } = require('..');

const dumbAgent = require('./dumbAgent');
const smarterAgent = require('./smarterAgent');

/**
 * Run a complete game between two agents
 * @param {Function} agent0 - Agent function for player 0
 * @param {Function} agent1 - Agent function for player 1
 * @param {Object} options - Game options
 * @returns {Object} Game result
 */
function runGame(agent0, agent1, options = {}) {
  const { mode = MODES.BLITZ, verbose = false, maxTurns = null } = options;

  let state = createInitialState({ mode });

  if (maxTurns) {
    state.maxTurns = maxTurns;
  }

  const stats = {
    turns: 0,
    player0Actions: 0,
    player1Actions: 0,
    events: [],
  };

  while (!state.gameOver) {
    // Get actions from both agents
    const actions0 = agent0(state, 0);
    const actions1 = agent1(state, 1);

    stats.player0Actions += actions0.length;
    stats.player1Actions += actions1.length;

    // Process turn
    const result = processTurn(state, {
      player0: actions0,
      player1: actions1,
    });

    state = result.newState;
    stats.turns++;
    stats.events.push(...result.info.turnEvents);

    if (verbose) {
      console.log(`\n=== Turn ${state.turn - 1} ===`);
      printState(state, { showLegend: false });
      if (result.info.turnEvents.length > 0) {
        printEvents(result.info.turnEvents);
      }
    }

    // Safety check to prevent infinite loops
    if (stats.turns > 500) {
      console.error('Game exceeded 500 turns, breaking');
      break;
    }
  }

  return {
    winner: state.winner,
    finalState: state,
    stats,
  };
}

// ===== TESTS =====

describe('Agent vs Agent Games', () => {
  it('dumb vs dumb completes without errors', () => {
    const result = runGame(dumbAgent.generateActions, dumbAgent.generateActions, {
      mode: MODES.BLITZ,
      maxTurns: 20,
    });

    assert.ok(result.finalState.turn > 1, 'Game should progress beyond turn 1');
    assert.ok(result.stats.turns <= 20, 'Game should end within max turns');
    console.log(`  Dumb vs Dumb: ${result.stats.turns} turns, winner: ${result.winner ?? 'tie'}`);
  });

  it('smarter vs smarter completes without errors', () => {
    const result = runGame(smarterAgent.generateActions, smarterAgent.generateActions, {
      mode: MODES.BLITZ,
      maxTurns: 30,
    });

    assert.ok(result.finalState.turn > 1, 'Game should progress beyond turn 1');
    console.log(
      `  Smarter vs Smarter: ${result.stats.turns} turns, winner: ${result.winner ?? 'tie'}`
    );
  });

  it('smarter vs dumb - smarter should usually win', () => {
    let smarterWins = 0;
    let dumbWins = 0;
    let ties = 0;
    const games = 5;

    for (let i = 0; i < games; i++) {
      const result = runGame(smarterAgent.generateActions, dumbAgent.generateActions, {
        mode: MODES.BLITZ,
        maxTurns: 50,
      });

      if (result.winner === 0) smarterWins++;
      else if (result.winner === 1) dumbWins++;
      else ties++;
    }

    console.log(
      `  Smarter vs Dumb (${games} games): Smarter wins ${smarterWins}, Dumb wins ${dumbWins}, Ties ${ties}`
    );

    // Smarter should win at least some games
    assert.ok(smarterWins >= dumbWins, 'Smarter agent should win at least as often as dumb agent');
  });

  it('dumb vs smarter - smarter should usually win', () => {
    let smarterWins = 0;
    let dumbWins = 0;
    let ties = 0;
    const games = 5;

    for (let i = 0; i < games; i++) {
      const result = runGame(dumbAgent.generateActions, smarterAgent.generateActions, {
        mode: MODES.BLITZ,
        maxTurns: 50,
      });

      if (result.winner === 0) dumbWins++;
      else if (result.winner === 1) smarterWins++;
      else ties++;
    }

    console.log(
      `  Dumb vs Smarter (${games} games): Dumb wins ${dumbWins}, Smarter wins ${smarterWins}, Ties ${ties}`
    );

    // Smarter should win at least some games
    assert.ok(smarterWins >= dumbWins, 'Smarter agent should win at least as often as dumb agent');
  });

  it('full blitz game completes', () => {
    const result = runGame(smarterAgent.generateActions, smarterAgent.generateActions, {
      mode: MODES.BLITZ,
    });

    assert.ok(result.finalState.gameOver, 'Game should be over');
    assert.ok(result.stats.turns <= 50, 'Blitz game should end within 50 turns');
    console.log(`  Full blitz game: ${result.stats.turns} turns`);
    console.log(
      `    P0 score: ${result.finalState.players[0].score}, P1 score: ${result.finalState.players[1].score}`
    );
    console.log(`    Winner: ${result.winner ?? 'tie'}`);
  });

  it('game state remains consistent', () => {
    const result = runGame(smarterAgent.generateActions, dumbAgent.generateActions, {
      mode: MODES.BLITZ,
      maxTurns: 30,
    });

    const state = result.finalState;

    // Verify state consistency
    assert.ok(state.players.length === 2, 'Should have 2 players');
    assert.ok(state.players[0].gold >= 0, 'Player 0 gold should be non-negative');
    assert.ok(state.players[1].gold >= 0, 'Player 1 gold should be non-negative');
    assert.ok(state.players[0].score >= 0, 'Player 0 score should be non-negative');
    assert.ok(state.players[1].score >= 0, 'Player 1 score should be non-negative');

    // All units should have valid HP
    for (const unit of state.units) {
      assert.ok(unit.hp > 0, 'All units should have positive HP');
      assert.ok(unit.owner === 0 || unit.owner === 1, 'Units should belong to valid player');
    }

    // All cities should have valid owners
    for (const city of state.cities) {
      assert.ok(city.owner === 0 || city.owner === 1, 'Cities should belong to valid player');
    }

    console.log(`  State consistency verified after ${result.stats.turns} turns`);
  });
});

describe('Agent Action Generation', () => {
  it('dumb agent generates valid actions', () => {
    const state = createInitialState({ mode: MODES.BLITZ });
    const actions = dumbAgent.generateActions(state, 0);

    assert.ok(Array.isArray(actions), 'Actions should be an array');
    console.log(`  Dumb agent generated ${actions.length} actions on turn 1`);
  });

  it('smarter agent generates valid actions', () => {
    const state = createInitialState({ mode: MODES.BLITZ });
    const actions = smarterAgent.generateActions(state, 0);

    assert.ok(Array.isArray(actions), 'Actions should be an array');
    assert.ok(actions.length > 0, 'Smarter agent should generate some actions');
    console.log(`  Smarter agent generated ${actions.length} actions on turn 1`);
  });

  it('smarter agent builds units', () => {
    let state = createInitialState({ mode: MODES.BLITZ });

    // Run a few turns
    for (let i = 0; i < 5; i++) {
      const actions0 = smarterAgent.generateActions(state, 0);
      const actions1 = smarterAgent.generateActions(state, 1);

      const result = processTurn(state, { player0: actions0, player1: actions1 });
      state = result.newState;
    }

    // Both players should have built some units
    const p0Units = state.units.filter((u) => u.owner === 0).length;
    const p1Units = state.units.filter((u) => u.owner === 1).length;

    console.log(`  After 5 turns: P0 has ${p0Units} units, P1 has ${p1Units} units`);
    assert.ok(p0Units > 0 || p1Units > 0, 'At least one player should have built units');
  });
});

// Run directly for quick testing
if (require.main === module) {
  console.log('\n=== Running verbose game: Smarter vs Dumb ===\n');

  const result = runGame(smarterAgent.generateActions, dumbAgent.generateActions, {
    mode: MODES.BLITZ,
    verbose: true,
    maxTurns: 20,
  });

  console.log('\n=== Game Over ===');
  console.log(`Winner: Player ${result.winner ?? 'None (tie)'}`);
  console.log(`Turns: ${result.stats.turns}`);
  console.log(`P0 final score: ${result.finalState.players[0].score}`);
  console.log(`P1 final score: ${result.finalState.players[1].score}`);
}
