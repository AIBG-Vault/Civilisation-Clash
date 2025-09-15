import WebSocket from 'ws';

class TestBotV2 {
  constructor(name = 'TestBot', password = null) {
    this.name = name;
    this.password = password;
    this.ws = null;
    this.teamId = -1;
    this.gameState = null;
    this.role = null;
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.on('open', () => {
      console.log(`${this.name}: Authenticating with server...`);
      // Send AUTH message
      this.ws.send(JSON.stringify({
        type: 'AUTH',
        password: this.password,
        name: this.name
      }));
    });

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data);
      this.handleMessage(msg);
    });

    this.ws.on('close', () => {
      console.log(`${this.name}: Disconnected from server`);
      process.exit(0);
    });

    this.ws.on('error', (error) => {
      console.error(`${this.name}: WebSocket error:`, error);
    });
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'AUTH_SUCCESS':
        this.teamId = msg.teamId;
        this.role = msg.role;
        console.log(`${this.name}: Authenticated as ${this.role} (Team ${this.teamId} - ${this.teamId === 0 ? 'Blue' : this.teamId === 1 ? 'Red' : 'N/A'})`);
        break;

      case 'GAME_STATE':
        this.gameState = msg.state;
        // Update teamId for players
        if (this.role === 'player' && msg.yourTeamId >= 0) {
          this.teamId = msg.yourTeamId;
        }
        this.logGameState();
        // Only make moves if we're a player
        if (!msg.state.gameOver && this.role === 'player' && this.teamId >= 0) {
          this.makeMove(this.teamId);
        }
        break;

      case 'GAME_OVER':
        console.log(`${this.name}: Game Over! Winner: ${msg.winner === null ? 'TIE' : `Team ${msg.winner}`}`);
        console.log(`${this.name}: Reason: ${msg.reason}`);
        if (msg.scores) {
          console.log(`${this.name}: Final scores:`, msg.scores);
        }
        this.ws.close();
        break;

      case 'ERROR':
        console.error(`${this.name}: Server error:`, msg.message);
        break;
    }
  }

  logGameState() {
    const state = this.gameState;
    console.log(`\n${this.name}: === Turn ${state.turn}/${state.maxTurns} ===`);

    // Log team info
    state.teams.forEach((team) => {
      const units = state.units.filter((u) => u.owner === team.id);
      const territory = state.map.filter((t) => t.owner === team.id).length;
      console.log(
        `${this.name}: Team ${team.id}: ${team.territoryPoints} TP, +${team.income} income, ${units.length} units, ${territory} tiles`
      );
    });

    // Log terrain summary
    const fields = state.map.filter((t) => t.type === 'FIELD').length;
    const mountains = state.map.filter((t) => t.type === 'MOUNTAIN').length;
    const water = state.map.filter((t) => t.type === 'WATER').length;
    console.log(`${this.name}: Map: ${fields} fields, ${mountains} mountains, ${water} water`);
  }

  makeMove(teamId) {
    const actions = [];
    const myUnits = this.gameState.units.filter((u) => u.owner === teamId);
    const myTeam = this.gameState.teams.find((t) => t.id === teamId);

    console.log(`${this.name}: My units: ${myUnits.length}, My TP: ${myTeam.territoryPoints}`);

    // Strategy: Build units when we have enough TP
    if (myTeam.territoryPoints >= 20) {
      // Find a valid build location
      const validBuildTiles = this.gameState.map.filter((tile) => {
        if (tile.owner !== teamId) return false;
        if (tile.type !== 'FIELD') return false;
        const occupied = this.gameState.units.some((u) => u.x === tile.x && u.y === tile.y);
        return !occupied;
      });

      if (validBuildTiles.length > 0) {
        const buildTile = validBuildTiles[0];
        actions.push({
          type: 'BUILD_UNIT',
          unitType: 'SOLDIER',
          x: buildTile.x,
          y: buildTile.y,
        });
        console.log(`${this.name}: Building soldier at (${buildTile.x}, ${buildTile.y})`);
      }
    }

    // Move units toward enemy territory or center
    myUnits.forEach((unit) => {
      if (!unit.canMove) {
        console.log(`${this.name}: Unit ${unit.id} has capture fatigue`);
        return;
      }

      // Find best move
      const possibleMoves = this.getPossibleMoves(unit);
      if (possibleMoves.length > 0) {
        // Prioritize enemy territory, then neutral, then move toward center
        let bestMove = possibleMoves[0];
        let bestScore = -1;

        possibleMoves.forEach((move) => {
          const tile = this.gameState.map.find((t) => t.x === move.x && t.y === move.y);
          let score = 0;

          // Prefer capturing enemy territory
          if (tile.owner !== teamId && tile.owner !== null) score = 3;
          // Then neutral territory
          else if (tile.owner === null) score = 2;
          // Otherwise move toward center
          else {
            const centerX = Math.floor(this.gameState.map[0].x / 2);
            const centerY = Math.floor(this.gameState.map[0].y / 2);
            const distToCenter = Math.abs(move.x - centerX) + Math.abs(move.y - centerY);
            score = 1 / (distToCenter + 1);
          }

          if (score > bestScore) {
            bestScore = score;
            bestMove = move;
          }
        });

        actions.push({
          type: 'MOVE',
          unitId: unit.id,
          targetX: bestMove.x,
          targetY: bestMove.y,
        });
        console.log(`${this.name}: Moving unit ${unit.id} to (${bestMove.x}, ${bestMove.y})`);
      }
    });

    // Submit actions
    if (actions.length === 0) {
      // No actions available, send PASS
      actions.push({ type: 'PASS' });
      console.log(`${this.name}: No actions available, sending PASS`);
    }

    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: actions,
      })
    );
  }

  getPossibleMoves(unit) {
    const moves = [];
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    dirs.forEach(([dx, dy]) => {
      const newX = unit.x + dx;
      const newY = unit.y + dy;

      // Check bounds
      const tile = this.gameState.map.find((t) => t.x === newX && t.y === newY);
      if (!tile) return;

      // Check passable
      if (tile.type !== 'FIELD') return;

      // Check not occupied
      const occupied = this.gameState.units.some((u) => u.x === newX && u.y === newY);
      if (occupied) return;

      moves.push({ x: newX, y: newY });
    });

    return moves;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const clientType = args[0] || 'Bot1';
const password = args[1];

// Determine password based on client type if not provided
let finalPassword = password;
if (!finalPassword) {
  if (clientType === 'Bot1') {
    finalPassword = 'password0'; // Team 0
  } else if (clientType === 'Bot2') {
    finalPassword = 'password1'; // Team 1
  } else if (clientType === 'Spectator') {
    finalPassword = 'spectator';
  } else if (clientType === 'Admin') {
    finalPassword = 'admin123';
  } else {
    console.log('Usage: node test-client-v2.js [Bot1|Bot2|Spectator|Admin] [password]');
    process.exit(1);
  }
}

// Create and connect bot
console.log(`Starting ${clientType} with password authentication...`);
const bot = new TestBotV2(clientType, finalPassword);
bot.connect();

if (clientType.startsWith('Bot')) {
  console.log('This bot will:');
  console.log('- Build soldiers when it has 20+ TP');
  console.log('- Move units to capture territory');
  console.log('- Prioritize enemy territory over neutral');
  console.log('- Move toward center when no territory to capture');
}