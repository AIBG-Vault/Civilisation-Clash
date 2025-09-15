# Task 04: Create Basic Frontend (MVP)

## Objective
Create a simple HTML page that visualizes the game state and allows watching the game unfold.

## Prerequisites
- Task 02 completed (game logic works)
- Task 03 completed (server running on ws://localhost:8080)

## What to Build

### Minimal Frontend Features
- Connect to WebSocket server as spectator
- Display 15x10 grid
- Show soldiers as colored squares
- Display turn counter
- Show game over + winner

### What We Skip
- No manual controls (just viewing)
- No sprites (just colored squares)
- No animations
- No sound

## Single File to Create

### `visuals/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Civilization Clash - MVP</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #2a2a2a;
      color: white;
      margin: 20px;
    }

    #status {
      margin: 20px;
      font-size: 24px;
    }

    #grid {
      display: grid;
      grid-template-columns: repeat(15, 40px);
      grid-template-rows: repeat(10, 40px);
      gap: 1px;
      background: #000;
      padding: 1px;
    }

    .cell {
      width: 40px;
      height: 40px;
      background: #4a4a4a;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .unit {
      width: 30px;
      height: 30px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }

    .team-0 {
      background: #3498db;  /* Blue */
    }

    .team-1 {
      background: #e74c3c;  /* Red */
    }

    #info {
      margin: 20px;
      text-align: center;
    }

    .hp-bar {
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 3px;
      background: #000;
    }

    .hp-fill {
      height: 100%;
      background: #2ecc71;
      transition: width 0.3s;
    }

    #gameOver {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      padding: 40px;
      border-radius: 10px;
      font-size: 32px;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>Civilization Clash - MVP</h1>

  <div id="status">Connecting...</div>

  <div id="grid"></div>

  <div id="info">
    <div>Turn: <span id="turn">0</span> / 50</div>
    <div>Blue Units: <span id="blue-units">0</span></div>
    <div>Red Units: <span id="red-units">0</span></div>
  </div>

  <div id="gameOver">
    <div id="winner"></div>
    <div style="font-size: 16px; margin-top: 20px;">Refreshing in 5 seconds...</div>
  </div>

  <script>
    // Configuration
    const WS_URL = 'ws://localhost:8080';
    const GRID_WIDTH = 15;
    const GRID_HEIGHT = 10;

    // State
    let ws = null;
    let gameState = null;
    let myTeamId = -1; // Spectator

    // Initialize grid
    function initGrid() {
      const grid = document.getElementById('grid');
      grid.innerHTML = '';

      for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.id = `cell-${x}-${y}`;
          grid.appendChild(cell);
        }
      }
    }

    // Connect to server
    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('Connected to server');
        document.getElementById('status').textContent = 'Connected - Waiting for game...';

        // Connect as spectator (no auth for MVP)
        // Server will treat us as a player for now
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received:', message.type);

        if (message.type === 'AUTH_SUCCESS') {
          myTeamId = message.teamId;
          document.getElementById('status').textContent =
            `Connected as ${myTeamId === 0 ? 'Blue' : myTeamId === 1 ? 'Red' : 'Spectator'}`;
        }

        if (message.type === 'GAME_STATE') {
          gameState = message.state;
          updateDisplay();

          // Auto-play for demo (remove this when adding manual controls)
          if (myTeamId >= 0 && !gameState.gameOver) {
            autoPlay(message.yourTeamId);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('status').textContent = 'Connection error';
      };

      ws.onclose = () => {
        console.log('Disconnected from server');
        document.getElementById('status').textContent = 'Disconnected - Reconnecting...';
        setTimeout(connect, 2000); // Auto-reconnect
      };
    }

    // Update display based on game state
    function updateDisplay() {
      if (!gameState) return;

      // Clear grid
      document.querySelectorAll('.cell').forEach(cell => {
        cell.innerHTML = '';
      });

      // Place units
      gameState.units.forEach(unit => {
        const cell = document.getElementById(`cell-${unit.x}-${unit.y}`);
        if (cell) {
          const unitDiv = document.createElement('div');
          unitDiv.className = `unit team-${unit.owner}`;
          unitDiv.textContent = 'S'; // Soldier

          // HP bar
          const hpBar = document.createElement('div');
          hpBar.className = 'hp-bar';
          const hpFill = document.createElement('div');
          hpFill.className = 'hp-fill';
          hpFill.style.width = `${(unit.hp / 3) * 100}%`;
          hpBar.appendChild(hpFill);
          unitDiv.appendChild(hpBar);

          cell.appendChild(unitDiv);
        }
      });

      // Update info
      document.getElementById('turn').textContent = gameState.turn;
      const blueUnits = gameState.units.filter(u => u.owner === 0).length;
      const redUnits = gameState.units.filter(u => u.owner === 1).length;
      document.getElementById('blue-units').textContent = blueUnits;
      document.getElementById('red-units').textContent = redUnits;

      // Check game over
      if (gameState.gameOver) {
        const gameOverDiv = document.getElementById('gameOver');
        const winnerDiv = document.getElementById('winner');

        if (gameState.winner === null) {
          winnerDiv.textContent = 'Game ended in a tie!';
        } else {
          const winner = gameState.winner === 0 ? 'Blue' : 'Red';
          winnerDiv.textContent = `${winner} wins!`;
        }

        gameOverDiv.style.display = 'block';

        // Auto refresh after 5 seconds
        setTimeout(() => {
          location.reload();
        }, 5000);
      }
    }

    // Auto-play for demo (sends random valid moves)
    function autoPlay(teamId) {
      const myUnits = gameState.units.filter(u => u.owner === teamId);

      if (myUnits.length === 0) return;

      // Pick a random unit and try to move it
      const unit = myUnits[Math.floor(Math.random() * myUnits.length)];

      // Random direction
      const directions = [
        {dx: 0, dy: -1}, // up
        {dx: 0, dy: 1},  // down
        {dx: -1, dy: 0}, // left
        {dx: 1, dy: 0}   // right
      ];

      const dir = directions[Math.floor(Math.random() * directions.length)];
      const newX = unit.x + dir.dx;
      const newY = unit.y + dir.dy;

      // Check bounds
      if (newX >= 0 && newX < GRID_WIDTH && newY >= 0 && newY < GRID_HEIGHT) {
        ws.send(JSON.stringify({
          type: 'SUBMIT_ACTIONS',
          actions: [{
            type: 'MOVE',
            unitId: unit.id,
            targetX: newX,
            targetY: newY
          }]
        }));
      } else {
        // Send empty actions if move is invalid
        ws.send(JSON.stringify({
          type: 'SUBMIT_ACTIONS',
          actions: []
        }));
      }
    }

    // Initialize
    initGrid();
    connect();
  </script>
</body>
</html>
```

## Implementation Steps

1. **Create visuals directory**
   ```bash
   mkdir visuals
   ```

2. **Create index.html** with the above code

3. **Open in browser**
   - Simply open the file in a browser
   - Or use a local server: `python -m http.server 3000` in visuals/

4. **Test with running server**
   - Make sure server is running (Task 03)
   - Open two browser tabs to start a game
   - Watch units move and fight

## Success Criteria
- [x] Connects to WebSocket server
- [x] Displays 15x10 grid
- [x] Shows units as colored squares (blue/red)
- [x] Updates when game state changes
- [x] Shows HP bars on units
- [x] Displays turn counter
- [x] Shows unit counts
- [x] Displays game over screen
- [x] Auto-reconnects if disconnected

## Testing
1. Start the server: `cd server && npm start`
2. Open `visuals/index.html` in two browser tabs
3. Watch the game play out (auto-play enabled for demo)

## Next Steps
After MVP works:
- Add manual controls (click to select, click to move)
- Add proper spectator mode
- Add terrain types (mountains, water)
- Add sprites instead of letters
- Add more unit types
- Add cities and monument

## Note
The current version includes auto-play for demonstration. This sends random valid moves to show the game working. Remove the `autoPlay()` function when adding manual controls.