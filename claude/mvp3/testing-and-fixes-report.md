# MVP3 Testing & Fixes Report

## 1. Game Logic Testing

All 50 unit tests pass across 20 test suites:

| Suite | Tests | Status |
|-------|-------|--------|
| Distance calculations | 4 | PASS |
| Map generation | 4 | PASS |
| Initial state creation | 3 | PASS |
| MOVE validation | 7 | PASS |
| BUILD_UNIT validation | 5 | PASS |
| EXPAND_TERRITORY validation | 3 | PASS |
| Zone of Control | 3 | PASS |
| Income phase | 1 | PASS |
| Archer phase | 2 | PASS |
| Movement phase | 2 | PASS |
| Combat phase | 2 | PASS |
| Build phase | 2 | PASS |
| Scoring phase | 1 | PASS |
| City capture | 1 | PASS |
| Game end | 3 | PASS |
| Score multipliers | 3 | PASS |
| Monument score | 3 | PASS |
| State immutability | 1 | PASS |

Integration test: Two dumb agents played a full 50-turn blitz game successfully. Games auto-restart and auto-save correctly.

---

## 2. Bugs Found & Fixed

### Bug: Duplicate states in replay history
**Severity:** High (breaks replay slider behavior)

**Problem:** Both `handleTurnStart` and `handleTurnResult` called `Replay.addState()`, meaning each turn was stored twice in the history. The replay slider showed 2x the actual number of turns, and playback showed duplicate frames.

**Fix:** Added deduplication by turn number in `Replay.addState()`. If the last stored state has the same turn number as the incoming state, it's skipped. Both handlers still call `addState()` but only the first one per turn actually stores.

### Bug: Replay auto-play used setInterval (fragile)
**Severity:** Medium (playback could stall or skip frames)

**Problem:** `play()` used `setInterval` for frame advancement, but `nextTurn()` called `pause()` when reaching the end, which cleared the interval. The interval reference wasn't always cleaned up properly when speed changes occurred.

**Fix:** Replaced `setInterval` with chained `setTimeout` calls (`scheduleNextFrame()`). Each frame explicitly schedules the next one only if still playing. Speed changes seamlessly reschedule without needing to stop/start.

### Bug: Replay "follow live" logic was fragile
**Severity:** Medium (scrubbing back during a live game could lose sync)

**Problem:** The auto-advance check `currentIndex === this.history.length - 2` was brittle and failed when history was trimmed.

**Fix:** Added an explicit `followLive` flag. When true, new states auto-advance the cursor. Scrubbing back (via slider, prev, or goToStart) sets `followLive = false`. `goToEnd()` sets it back to `true`.

---

## 3. Replay System Simplification

### Before
- History stored every state from both TURN_START and TURN_RESULT (duplicates)
- Auto-play used fragile setInterval
- No explicit live-following concept
- Slider showed "position 1 of N" (confusing)
- No ability to load saved games

### After
- Deduplication by turn number (one state per turn)
- Auto-play uses chained setTimeout (reliable speed changes)
- Explicit `followLive` flag for clean live/replay switching
- Slider shows actual turn numbers
- `loadHistory(states)` method for loading saved games
- `getHistory()` method for exporting

---

## 4. Save/Load Feature

### Server-side
- Games auto-save to `server/saves/` as JSON when a game ends
- Filename format: `{ISO-timestamp}_{Player0}-vs-{Player1}.json`
- Save data includes: metadata (players, winner, mode) + full state history
- New message types:
  - `LIST_SAVES` -> `SAVES_LIST`: Lists all saved games (metadata only)
  - `LOAD_SAVE { saveId }` -> `SAVE_LOADED { states, players, ... }`: Returns full state history

### Frontend
- Replays modal now fetches saved games from server when opened
- Each saved game shows: players, date, mode, turn count, winner
- Clicking a saved game loads its state history into the replay system
- Replay controls (play, pause, slider, speed) work on loaded games

### Save File Format
```json
{
  "id": "2026-03-01T14-36-31-712Z_Agent0-vs-Agent1",
  "timestamp": "2026-03-01T14:36:31.712Z",
  "mode": "blitz",
  "players": [
    { "id": 0, "name": "Agent0" },
    { "id": 1, "name": "Agent1" }
  ],
  "winner": 0,
  "winReason": "score",
  "finalTurn": 50,
  "maxTurns": 50,
  "states": [ /* array of 51 game state snapshots */ ]
}
```

---

## 5. Protected Mode (--protected)

### Purpose
For tournament use: each team receives a unique password at the start. The password determines which team slot they connect to. Same password works across all rounds. Passwords are never leaked in server responses.

### Usage
```bash
node server/server.js --protected --mode=blitz --timeout=2000
```

### passwords.json Format
```json
{
  "players": "player",
  "spectator": "spectator",
  "0": "secret_team0_password",
  "1": "secret_team1_password"
}
```

- `"0"` and `"1"` are the team-specific passwords used in protected mode
- `"players"` is the shared password for legacy (non-protected) mode
- `"spectator"` is the spectator password for both modes

### Behavior
| Mode | Password determines team? | Client picks team? |
|------|--------------------------|-------------------|
| Normal | No | Yes (preferredTeam) |
| Protected | Yes | No (ignored) |

### Security Properties
- Password is never returned in AUTH_SUCCESS or any other response
- One connection per team (existing enforcement)
- Wrong password -> "Invalid password" (generic, doesn't reveal which passwords exist)
- Team already connected -> "Team slot already occupied" (doesn't reveal password info)

### Testing
Verified with integration test:
- Correct team passwords -> authenticated as correct team
- Wrong password -> "Authentication failed: Invalid password"
- Same game plays normally after authentication

---

## 6. Cyclic Save System

Games auto-save when they end. To prevent save files from piling up, old saves are automatically pruned.

- Default: keep last **20** save files
- Override via CLI: `--max-saves=N`
- Oldest files are deleted first (ISO timestamps in filenames sort chronologically)
- Pruning runs after each save

```bash
node server/server.js --max-saves=10 --mode=blitz --timeout=2000
```

---

## 7. Frontend Flash Fix

**Problem:** After each game ended, the frontend would briefly flash/blank before the new game appeared.

**Cause:** The `GAME_RESET` handler was calling `Renderer.setGameState(null)`, clearing the canvas. Then the new game state would immediately repaint it — causing a visible flash.

**Fix:**
- Removed `Renderer.setGameState(null)` from the GAME_RESET handler
- Replay history is now reset on `GAME_STARTED` instead, so old states don't mix with the new game

---

## 8. Files Changed

| File | Changes |
|------|---------|
| `visuals/js/app.js` | Rewrote Replay system, added save/load handlers, fixed duplicate state & flash bugs |
| `visuals/js/ui/panels.js` | Added `updateReplaysModal()` for dynamic saved games list |
| `visuals/index.html` | Dynamic replays modal, replays button requests saves list |
| `server/server.js` | Added `--protected`, `--max-saves` flags, LIST_SAVES/LOAD_SAVE handlers |
| `server/connections.js` | Rewritten auth to support protected mode, dynamic password loading |
| `server/game-manager.js` | Added stateHistory, saveGame(), listSaves(), loadSave(), pruneOldSaves() |
| `server/passwords.json` | Updated format with team-specific passwords |
