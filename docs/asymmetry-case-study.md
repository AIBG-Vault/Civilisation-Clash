# Case Study: How a Sort Order Created an 85 % Win-Rate Bias

> **tl;dr** — Two identical bots played 1 000 mirror games.
> The right-side player won **85 %** of them.
> The entire advantage came from a single tie-breaking detail in city placement — one line of code worth roughly **+35 % win rate**.

This page walks through the investigation and fix.
Read it as a playbook for the kind of hidden asymmetry that can exist inside _your_ bot — and how noticing it first can give you a serious edge.

---

## 1 — The Symptom

We ran the **econ agent** (an economy-first bot) against itself on flat, symmetric maps:

| Metric             | P0 (left) | P1 (right) |
| ------------------ | --------- | ---------- |
| Wins (of 1 000)    | **150**   | **850**    |
| Avg monument score | 168       | 412        |
| Avg combat score   | 898       | 902        |
| Avg ending units   | 7.8       | 10.2       |

Combat score was dead even — the game engine is fair.
The entire gap came from **monument control**: P1 held it for roughly 2.5x as many turns.

Meanwhile a different bot (`smart2Agent`) in the same mirror test was 50/50.
So the bias was agent-specific, not an engine bug.

---

## 2 — Ruling Things Out

| Hypothesis                                          | Test                                     | Result                                |
| --------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| Map terrain is asymmetric                           | Flatten all tiles to FIELD               | Still 85 % P1                         |
| Build-phase turn order favours P1                   | Tracked expand overlap                   | Zero overlap for 15 turns — symmetric |
| Monument first-control is biased                    | Counted who grabs it first               | 95 P0 vs 105 P1 — coin flip           |
| Movement iteration order (dx/dy loops) biases moves | Changed to true uniform random tie-break | 13.8 % → 17.8 % — minor               |
| Starting position distance matters                  | Moved both cities near center            | **51.8 % P0** — balanced!             |
| Monument scoring causes it                          | Removed monument scoring weight          | **47.8 % P0** — balanced!             |

The signal was clear: the bias appears **only** when cities are far from center **and** monument scoring matters.

---

## 3 — The Root Cause

### How the bot picks where to build a new city

```js
// getValidCityLocations — original code
for (const tile of state.map.tiles) {
  // <-- row-major order: x=0,1,2,...
  // ...
  let score = 0;
  score -= chebyshevDistance(tile, capital) * 10; // closer to capital = better
  if (minDistToOwnCity >= 2) score += 5; // spacing bonus
  locations.push({ action, score });
}
locations.sort((a, b) => b.score - a.score); // <-- stable sort
return locations; //     preserves iteration order on ties
```

The scoring function cares about **distance to capital** — but many tiles at the same distance from the capital have the **same score**. JavaScript's `Array.sort` is **stable**: ties preserve the original insertion order, which is left-to-right (row-major).

#### What this means in practice

```
Map (15 wide, center at x=7):

  P0 capital at x=2                 P1 capital at x=12
  ┌─────────────────────────────────────────────────┐
  │ .  C0 .  .  .  .  .  M  .  .  .  .  . C1  .   │
  │    ↓                                    ↓       │
  │   New city candidates at distance 2 from capital │
  │   (x=0) ← first in sort              (x=10) ← first in sort
  │                                                 │
  │   x=0 is 7 tiles from center          x=10 is 3 tiles from center
  └─────────────────────────────────────────────────┘
```

- **P0's** first city candidate (after stable sort) is at **x ≈ 0** — distance **7** from center
- **P1's** first city candidate is at **x ≈ 10** — distance **3** from center

P1's second city is ~2 tiles closer to the monument. Units spawn at cities, so P1's reinforcements arrive faster, and P1 snowballs monument control from turn 23 onward.

### Measured city placement (400 games, before fix)

|     | Avg new-city distance to center | Typical first city position |
| --- | ------------------------------- | --------------------------- |
| P0  | **6.50**                        | (1, 4) — far from center    |
| P1  | **4.60**                        | (11, 4) — near center       |

A 2-tile difference in city placement produced a **35 percentage-point** win rate swing.

---

## 4 — The Fix (3 lines)

Add center-proximity as a tie-breaker so that among tiles equally close to the capital, the one closer to the map center wins:

```js
// In getValidCityLocations:
const centerX = Math.floor(state.map.width / 2);
const centerY = Math.floor(state.map.height / 2);

score -= chebyshevDistance(tile, capital) * 10; // primary: near capital
score -= chebyshevDistance(tile, center) * 0.5; // tie-break: near center
```

The `0.5` weight is too small to ever override the `10`-weighted capital preference.
It only breaks ties — but that's all it takes.

### After fix (1 000 games each)

| Map type         | P0 %     | P1 % |
| ---------------- | -------- | ---- |
| Flat             | **50.5** | 49.5 |
| Normal (terrain) | **49.4** | 50.6 |

Dead even.

---

## 5 — Takeaways for Your Bot

### Stable sorts hide directional bias

Any time you `sort()` a list of candidate actions and multiple candidates share the same score, the iteration order of `state.map.tiles` (left-to-right, top-to-bottom) becomes the tie-breaker. If your bot is on the left side of the map, "first in iteration" means "furthest from the action". On the right side it means "closest". This applies to:

- City placement
- Expand territory direction
- Target selection
- Any greedy best-of-N loop

**Fix:** add a small symmetric tie-break (distance to center, random jitter, etc.) to every scoring function.

### Movement tie-breaking matters too

The common pattern:

```js
// WRONG — biased toward later-iterated moves (dx=+1, dy=+1)
if (s > bestScore || (s === bestScore && Math.random() < 0.5)) {
  bestScore = s;
  best = m;
}
```

On its own this was worth ~4 % of win rate. The correct version:

```js
// RIGHT — true uniform random among tied moves
if (s > bestScore) {
  bestScore = s;
  bestMoves = [m];
} else if (s === bestScore) bestMoves.push(m);
// then: bestMoves[Math.floor(Math.random() * bestMoves.length)]
```

### City placement is a strategic lever

Even when running the exact same algorithm, placing your second city 2 tiles closer to center was worth **+35 % win rate** in mirror matches. In a non-mirror match, deliberately building forward cities (toward the monument and the enemy) can be an enormous source of alpha — you don't need a better combat algorithm, just better logistics.

### Test for bias by swapping sides

Run your bot against itself 200+ times. If P0 % isn't between 45–55 %, you have a positional asymmetry. Then swap your bot between P0 and P1 slots to confirm it's position-dependent, not player-ID-dependent.

```js
// Quick mirror test
for (let i = 0; i < 200; i++) {
  let state = createInitialState({ mode: 'blitz', seed: i });
  while (!state.gameOver) {
    const a0 = myAgent.generateActions(state, 0);
    const a1 = myAgent.generateActions(state, 1);
    state = processTurn(state, { player0: a0, player1: a1 }).newState;
  }
  wins[state.winner]++;
}
console.log(`P0=${wins[0]} P1=${wins[1]}`); // should be ~50/50
```

If it's not 50/50, you have free win rate on the table.
