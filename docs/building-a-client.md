# Building a Client

## Minimal Bot

Connects, authenticates, passes every turn:

```js
const ws = new WebSocket(process.env.SERVER_URL || 'ws://localhost:8080');
let teamId = null;

ws.addEventListener('open', () => {
  ws.send(
    JSON.stringify({ type: 'AUTH', password: 'player', name: 'MinimalBot', preferredTeam: 0 })
  );
});

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'AUTH_SUCCESS') {
    teamId = msg.teamId;
    console.log(`Authenticated as team ${teamId}`);
  }

  if (msg.type === 'TURN_START') {
    const actions = [{ action: 'PASS' }];
    ws.send(JSON.stringify({ type: 'SUBMIT_ACTIONS', actions }));
  }

  if (msg.type === 'GAME_OVER') {
    console.log(`Game over. Winner: ${msg.winner}`);
  }
});
```

```bash
node minimal-bot.js
```

## Connection

| Setting  | Value                                                  |
| -------- | ------------------------------------------------------ |
| URL      | `ws://localhost:8080` (override with `SERVER_URL` env) |
| Password | `player` (override with `PASSWORD` env)                |
| Protocol | JSON over WebSocket                                    |

Node.js 22+ has a built-in `WebSocket` global -- no packages needed.

## Authentication

Send immediately after connection opens:

```json
{
  "type": "AUTH",
  "password": "player",
  "name": "MyBot",
  "preferredTeam": 0
}
```

- `preferredTeam` -- `0` or `1`. Assigned if available, otherwise the other team.

Response:

```json
{
  "type": "AUTH_SUCCESS",
  "teamId": 0,
  "assignedName": "MyBot",
  "isSpectator": false
}
```

In protected mode (`--protected`), each team has a unique password. The password determines your team.

## Game Loop

### TURN_START

```json
{
  "type": "TURN_START",
  "turn": 5,
  "timeout": 2000,
  "state": { ... }
}
```

You have `timeout` ms to respond. If you miss it, the turn processes without your actions.

### SUBMIT_ACTIONS

```json
{
  "type": "SUBMIT_ACTIONS",
  "actions": [
    { "action": "MOVE", "from_x": 3, "from_y": 7, "to_x": 4, "to_y": 7 },
    { "action": "BUILD_UNIT", "city_x": 2, "city_y": 7, "unit_type": "SOLDIER" },
    { "action": "EXPAND_TERRITORY", "x": 5, "y": 8 }
  ]
}
```

Server responds with validation:

```json
{
  "type": "ACTIONS_RECEIVED",
  "success": true,
  "validCount": 3,
  "totalCount": 3,
  "validation": [{ "valid": true }, { "valid": true }, { "valid": true }]
}
```

Invalid actions are dropped. The `validation` array tells you which failed and why.

### TURN_RESULT

```json
{
  "type": "TURN_RESULT",
  "turn": 5,
  "events": [ ... ],
  "state": { ... }
}
```

`state` is the updated game state after all phases. `events` is an array describing what happened during the turn:

#### COMBAT

Emitted for each hit (archer shots in phase 2, melee hits in phase 4):

```json
{
  "type": "COMBAT",
  "data": {
    "phase": "archer",
    "attacker": { "x": 5, "y": 3, "type": "ARCHER", "owner": 0 },
    "target": { "x": 7, "y": 4, "type": "RAIDER", "owner": 1 },
    "damage": 1,
    "isKill": true,
    "scoreGain": 7
  }
}
```

`phase` is `"archer"` or `"melee"`. `scoreGain` is points awarded to the attacker's team (5 for damage, 7 for a killing blow).

#### DEATH

Emitted when a unit is killed (always follows a COMBAT event with `isKill: true`):

```json
{
  "type": "DEATH",
  "data": {
    "unit": { "x": 7, "y": 4, "type": "RAIDER", "owner": 1 },
    "deathScore": 3
  }
}
```

`deathScore` is points awarded to the **dead unit's owner** (soldier: 10, archer: 12, raider: 3).

#### CAPTURE (territory raid)

Emitted when a unit moves onto enemy territory, converting it to neutral:

```json
{
  "type": "CAPTURE",
  "data": {
    "tile": { "x": 10, "y": 6 },
    "previousOwner": 1,
    "raidedBy": { "x": 10, "y": 6, "type": "RAIDER", "owner": 0 }
  }
}
```

#### CITY_CAPTURED

Emitted when a soldier captures an enemy city:

```json
{
  "type": "CITY_CAPTURED",
  "data": {
    "city": { "x": 12, "y": 5 },
    "previousOwner": 1,
    "newOwner": 0,
    "capturedBy": { "x": 12, "y": 5, "type": "SOLDIER" }
  }
}
```

#### MONUMENT_CONTROL

Emitted every turn during the scoring phase:

```json
{
  "type": "MONUMENT_CONTROL",
  "data": {
    "controlledBy": 0,
    "scoreAwarded": 5
  }
}
```

`controlledBy` is `0`, `1`, or `null`. `scoreAwarded` is 0 if uncontrolled.

### GAME_OVER

```json
{
  "type": "GAME_OVER",
  "winner": 0,
  "reason": "score",
  "saveId": "2026-03-02T17-22-06-101Z_Bot0-vs-Bot1"
}
```

- `winner`: `0`, `1`, or `null` (tie)
- `reason`: `"score"`, `"elimination"`, or `"tie"`

The server auto-restarts after 3 seconds. Keep your bot running.

## Action Reference

### MOVE

```json
{ "action": "MOVE", "from_x": 10, "from_y": 5, "to_x": 11, "to_y": 5 }
```

- Units identified by position, not ID
- Max distance: 1 (soldier, archer) or 2 (raider), Chebyshev
- Blocked if: in enemy soldier ZoC (unless unit is a soldier), archer already shot, target impassable or occupied
- Moving onto enemy territory raids it (neutral) and stops further movement
- Soldiers moving onto enemy cities capture them

### BUILD_UNIT

```json
{ "action": "BUILD_UNIT", "city_x": 2, "city_y": 7, "unit_type": "SOLDIER" }
```

- `unit_type`: `SOLDIER` (20G), `ARCHER` (25G), `RAIDER` (10G)
- City must be yours, tile must be empty, you must have enough gold
- New units cannot move on spawn turn

### BUILD_CITY

```json
{ "action": "BUILD_CITY", "x": 20, "y": 12 }
```

- Cost: 80G
- Must be a field tile you own, no unit or city on it

### EXPAND_TERRITORY

```json
{ "action": "EXPAND_TERRITORY", "x": 15, "y": 8 }
```

- Cost: 5G
- Target must be neutral, field type, adjacent to your territory (distance 1)

### PASS

```json
{ "action": "PASS" }
```

Always valid.

## Game State

The `state` object received in TURN_START and TURN_RESULT:

```json
{
  "turn": 5,
  "maxTurns": 50,
  "gameOver": false,
  "winner": null,

  "players": [
    { "id": 0, "gold": 42.5, "score": 120, "income": 9.5, "name": "Bot0" },
    { "id": 1, "gold": 38.0, "score": 95, "income": 8.0, "name": "Bot1" }
  ],

  "map": {
    "width": 15,
    "height": 10,
    "tiles": [
      { "x": 0, "y": 0, "type": "WATER", "owner": null },
      { "x": 1, "y": 1, "type": "FIELD", "owner": 0 },
      { "x": 7, "y": 5, "type": "MONUMENT", "owner": null },
      { "x": 3, "y": 4, "type": "MOUNTAIN", "owner": null }
    ]
  },

  "units": [
    { "x": 3, "y": 7, "owner": 0, "type": "SOLDIER", "hp": 3, "canMove": true },
    { "x": 5, "y": 7, "owner": 1, "type": "ARCHER", "hp": 2, "canMove": true },
    { "x": 8, "y": 3, "owner": 1, "type": "RAIDER", "hp": 1, "canMove": true }
  ],

  "cities": [
    { "x": 2, "y": 5, "owner": 0 },
    { "x": 12, "y": 5, "owner": 1 }
  ],

  "monument": {
    "x": 7,
    "y": 5,
    "controlledBy": null
  }
}
```

- Units identified by position. One unit per tile max.
- `tiles` is a flat array of `width * height` entries. Types: `FIELD`, `MOUNTAIN`, `WATER`, `MONUMENT`.
- `owner` is `null` (neutral), `0`, or `1`. Mountains/water are always `null`.
- `canMove`: `false` for newly spawned units and archers that shot this turn.

## Bot Skeleton -- JavaScript

Full working bot with reconnect logic. Uses Node.js 22+ built-in WebSocket.

### client.js

```js
const strategy = require('./strategy');

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8080';
const PASSWORD = process.env.PASSWORD || 'player';
const TEAM = parseInt(process.env.TEAM || '0');
const NAME = process.env.BOT_NAME || 'MyBot';

let ws = null;
let teamId = null;

function connect() {
  ws = new WebSocket(SERVER_URL);

  ws.addEventListener('open', () => {
    ws.send(
      JSON.stringify({
        type: 'AUTH',
        password: PASSWORD,
        name: NAME,
        preferredTeam: TEAM,
      })
    );
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case 'AUTH_SUCCESS':
        teamId = msg.teamId;
        console.log(`Team ${teamId}`);
        break;

      case 'TURN_START':
        try {
          const actions = strategy.generateActions(msg.state, teamId);
          ws.send(JSON.stringify({ type: 'SUBMIT_ACTIONS', actions }));
        } catch (err) {
          console.error(err.message);
          ws.send(JSON.stringify({ type: 'SUBMIT_ACTIONS', actions: [] }));
        }
        break;

      case 'GAME_OVER':
        const result = msg.winner === teamId ? 'WON' : msg.winner === null ? 'TIE' : 'LOST';
        console.log(`${result} (${msg.reason})`);
        break;

      case 'AUTH_FAILED':
        console.error(msg.reason);
        process.exit(1);
        break;
    }
  });

  ws.addEventListener('close', () => setTimeout(connect, 2000));
  ws.addEventListener('error', (err) => console.error(err.message));
}

connect();
```

### strategy.js

```js
function generateActions(state, teamId) {
  const actions = [];
  const myUnits = state.units.filter((u) => u.owner === teamId);
  const myCities = state.cities.filter((c) => c.owner === teamId);
  const player = state.players.find((p) => p.id === teamId);

  const dirs = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  const tileAt = (x, y) => state.map.tiles.find((t) => t.x === x && t.y === y);
  const unitAt = (x, y) => state.units.some((u) => u.x === x && u.y === y);

  // Move units to random valid tiles
  for (const unit of myUnits) {
    if (!unit.canMove) continue;
    const shuffled = [...dirs].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of shuffled) {
      const tx = unit.x + dx,
        ty = unit.y + dy;
      const tile = tileAt(tx, ty);
      if (!tile || tile.type !== 'FIELD' || unitAt(tx, ty)) continue;
      actions.push({ action: 'MOVE', from_x: unit.x, from_y: unit.y, to_x: tx, to_y: ty });
      break;
    }
  }

  // Build random unit at first open city
  const costs = { SOLDIER: 20, ARCHER: 25, RAIDER: 10 };
  for (const city of myCities) {
    if (unitAt(city.x, city.y)) continue;
    const type = ['SOLDIER', 'ARCHER', 'RAIDER'][Math.floor(Math.random() * 3)];
    if (player.gold >= costs[type]) {
      actions.push({ action: 'BUILD_UNIT', city_x: city.x, city_y: city.y, unit_type: type });
      player.gold -= costs[type];
    }
  }

  return actions;
}

module.exports = { generateActions };
```

## Bot Skeleton -- Python

Requires `pip install websockets`:

```python
import asyncio, json, os, random

SERVER_URL = os.environ.get("SERVER_URL", "ws://localhost:8080")
PASSWORD = os.environ.get("PASSWORD", "player")
TEAM = int(os.environ.get("TEAM", "0"))
NAME = os.environ.get("BOT_NAME", "PyBot")

team_id = None


def generate_actions(state, my_team):
    actions = []
    my_units = [u for u in state["units"] if u["owner"] == my_team]
    my_cities = [c for c in state["cities"] if c["owner"] == my_team]
    player = next(p for p in state["players"] if p["id"] == my_team)

    dirs = [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]
    tile_lookup = {(t["x"], t["y"]): t for t in state["map"]["tiles"]}
    unit_positions = {(u["x"], u["y"]) for u in state["units"]}

    for unit in my_units:
        if not unit.get("canMove", True):
            continue
        random.shuffle(dirs)
        for dx, dy in dirs:
            tx, ty = unit["x"] + dx, unit["y"] + dy
            tile = tile_lookup.get((tx, ty))
            if not tile or tile["type"] != "FIELD" or (tx, ty) in unit_positions:
                continue
            actions.append({
                "action": "MOVE",
                "from_x": unit["x"], "from_y": unit["y"],
                "to_x": tx, "to_y": ty,
            })
            unit_positions.discard((unit["x"], unit["y"]))
            unit_positions.add((tx, ty))
            break

    costs = {"SOLDIER": 20, "ARCHER": 25, "RAIDER": 10}
    gold = player["gold"]
    for city in my_cities:
        if (city["x"], city["y"]) in unit_positions:
            continue
        unit_type = random.choice(["SOLDIER", "ARCHER", "RAIDER"])
        if gold >= costs[unit_type]:
            actions.append({
                "action": "BUILD_UNIT",
                "city_x": city["x"], "city_y": city["y"],
                "unit_type": unit_type,
            })
            gold -= costs[unit_type]

    return actions


async def main():
    global team_id
    import websockets

    while True:
        try:
            async with websockets.connect(SERVER_URL) as ws:
                await ws.send(json.dumps({
                    "type": "AUTH", "password": PASSWORD,
                    "name": NAME, "preferredTeam": TEAM,
                }))

                async for raw in ws:
                    msg = json.loads(raw)

                    if msg["type"] == "AUTH_SUCCESS":
                        team_id = msg["teamId"]
                        print(f"Team {team_id}")

                    elif msg["type"] == "TURN_START":
                        try:
                            actions = generate_actions(msg["state"], team_id)
                            await ws.send(json.dumps({"type": "SUBMIT_ACTIONS", "actions": actions}))
                        except Exception as e:
                            print(f"Error: {e}")
                            await ws.send(json.dumps({"type": "SUBMIT_ACTIONS", "actions": []}))

                    elif msg["type"] == "GAME_OVER":
                        result = "WON" if msg["winner"] == team_id else (
                            "TIE" if msg["winner"] is None else "LOST")
                        print(f"{result} ({msg['reason']})")

                    elif msg["type"] == "AUTH_FAILED":
                        print(f"Auth failed: {msg['reason']}")
                        return

        except Exception as e:
            print(f"Disconnected: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
```
