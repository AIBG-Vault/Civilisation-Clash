# AIBG - Civilization Clash

## Description

Civilization Clash is a turn-based strategy game designed for the AI Battleground hackathon. Two AI-controlled civilizations compete for dominance on a symmetrical island map. Players expand territory, build cities, train units, and engage in tactical combat to earn Territory Points and Blood Points. The game features perfect information, allowing teams to develop sophisticated strategies during the 20-hour hackathon. Victory is achieved through territorial control, economic management, and strategic combat over 200 turns (or 50 in Blitz mode).

## Game Features

### Core Mechanics

- **Turn-based strategy** with 0.25-second decision time limit
- **Symmetrical maps** ensuring fair competition
- **Three unit types**: Soldiers, Archers, and Raiders with unique abilities
- **Economic system**: Territory Points (TP) for income, Blood Points (BP) for combat rewards
- **Monument control** for strategic advantage
- **Zone of Control** mechanics for tactical positioning

### Game Modes

- **Standard**: 25×15 map, 200 turns, full feature set
- **Blitz**: 15×10 map, 50 turns, faster gameplay

## Current Implementation Status

### ✅ MVP Complete

- Basic game logic with soldiers and combat
- No economy
- WebSocket server supporting 2 players
- Browser-based visualization
- Automated test client

### 🚧 In Development

- Additional unit types (Archers, Raiders)
- Terrain variety (Mountains, Water)
- Cities and city building
- Monument and Blood Points system
- Map generation
- Authentication system

## Documentation

- [Game Specification](claude/aibg-game-spec-final.md) - Detailed game rules and mechanics
- [Architecture Design](claude/topic-architecture.md) - Technical implementation details
- [MVP Implementation Guide](claude/completed/mvp-v1/creating_minimal_MVP.md) - Current implementation status

## Project Structure

```
Civilisation-Clash/
├── logic/               # Game logic (standalone, zero dependencies)
│   ├── game.js         # Core game mechanics
│   └── tests/          # Unit tests
├── server/             # WebSocket server
│   ├── server.js       # Main server
│   └── test-client.js  # Automated test bot
├── visuals/            # Frontend visualization
│   └── index.html      # Browser-based game viewer
├── claude/             # Design documents and specifications
└── docs/               # Manuals and presentations (TODO)
```

## License [![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-cyan.svg

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

_Do not modify this section. All topics must use this license._

## Usage

This topic is being developed for:

- **Zagreb 2026** _(AIBG X)_ - In Development

## How to Run

### Prerequisites

- **Node.js v18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Web browser** (Chrome, Firefox, or Edge recommended)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd Civilisation-Clash
   ```

2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

### Running the Server

1. Start the WebSocket server:
   ```bash
   cd server
   npm start
   ```
   The server will run on `ws://localhost:8080`

### Running the Visualization

The frontend must be served via a web server (not opened directly as a file):

**Option 1: VS Code Live Server**

1. Install the "Live Server" extension in VS Code
2. Right-click on `visuals/index.html`
3. Select "Open with Live Server"

**Option 2: Python HTTP Server**

```bash
cd visuals
python -m http.server 3000
```

Then open `http://localhost:3000` in your browser

**Option 3: Node.js HTTP Server**

```bash
npx http-server visuals -p 3000
```

### Running Test Agents

1. In a new terminal, run the first test client:

   ```bash
   cd server
   node test-client.js
   ```

2. In another terminal, run the second test client:
   ```bash
   cd server
   node test-client.js
   ```

The game will automatically start when both clients connect. You can watch the game progress in the browser visualization.

### Game Flow

1. Server waits for 2 players to connect
2. Game starts automatically when both players are connected
3. Each turn:
   - Server broadcasts current game state
   - Players have 250ms to submit their actions
   - Server processes actions and updates game state
4. Game ends after 50 turns or when one player is eliminated
5. Server resets and waits for new players

## API Documentation

### WebSocket Protocol

#### Connection

Connect to `ws://localhost:8080`

#### Client → Server Messages

**Authentication** (sent immediately after connection):

```json
{
  "type": "AUTH",
  "teamId": 0
}
```

**Submit Actions** (sent each turn):

```json
{
  "type": "SUBMIT_ACTIONS",
  "actions": [{ "type": "MOVE", "unitId": 42, "targetX": 10, "targetY": 5 }]
}
```

#### Server → Client Messages

**Authentication Success**:

```json
{
  "type": "AUTH_SUCCESS",
  "teamId": 0
}
```

**Game State** (sent each turn):

```json
{
  "type": "GAME_STATE",
  "yourTeamId": 0,
  "state": {
    "turn": 1,
    "maxTurns": 50,
    "units": [...],
    "map": {...},
    "gameOver": false
  }
}
```

**Game Over**:

```json
{
  "type": "GAME_OVER",
  "winner": 0,
  "reason": "TURN_LIMIT"
}
```

## Development

### Code Formatting

The project uses Prettier for consistent code formatting. Git hooks automatically format code before commits.

```bash
# Format all files
cd server
npm run format

# Check formatting
npm run format:check
```

### Testing

```bash
cd logic
node --test
```

## Troubleshooting

- **"Cannot open file://" error**: The visualization must be served via HTTP, not opened directly from the file system
