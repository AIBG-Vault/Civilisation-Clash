import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected to server!');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log(`Received: ${msg.type}`);

  if (msg.type === 'AUTH_SUCCESS') {
    console.log(`I am Team ${msg.teamId}`);
  }

  if (msg.type === 'GAME_STATE') {
    const state = msg.state;
    console.log(`Turn ${state.turn}/${state.maxTurns}`);

    // Get my units
    const myUnits = state.units.filter(u => u.owner === msg.yourTeamId);
    console.log(`My units: ${myUnits.length}`);

    if (!state.gameOver && myUnits.length > 0) {
      // Pick a random unit and try to move it
      const unit = myUnits[0];

      // Simple AI: move toward center
      let targetX = unit.x;
      let targetY = unit.y;

      if (unit.x < 7) targetX = unit.x + 1;
      else if (unit.x > 7) targetX = unit.x - 1;
      else if (unit.y < 5) targetY = unit.y + 1;
      else if (unit.y > 5) targetY = unit.y - 1;

      const action = {
        type: 'MOVE',
        unitId: unit.id,
        targetX: targetX,
        targetY: targetY
      };

      console.log(`Moving unit ${unit.id} to (${targetX}, ${targetY})`);

      ws.send(JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: [action]
      }));
    }
  }

  if (msg.type === 'GAME_OVER') {
    console.log(`Game Over! Winner: ${msg.winner === null ? 'TIE' : `Team ${msg.winner}`}`);
    console.log(`Reason: ${msg.reason}`);
    ws.close();
  }
});

ws.on('close', () => {
  console.log('Disconnected from server');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});