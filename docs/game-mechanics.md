# Game Mechanics

## Game Modes

|                   | Standard | Blitz   |
| ----------------- | -------- | ------- |
| **Map Size**      | 25 x 15  | 15 x 10 |
| **Max Turns**     | 200      | 50      |
| **Starting Gold** | 20       | 50      |

Server defaults to blitz. Use `--mode=standard` for standard.

## Map

### Terrain

| Terrain  | Passable | Controllable | Income                    |
| -------- | -------- | ------------ | ------------------------- |
| Field    | Yes      | Yes          | 0.5G / turn               |
| Mountain | No       | No           | --                        |
| Water    | No       | No           | --                        |
| Monument | No       | No           | See [Monument](#monument) |

The map is a symmetrical island surrounded by water, with mountains scattered across the interior. Each player starts on opposite sides with a capital city and some territory. The monument sits at the center.

### Monument

The monument is impassable. Control is determined by adjacent units (Chebyshev distance 1):

- **One team adjacent**: that team controls it
- **Both teams adjacent**: control goes to `turn % 2` (team 0 on even, team 1 on odd)
- **Nobody adjacent**: previous controller keeps it

Monument score per turn:

| Turns    | Score |
| -------- | ----- |
| 1--100   | 5     |
| 101--150 | 10    |
| 151--200 | 15    |

Monument scoring is not affected by combat multipliers.

## Distance

The game uses **Chebyshev distance**: `max(|dx|, |dy|)`. Diagonals cost the same as cardinal moves.

**Distance 1** -- the 8 surrounding tiles (king moves):

```
[1][1][1]
[1][X][1]
[1][1][1]
```

Used for: movement (soldiers, archers), melee range, monument control, territory adjacency.

**Distance 2** -- the 5x5 square minus center (24 tiles):

```
[2][2][2][2][2]
[2][1][1][1][2]
[2][1][X][1][2]
[2][1][1][1][2]
[2][2][2][2][2]
```

Used for: archer range, soldier Zone of Control, raider movement.

> Archer target _selection_ tiebreaks use Manhattan distance (`|dx| + |dy|`), but the range check itself is Chebyshev.

## Units

|                     | Soldier              | Archer                     | Raider               |
| ------------------- | -------------------- | -------------------------- | -------------------- |
| **Cost**            | 20G                  | 25G                        | 10G                  |
| **HP**              | 3                    | 2                          | 1                    |
| **Damage**          | 1                    | 1                          | 1                    |
| **Movement**        | 1                    | 1                          | 2                    |
| **Attack**          | Melee (all adjacent) | Ranged (1 target, range 2) | Melee (all adjacent) |
| **Zone of Control** | Range 2              | --                         | --                   |
| **ZoC Immune**      | Yes                  | No                         | No                   |
| **Captures Cities** | Yes                  | No                         | No                   |
| **Death Score**     | 10                   | 12                         | 3                    |

### Soldier

Projects Zone of Control at range 2 -- enemy archers and raiders inside it cannot move. Immune to enemy ZoC. The only unit that can capture cities (move onto an enemy city to take it). Auto-attacks all adjacent enemies in the melee phase.

<div class="gif-placeholder" data-name="soldier-zoc">Soldier Zone of Control</div>

### Archer

Shoots one enemy per turn within Chebyshev distance 2. Fires in the Archer phase (before movement). Cannot move on turns it shoots. Does not melee. Vulnerable to ZoC.

Target selection: nearest by Manhattan distance, then lowest HP, then leftmost (lowest x), then topmost (lowest y).

<div class="gif-placeholder" data-name="archer-targeting">Archer target selection</div>

### Raider

Movement 2 (Chebyshev). Moving onto enemy territory raids it (sets to neutral, stops movement). Auto-attacks all adjacent enemies in melee. Cannot capture cities. Vulnerable to ZoC.

## Combat

All damage is **simultaneous**. During each combat phase, damage is calculated first, then applied at once. Two units can kill each other in the same turn.

### Zone of Control

Soldiers project ZoC at Chebyshev distance 2. Enemy archers and raiders in ZoC cannot move. Soldiers are immune to ZoC. Trapped units can still attack -- they just can't move. ZoC is checked at the start of the movement phase.

<div class="gif-placeholder" data-name="combat-resolution">Combat resolution</div>

### Melee

Soldiers and raiders auto-attack **all** adjacent enemies (distance 1) in Phase 4. Not targeted -- every adjacent enemy takes damage. Archers do not melee. Damage resolves simultaneously.

## Economy

### Income (Phase 1)

| Source           | Per Turn |
| ---------------- | -------- |
| Owned field tile | 0.5G     |
| City             | 5G       |

### Expand Territory

**5G** per tile. Target must be neutral, controllable (field), and adjacent to your territory (distance 1). Expansions chain within a turn -- each new tile counts as your territory for subsequent expansions.

### Build City

**80G**. Must be on a field tile you own, with no unit or city on it. Produces 5G/turn.

### Build Unit

Spawned at your cities. City tile must be unoccupied. New units cannot move on their spawn turn.

| Unit    | Cost |
| ------- | ---- |
| Soldier | 20G  |
| Archer  | 25G  |
| Raider  | 10G  |

## Scoring

| Event            | Score                               | Recipient  |
| ---------------- | ----------------------------------- | ---------- |
| Deal 1 damage    | 5                                   | Attacker   |
| Kill a unit      | 7 (replaces the 5 for killing blow) | Attacker   |
| Own Soldier dies | 10                                  | Owner      |
| Own Archer dies  | 12                                  | Owner      |
| Own Raider dies  | 3                                   | Owner      |
| Monument control | 5 / 10 / 15 per turn                | Controller |

### Combat Multipliers

Combat score (damage, kills, death bonuses) scales over time:

| Turns    | Multiplier |
| -------- | ---------- |
| 1--100   | x1         |
| 101--150 | x1.5       |
| 151--200 | x2         |

Monument scoring is not multiplied.

### Victory Conditions

1. **Score**: highest score after all turns wins
2. **Elimination**: lose all cities and you lose immediately
3. **Tie**: equal scores after all turns

## Turn Phases

Both players submit actions before processing begins. Phases run in this order:

1. **Income** -- collect gold from owned tiles and cities
2. **Archers** -- all archers with targets in range fire. Archers that fire cannot move this turn.
3. **Movement** -- MOVE actions processed. ZoC enforced. Moving onto enemy territory raids it. Soldiers capture enemy cities.
4. **Melee** -- soldiers and raiders auto-attack all adjacent enemies. Damage simultaneous.
5. **Build** -- BUILD_UNIT, BUILD_CITY, EXPAND_TERRITORY processed. Gold deducted. New units spawn with `canMove: false`.
6. **Scoring** -- monument control determined, monument score awarded, end conditions checked.
