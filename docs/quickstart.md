# Quickstart

2-player turn-based strategy. Your bot connects over WebSocket, receives game state each turn, and responds with actions. No randomness, perfect information.

## Prerequisites

- **Node.js 22+** (built-in `WebSocket` -- no dependencies needed)

## 1. Start the Server

```bash
cd server && node server.js
```

Defaults: blitz mode, 2s turn timeout.

| Flag              | Default | Description                                        |
| ----------------- | ------- | -------------------------------------------------- |
| `--mode=standard` | `blitz` | Standard: 25x15, 200 turns. Blitz: 15x10, 50 turns |
| `--timeout=5000`  | `2000`  | Turn timeout in ms                                 |
| `--protected`     | off     | Per-team passwords, no client setting overrides    |
| `--max-saves=50`  | `20`    | Max saved replays                                  |

## 2. Open the Viewer

The viewer needs HTTP serving (not `file://`):

```bash
npx serve .
```

Open `http://localhost:3000/visuals/index.html`. Auto-connects as spectator.

## 3. Run Example Bots

```bash
# Terminal 1
node agents/client.js smart 0 MyBot

# Terminal 2
node agents/client.js dumb 1 Opponent
```

Game starts when both teams connect. Format: `node agents/client.js <agent> <team> <name>`

Agents: `dumb` (random), `smart` (heuristic), `smart2` (variant).

## 4. Build Your Own Bot

Create a file that exports `generateActions(state, teamId)` returning an array of actions:

```javascript
function generateActions(state, teamId) {
  const actions = [];
  const myUnits = state.units.filter((u) => u.owner === teamId);
  const myCities = state.cities.filter((c) => c.owner === teamId);

  // Move a unit
  const unit = myUnits.find((u) => u.canMove);
  if (unit) {
    actions.push({
      action: 'MOVE',
      from_x: unit.x,
      from_y: unit.y,
      to_x: unit.x + 1,
      to_y: unit.y,
    });
  }

  // Build a unit at a city
  const city = myCities.find((c) => !state.units.some((u) => u.x === c.x && u.y === c.y));
  if (city) {
    actions.push({
      action: 'BUILD_UNIT',
      city_x: city.x,
      city_y: city.y,
      unit_type: 'SOLDIER',
    });
  }

  return actions;
}

module.exports = { generateActions };
```

Wire it into the client harness (`agents/client.js`) or write your own WebSocket connection. See [Building a Client](building-a-client.md) for the full protocol.

## 5. Environment Variables

| Variable     | Default               | Description          |
| ------------ | --------------------- | -------------------- |
| `SERVER_URL` | `ws://localhost:8080` | Server WebSocket URL |
| `PASSWORD`   | `player`              | Auth password        |

```bash
SERVER_URL=ws://192.168.1.100:8080 PASSWORD=secret node agents/client.js smart 0 MyBot
```

## Next Steps

| Document                                  | Covers                                               |
| ----------------------------------------- | ---------------------------------------------------- |
| [Game Mechanics](game-mechanics.md)       | Units, combat, economy, scoring, turn phases         |
| [Building a Client](building-a-client.md) | Protocol, auth, actions, state format, bot skeletons |
| [Using the UI](using-the-ui.md)           | Spectator, replay, manual play                       |
| [Data & Training](data-extraction.md)     | Headless self-play, save format, logic API           |
