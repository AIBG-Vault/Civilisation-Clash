/**
 * NothingBot - A passive bot that does nothing each turn
 *
 * Requires: Node.js v22.4.0+ (uses built-in WebSocket API)
 * No npm install required!
 *
 * This bot simply passes every turn without taking any actions.
 * Useful for testing or as a placeholder opponent.
 *
 * Usage: node nothingBot.js [teamPassword] [botName]
 */
class NothingBot {
  constructor(name = 'NothingBot', password = 'password0') {
    this.name = name;
    this.password = password;
    this.ws = null;
    this.teamId = -1;
    this.gameState = null;
  }

  connect() {
    // Use Node.js built-in WebSocket (v22.4.0+)
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log(`${this.name}: Connecting to server...`);
      this.ws.send(
        JSON.stringify({
          type: 'AUTH',
          password: this.password,
          name: this.name,
        })
      );
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onclose = () => {
      console.log(`${this.name}: Disconnected from server`);
      process.exit(0);
    };

    this.ws.onerror = (error) => {
      console.error(`${this.name}: WebSocket error:`, error.message);
    };
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'AUTH_SUCCESS':
        this.teamId = msg.teamId;
        console.log(
          `${this.name}: Authenticated as Team ${this.teamId} (${this.teamId === 0 ? 'Blue' : 'Red'})`
        );
        console.log(`${this.name}: Strategy - Do nothing, just pass every turn`);
        break;

      case 'GAME_STATE':
        this.gameState = msg.state;
        if (msg.yourTeamId >= 0) {
          this.teamId = msg.yourTeamId;
        }

        this.logTurnInfo();

        if (!msg.state.gameOver && this.teamId >= 0) {
          this.submitActions();
        }
        break;

      case 'GAME_OVER':
        console.log(`\n${this.name}: ========== GAME OVER ==========`);
        console.log(`${this.name}: Winner: ${msg.winner === null ? 'TIE' : `Team ${msg.winner}`}`);
        console.log(`${this.name}: Reason: ${msg.reason}`);
        if (msg.scores) {
          console.log(`${this.name}: Final scores:`, msg.scores);
        }
        console.log(`${this.name}: ==============================\n`);
        this.ws.close();
        break;

      case 'ERROR':
        console.error(`${this.name}: Server error:`, msg.message);
        break;

      case 'GAME_CONTROL_MESSAGE':
        console.log(`${this.name}: Game control: ${msg.message}`);
        break;
    }
  }

  logTurnInfo() {
    const state = this.gameState;
    console.log(`\n${this.name}: Turn ${state.turn}/${state.maxTurns}`);

    const myTeam = state.teams.find((t) => t.id === this.teamId);
    if (myTeam) {
      const myUnits = state.units.filter((u) => u.owner === this.teamId).length;
      const myTiles = state.map.filter((t) => t.owner === this.teamId).length;
      console.log(
        `${this.name}: My stats - ${myTeam.territoryPoints} TP, +${myTeam.income}/turn, ${myUnits} units, ${myTiles} tiles`
      );
    }
  }

  submitActions() {
    // Do absolutely nothing - just pass
    const actions = [];

    console.log(`${this.name}: Submitting PASS action (doing nothing)`);

    this.ws.send(
      JSON.stringify({
        type: 'SUBMIT_ACTIONS',
        actions: actions,
      })
    );
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const password = args[0] || 'password0';
const name = args[1] || 'NothingBot';

console.log('='.repeat(50));
console.log('NothingBot - The Passive Strategy');
console.log('='.repeat(50));
console.log('This bot does nothing each turn.');
console.log('Perfect for testing or as a training opponent.');
console.log('='.repeat(50));
console.log(`Password: ${password}`);
console.log(`Name: ${name}`);
console.log('='.repeat(50));

const bot = new NothingBot(name, password);
bot.connect();
