import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { spawn } from 'child_process';

// Helper to wait for a message
function waitForMessage(ws, type, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);

    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.type === type) {
        clearTimeout(timer);
        ws.removeListener('message', handler);
        resolve(msg);
      }
    };

    ws.on('message', handler);
  });
}

// Helper to create and authenticate a client
async function createAuthenticatedClient(password, name = 'TestClient') {
  const ws = new WebSocket('ws://localhost:8081'); // Use different port for tests

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  // Send AUTH message
  ws.send(JSON.stringify({
    type: 'AUTH',
    password: password,
    name: name
  }));

  // Wait for AUTH_SUCCESS
  const authResponse = await waitForMessage(ws, 'AUTH_SUCCESS');

  return { ws, authResponse };
}

describe('Server Protocol Tests', () => {
  let serverProcess;

  beforeEach(async () => {
    // Start server on test port
    serverProcess = spawn('node', ['server-v2.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '8081' }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Authentication Tests', () => {
    test('should reject connection without AUTH message', async () => {
      const ws = new WebSocket('ws://localhost:8081');

      await new Promise((resolve) => {
        ws.once('open', resolve);
      });

      // Don't send AUTH, wait for timeout
      await new Promise((resolve) => {
        ws.once('close', resolve);
        // Server should close connection after 5 seconds
      });

      assert.strictEqual(ws.readyState, WebSocket.CLOSED);
    });

    test('should reject invalid password', async () => {
      const ws = new WebSocket('ws://localhost:8081');

      await new Promise((resolve) => {
        ws.once('open', resolve);
      });

      ws.send(JSON.stringify({
        type: 'AUTH',
        password: 'invalid_password',
        name: 'TestClient'
      }));

      await new Promise((resolve) => {
        ws.once('message', (data) => {
          const msg = JSON.parse(data);
          assert.strictEqual(msg.type, 'ERROR');
          assert.strictEqual(msg.message, 'Invalid password');
          resolve();
        });
      });

      await new Promise(resolve => {
        ws.once('close', resolve);
      });

      assert.strictEqual(ws.readyState, WebSocket.CLOSED);
    });

    test('should accept valid team passwords', async () => {
      const { ws: ws0, authResponse: auth0 } = await createAuthenticatedClient('password0', 'Team0Bot');
      assert.strictEqual(auth0.teamId, 0);
      assert.strictEqual(auth0.role, 'player');

      const { ws: ws1, authResponse: auth1 } = await createAuthenticatedClient('password1', 'Team1Bot');
      assert.strictEqual(auth1.teamId, 1);
      assert.strictEqual(auth1.role, 'player');

      ws0.close();
      ws1.close();
    });

    test('should accept spectator password', async () => {
      const { ws, authResponse } = await createAuthenticatedClient('spectator', 'Spectator');
      assert.strictEqual(authResponse.teamId, -1);
      assert.strictEqual(authResponse.role, 'spectator');
      ws.close();
    });

    test('should accept admin password', async () => {
      const { ws, authResponse } = await createAuthenticatedClient('admin123', 'Admin');
      assert.strictEqual(authResponse.teamId, -1);
      assert.strictEqual(authResponse.role, 'admin');
      ws.close();
    });
  });

  describe('Game State Tests', () => {
    test('should send game state immediately after AUTH_SUCCESS', async () => {
      const { ws } = await createAuthenticatedClient('password0');

      const gameState = await waitForMessage(ws, 'GAME_STATE');
      assert(gameState.state);
      assert(gameState.state.map);
      assert(gameState.state.teams);
      assert(gameState.state.units);
      assert.strictEqual(gameState.yourTeamId, 0);

      ws.close();
    });

    test('should send game state to spectator without team assignment', async () => {
      const { ws } = await createAuthenticatedClient('spectator');

      const gameState = await waitForMessage(ws, 'GAME_STATE');
      assert(gameState.state);
      assert.strictEqual(gameState.yourTeamId, -1);

      ws.close();
    });
  });

  describe('Action Submission Tests', () => {
    test('should process turn when both teams submit', async () => {
      const { ws: ws0 } = await createAuthenticatedClient('password0');
      const { ws: ws1 } = await createAuthenticatedClient('password1');

      // Wait for initial game state
      await waitForMessage(ws0, 'GAME_STATE');
      await waitForMessage(ws1, 'GAME_STATE');

      // Both submit actions
      ws0.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      ws1.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // Both should receive new game state
      const newState0 = await waitForMessage(ws0, 'GAME_STATE');
      const newState1 = await waitForMessage(ws1, 'GAME_STATE');

      assert.strictEqual(newState0.state.turn, 1);
      assert.strictEqual(newState1.state.turn, 1);

      ws0.close();
      ws1.close();
    });

    test('should not process turn with only one team submission', async () => {
      const { ws: ws0 } = await createAuthenticatedClient('password0');

      // Wait for initial game state
      await waitForMessage(ws0, 'GAME_STATE');

      // Only one team submits
      ws0.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // Should not receive new state immediately (timeout disabled in test)
      const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 1000));
      const message = Promise.race([
        waitForMessage(ws0, 'GAME_STATE'),
        timeout
      ]);

      const result = await message;
      assert.strictEqual(result, 'timeout');

      ws0.close();
    });

    test('should allow spectators to receive updates but not submit actions', async () => {
      const { ws: player } = await createAuthenticatedClient('password0');
      const { ws: spectator } = await createAuthenticatedClient('spectator');

      // Spectator tries to submit actions
      spectator.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // Should not affect game
      const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 500));
      const message = Promise.race([
        waitForMessage(player, 'GAME_STATE'),
        timeout
      ]);

      const result = await message;
      assert.strictEqual(result, 'timeout');

      player.close();
      spectator.close();
    });
  });

  describe('Admin Command Tests', () => {
    test('should allow admin to disable timeout', async () => {
      const { ws: admin } = await createAuthenticatedClient('admin123');

      admin.send(JSON.stringify({
        type: 'ADMIN_COMMAND',
        action: 'DISABLE_TIMEOUT'
      }));

      const adminMsg = await waitForMessage(admin, 'ADMIN_MESSAGE');
      assert(adminMsg.message.includes('disabled'));

      admin.close();
    });

    test('should allow admin to enable bot timeout', async () => {
      const { ws: admin } = await createAuthenticatedClient('admin123');

      admin.send(JSON.stringify({
        type: 'ADMIN_COMMAND',
        action: 'ENABLE_BOT_TIMEOUT'
      }));

      const adminMsg = await waitForMessage(admin, 'ADMIN_MESSAGE');
      assert(adminMsg.message.includes('250ms'));

      admin.close();
    });

    test('should not allow players to use admin commands', async () => {
      const { ws: player } = await createAuthenticatedClient('password0');

      player.send(JSON.stringify({
        type: 'ADMIN_COMMAND',
        action: 'DISABLE_TIMEOUT'
      }));

      // Should not receive admin message
      const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 500));
      const message = Promise.race([
        waitForMessage(player, 'ADMIN_MESSAGE'),
        timeout
      ]);

      const result = await message;
      assert.strictEqual(result, 'timeout');

      player.close();
    });
  });

  describe('Disconnection Handling Tests', () => {
    test('should handle player disconnection gracefully', async () => {
      const { ws: ws0 } = await createAuthenticatedClient('password0');
      const { ws: ws1 } = await createAuthenticatedClient('password1');

      // Disconnect one player
      ws0.close();

      // Other player should still be able to play (with timeout)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try to submit action
      ws1.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // Should not crash server
      await new Promise(resolve => setTimeout(resolve, 500));

      ws1.close();
    });

    test('should reset game when all players disconnect', async () => {
      const { ws: ws0 } = await createAuthenticatedClient('password0');
      const { ws: ws1 } = await createAuthenticatedClient('password1');

      // Both disconnect
      ws0.close();
      ws1.close();

      await new Promise(resolve => setTimeout(resolve, 1000));

      // New player connects
      const { ws: newPlayer } = await createAuthenticatedClient('password0');

      // Should get fresh game state (turn 0)
      const gameState = await waitForMessage(newPlayer, 'GAME_STATE');
      assert.strictEqual(gameState.state.turn, 0);

      newPlayer.close();
    });
  });

  describe('PASS Action Tests', () => {
    test('should accept PASS as valid action', async () => {
      const { ws: ws0 } = await createAuthenticatedClient('password0');
      const { ws: ws1 } = await createAuthenticatedClient('password1');

      // Wait for initial state
      await waitForMessage(ws0, 'GAME_STATE');
      await waitForMessage(ws1, 'GAME_STATE');

      // Both submit PASS
      ws0.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      ws1.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // Should advance turn
      const newState = await waitForMessage(ws0, 'GAME_STATE');
      assert.strictEqual(newState.state.turn, 1);

      ws0.close();
      ws1.close();
    });

    test('should handle mixed PASS and regular actions', async () => {
      const { ws: ws0 } = await createAuthenticatedClient('password0');
      const { ws: ws1 } = await createAuthenticatedClient('password1');

      // Wait for initial state
      const state0 = await waitForMessage(ws0, 'GAME_STATE');
      await waitForMessage(ws1, 'GAME_STATE');

      // Find a valid unit for team 0
      const unit = state0.state.units.find(u => u.owner === 0);

      // Team 0 moves, Team 1 passes
      ws0.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{
          type: 'MOVE',
          unitId: unit.id,
          targetX: unit.x,
          targetY: unit.y + 1
        }]
      }));

      ws1.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // Should process turn
      const newState = await waitForMessage(ws0, 'GAME_STATE');
      assert.strictEqual(newState.state.turn, 1);

      ws0.close();
      ws1.close();
    });
  });

  describe('Multiple Clients Per Team Tests', () => {
    test('should allow multiple spectators', async () => {
      const { ws: spec1 } = await createAuthenticatedClient('spectator', 'Spec1');
      const { ws: spec2 } = await createAuthenticatedClient('spectator', 'Spec2');

      // Both should receive game state
      const state1 = await waitForMessage(spec1, 'GAME_STATE');
      const state2 = await waitForMessage(spec2, 'GAME_STATE');

      assert(state1.state);
      assert(state2.state);

      spec1.close();
      spec2.close();
    });

    test('should handle multiple players on same team', async () => {
      const { ws: player1a } = await createAuthenticatedClient('password0', 'Team0-A');
      const { ws: player1b } = await createAuthenticatedClient('password0', 'Team0-B');
      const { ws: player2 } = await createAuthenticatedClient('password1', 'Team1');

      // All should receive game state
      await waitForMessage(player1a, 'GAME_STATE');
      await waitForMessage(player1b, 'GAME_STATE');
      await waitForMessage(player2, 'GAME_STATE');

      // Last submission from team should be used
      player1a.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // This should override the first
      player1b.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      player2.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [{ type: 'PASS' }]
      }));

      // All should receive new state
      const newState = await waitForMessage(player1a, 'GAME_STATE');
      assert.strictEqual(newState.state.turn, 1);

      player1a.close();
      player1b.close();
      player2.close();
    });
  });
});

// Run tests
console.log('Starting server protocol tests...');
console.log('Note: Make sure no server is running on port 8081');