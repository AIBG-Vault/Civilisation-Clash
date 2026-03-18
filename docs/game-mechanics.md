# Game Mechanics

## Game Modes

|                   | Standard | Blitz   | Tournament |
| ----------------- | -------- | ------- | ---------- |
| **Map Size**      | 25 x 15  | 15 x 11 | 25 x 23    |
| **Max Turns**     | 200      | 50      | 350        |
| **Starting Gold** | 20       | 50      | 40         |

Server defaults to blitz. Use `--mode=standard` or `--mode=tournament`.

## Map

### Terrain

| Terrain  | Passable | Controllable | Income                    |
| -------- | -------- | ------------ | ------------------------- |
| Field    | Yes      | Yes          | 0.5G / turn               |
| Mountain | No       | No           | --                        |
| Water    | No       | No           | --                        |
| Monument | No       | No           | See [Monument](#monument) |

The map is a symmetrical island surrounded by water, with mountains scattered across the interior. Each player starts on opposite sides with a capital city and some territory.

### Monuments

Monuments are impassable tiles. Control is determined by adjacent units (Chebyshev distance 1):

- **One team adjacent**: that team controls it
- **Both teams adjacent**: control assigned randomly (50/50)
- **Nobody adjacent**: previous controller keeps it

Each monument's controller receives **3 gold per turn** AND **3 score per city on the map** per turn, independently. With 2 monuments, both can be controlled simultaneously (potentially by different players).

**Standard/Blitz**: 1 monument at map center.
**Tournament**: 2 monuments in the middle of the side lanes (top and bottom). No monument in the middle lane.

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
| **Cost**            | 20G                  | 25G                        | 15G                  |
| **HP**              | 2                    | 2                          | 1                    |
| **Damage**          | 1                    | 1                          | 1                    |
| **Movement**        | 1 (2 on road)        | 1 (2 on road)              | 2 (4 on road)        |
| **Attack**          | Melee (all adjacent) | Ranged (1 target, range 2) | Melee (all adjacent) |
| **Zone of Control** | Range 2              | --                         | --                   |
| **ZoC Immune**      | Yes                  | No                         | No                   |
| **Captures Cities** | Yes                  | No                         | No                   |
| **Plunder**         | --                   | --                         | 3x3 area, 3G/tile    |
| **Death Score**     | 10                   | 12                         | 3                    |

### Soldier

Projects Zone of Control at range 2 -- enemy archers and raiders inside it cannot move. Immune to enemy ZoC. The only unit that can capture cities (move onto an enemy city to take it). Auto-attacks all adjacent enemies in the melee phase.

<div class="gif-placeholder" data-name="soldier-zoc">Soldier Zone of Control</div>

### Archer

Shoots one enemy per turn within Chebyshev distance 2. Fires in the Archer phase (before movement). Cannot move on turns it shoots. Does not melee. Vulnerable to ZoC.

Target selection: nearest by Manhattan distance, then lowest HP, then random.

<div class="gif-placeholder" data-name="archer-targeting">Archer target selection</div>

### Raider

Movement 2 (Chebyshev). Moves freely through enemy territory (does **not** stop like other units). Each turn, **plunders** a 3x3 area (Chebyshev ≤ 1) around its position: enemy tiles become neutral, and the raider's owner gains **3G per tile plundered**. Plunder does not affect city tiles. Auto-attacks all adjacent enemies in melee. Cannot capture cities. Vulnerable to ZoC.

## Counter Triangle

Units have damage multipliers against each other, creating a rock-paper-scissors dynamic:

| Attacker → Target | Soldier | Archer | Raider |
| ----------------- | ------- | ------ | ------ |
| **Soldier**       | 1×      | 1×     | **2×** |
| **Archer**        | **2×**  | 1×     | 1×     |
| **Raider**        | **0×**  | **2×** | 1×     |

- **Soldiers crush raiders**: 2× damage = instant kill (1HP raider)
- **Archers pierce soldiers**: 2× damage = instant kill from range 2 (2HP soldier)
- **Raiders assassinate archers**: 2× damage = instant kill in melee (2HP archer)
- **Raiders bounce off soldiers**: 0 damage — soldiers are armored

Every counter is a **one-shot kill**. Build the right unit for the enemy composition.

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

### Unit Upkeep

Each city supports **3 units for free**. Beyond that, upkeep grows geometrically:

```
excess = max(0, total_units - cities × 3)
upkeep = 0.5 × (1.12^excess - 1) / (1.12 - 1)
```

| Excess units | Upkeep/turn |
| ------------ | ----------- |
| 0            | 0G          |
| 3            | 1.7G        |
| 6            | 4.1G        |
| 10           | 8.8G        |
| 15           | 17.4G       |
| 20           | 31.2G       |

If gold goes negative, the cheapest units are automatically disbanded until the player is solvent. Upkeep is deducted during the Income phase.

### Expand Territory

**5G** per tile. Target must be neutral, controllable (field), and adjacent to your territory (distance 1). The adjacent territory must be **connected to one of your cities** — cut-off territory (isolated by enemy raids or captures) cannot be expanded from. Expansions chain within a turn — each new tile counts as your territory for subsequent expansions.

### Build City

**Geometric cost: 80G × 1.5^n** where n = number of cities you've already built (capital doesn't count). Must be on a field tile you own, with no unit or city on it. Produces 5G/turn.

| Next City | Cost |
| --------- | ---- |
| 1st built | 80G  |
| 2nd built | 120G |
| 3rd built | 180G |
| 4th built | 270G |

### Build Road

**15G** per tile. Must be a field tile you own, with no existing road. Roads double a unit's movement when the unit starts its turn on a road tile (soldier 1→2, archer 1→2, raider 2→4). Roads persist through ownership changes — captured roads benefit the new owner.

### Build Unit

Spawned at your cities. City tile must be unoccupied. New units cannot move on their spawn turn.

| Unit    | Cost |
| ------- | ---- |
| Soldier | 20G  |
| Archer  | 25G  |
| Raider  | 15G  |

## Scoring

| Event            | Score                               | Recipient |
| ---------------- | ----------------------------------- | --------- |
| Deal 1 damage    | 5                                   | Attacker  |
| Kill a unit      | 7 (replaces the 5 for killing blow) | Attacker  |
| Own Soldier dies | 10                                  | Owner     |
| Own Archer dies  | 12                                  | Owner     |
| Own Raider dies  | 3                                   | Owner     |

### Monument Rewards

Each controlled monument gives its controller **3 gold per turn** (flat) and **3 score per city on the map** per turn. Gold is flat; score scales with total cities. Both are awarded during the scoring phase.

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
5. **Build** -- BUILD_UNIT, BUILD_CITY, BUILD_ROAD, EXPAND_TERRITORY processed. Gold deducted. New units spawn with `canMove: false`.
6. **Scoring** -- monument control determined, monument gold awarded, end conditions checked.
