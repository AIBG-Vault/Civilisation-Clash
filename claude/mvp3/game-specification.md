# Civilization Clash - Game Specification (MVP3)

## 1. Overview

### 1.1 Event Context
The Artificial Intelligence Battleground (AIBG) is a 20-hour hackathon where teams develop AI bots to compete in a turn-based strategy game.

### 1.2 Game Type
- Turn-based strategy with perfect information
- Two players compete simultaneously
- No randomness, except for monument mechanic.

Civilization Clash is a turn-based strategy game where two players build armies, expand territory, and fight for control of a central monument to earn SCORE. Players manage GOLD to build soldiers, archers, and raiders while raiding enemy territory and capturing cities, with the highest SCORE at the end of 50-200 turns winning the match.

## 2. Victory Conditions

### 2.1 Game End
- **Duration**: 200 turns (Standard) or 50 turns (Blitz)
- **Early End**: One player is eliminated (loses all cities)

### 2.2 Scoring
- **Winner**: Highest SCORE at game end
- **Elimination**: Losing all cities results in immediate loss regardless of score

## 3. Resources

### 3.1 GOLD
- Currency used to build units, cities, and expand territory
- **Starting GOLD**: 20 (Standard), 50 (Blitz)
- **Income Sources**:
  - Fields: 0.5 GOLD/turn when controlled
  - Cities: 5 GOLD/turn
- **Collection**: Start of each turn

### 3.2 SCORE
- Determines the winner at game end
- **Sources**:
  - Dealing damage: 5 SCORE per damage dealt, 7 if OTHER UNIT killed.
  - Unit death (when YOUR unit dies): Soldier 10, Archer 12, Raider 3
  - Monument control: 3 SCORE per city on the map, per turn
- **Multipliers**: Combat SCORE x1.5 after turn 100, x2 after turn 150 (monument unaffected)

## 4. Map

### 4.1 Dimensions
- **Standard**: 25x15 tiles
- **Blitz**: 15x11 tiles

### 4.2 Layout
- Symmetrical (randomly generated) island surrounded by water
- Each player starts with 1 city on opposite edges
- Monument located at center

### 4.3 Terrain Types

| Terrain  | Passable | Controllable | Income     |
|----------|----------|--------------|------------|
| Field    | Yes      | Yes          | 0.5 GOLD   |
| Mountain | No       | No           | None       |
| Water    | No       | No           | None       |
| Monument | No       | No           | See 4.4    |

### 4.4 Monument
- Located at exact center of map
- **Impassable**: Units cannot enter the monument tile
- **Tagging**: Units adjacent to monument can "tag" it for their team
- **Control Resolution**: If units from both teams are adjacent, control is assigned randomly to one team
- **Benefit**: Controller receives 3 SCORE per city on the map each turn

## 5. Distance and Adjacency

### 5.1 Distance 1 (Adjacent)
All 8 surrounding tiles (cardinal + diagonal):
```
[1][1][1]
[1][X][1]
[1][1][1]
```

### 5.2 Distance 2
The 8 adjacent tiles plus 3 additional tiles in each cardinal direction:
```
   [2][2][2]
[2][1][1][1][2]
[2][1][X][1][2]
[2][1][1][1][2]
   [2][2][2]
```
Total: 8 (distance 1) + 12 (distance 2 only) = 20 tiles

## 6. Units

### 6.1 General Rules
- One unit per tile (no stacking)
- Units spawn at a city chosen by the player
- All damage is permanent (no healing)

### 6.2 Soldier (20 GOLD)

| Attribute | Value |
|-----------|-------|
| HP        | 3     |
| Damage    | 1     |
| Movement  | 1     |

- **Combat**: Auto-attacks ALL adjacent (distance 1) enemies
- **Zone of Control**: Projects ZoC in 2-tile radius
- **Immune** to enemy soldier ZoC
- **City Capture**: Can capture enemy cities


### 6.3 Archer (25 GOLD)

| Attribute | Value |
|-----------|-------|
| HP        | 2     |
| Damage    | 1     |
| Movement  | 1     |

- **Combat**: Shoots ONE enemy up to distance 2
- **Targeting**: Nearest enemy, lowest HP breaks ties
- **Restriction**: Cannot move on turns when shooting

### 6.4 Raider (10 GOLD)

| Attribute | Value |
|-----------|-------|
| HP        | 1     |
| Damage    | 1     |
| Movement  | 2     |

- **Combat**: Auto-attacks ALL adjacent (distance 1) enemies
- **Movement**: Must move through distance-1 tiles (cannot jump)
- **Vulnerable**: Trapped by soldier ZoC

## 7. Combat Mechanics

### 7.1 Damage Resolution
- All combat damage resolves simultaneously
- Deterministic outcomes (no randomness)

### 7.2 Zone of Control (ZoC)
- **Source**: Each soldier projects ZoC in 2-tile radius
- **Effect**: Raiders and Archers in ZoC cannot move (stuck until soldier dies/leaves)
- **Exception**: Soldiers ignore all enemy ZoC
- **Combat**: Trapped units can still attack adjacent enemies

### 7.3 Archer Targeting
Attacks up to 2 tile distance.
2. Select nearest enemy (Manhattan distance)
3. If tied, select lowest HP
4. If still tied, select randomly

## 8. Territory

### 8.1 Control
- Territory belongs to the player who controls it
- Neutral territory has no owner

### 8.2 Raiding Enemy Territory
- Moving a unit onto enemy territory makes it neutral
- **Movement stops**: Unit stops moving that turn after capturing

### 8.3 Expanding to Neutral Territory
- **Cost**: 5 GOLD per tile
- Must be adjacent to territory you already control
- Can chain multiple expansions in one turn

## 9. Cities

### 9.1 Building Cities
- **Cost**: 80 GOLD
- **Placement**: Must be on territory you control
- **Completion**: Instant (no build time)
- **Income**: 5 GOLD/turn

### 9.2 Capturing Cities
- Cities cannot be destroyed
- Only Soldiers can capture cities
- Ownership instantly changes if opposing soldier walks into city tile
- **On Capture**:
  - City ownership transfers to captor
  - territory on which the city was switches to captors

### 9.3 Spawning Units
- Units are built at a specific city
- Player chooses which city spawns the unit
- Unit appears on the city tile
- If unit already in city, it cannot spawn

## 10. Turn Order
1. **Income Phase**: Collect GOLD from territory and cities
2. **Archer Phase**: Archers shoot (marks them unable to move)
3. **Movement Phase**:
   - Units move up to their movement allowance
   - Cannot move if: archer shot that turn, trapped in ZoC
   - Moving onto enemy territory raids it (stops movement)
4. **Combat Phase**: Melee combat resolves
   - Soldiers attack ALL adjacent enemies
   - Raiders attack ALL adjacent enemies
   - Archers do NOT melee
5. **Build Phase**: Process unit builds, city builds, expansions
6. **Scoring Phase**: Determine monument control, award SCORE

## 11. API Specification

### 11.1 Communication
- Two players submit moves in JSON format

### 11.2 One player move to game logic
- Units are identified by their coordinates, not by ID
- Empty actions means not doing anything

```json
{
  "type": "SUBMIT_ACTIONS",
  "actions": [
    {"action": "MOVE", "from_x": 10, "from_y": 5, "to_x": 11, "to_y": 5},
    {"action": "BUILD_UNIT", "city_x": 2, "city_y": 7, "unit_type": "SOLDIER"},
    {"action": "BUILD_CITY", "x": 20, "y": 12},
    {"action": "EXPAND_TERRITORY", "x": 15, "y": 8}
  ]
}
```

### 11.3 Game logic output

```json
{
  "type": "GAME_STATE",
  "turn": 42,
  "max_turns": 200,
  "game_over": false,
  "winner": null,
  "players": [
    {
      "id": 0,
      "name": "nameX",
      "gold": 150,
      "score": 245,
      "income": 12
    },
    {
      "id": 1,
      "name": "nameY",
      "gold": 132,
      "score": 260,
      "income": 10
    }
  ],
  "map": {
    "width": 25,
    "height": 15,
    "tiles": [
      {"x": 0, "y": 0, "type": "FIELD", "owner": 0},
      {"x": 0, "y": 1, "type": "MOUNTAIN", "owner": null},
      {"x": 0, "y": 2, "type": "WATER", "owner": null}
    ]
  },
  "cities": [
    {"x": 2, "y": 7, "owner": 0 }
  ],
  "units": [
    {"x": 10, "y": 5, "owner": 0, "type": "SOLDIER", "hp": 3, "can_move_next_turn": true}
  ],
  "monument": {
    "x": 12,
    "y": 7,
    "controlled_by": 0
  }
}
```

### 11.4 Action Reference

| Action | Parameters | Cost | Notes |
|--------|------------|------|-------|
| MOVE | from_x, from_y, to_x, to_y | Free | Unit identified by position |
| BUILD_UNIT | city_x, city_y, unit_type | 10-25 | Spawns at specified city |
| BUILD_CITY | x, y | 80 | Must be on owned territory |
| EXPAND_TERRITORY | x, y | 5 | Must be adjacent to owned territory |


## 12. Design Philosophy

### 12.1 Core Concept
Aggression is rewarded through the SCORE system. Players earn SCORE both when dealing damage AND when their own units die. This creates tension between preserving units and engaging in combat.

### 12.2 Anti-Turtling Mechanisms
- Soldiers auto-attack all adjacent enemies (forced engagement)
- Zone of Control traps non-soldier units completely
- SCORE multipliers increase late-game (1.5x at turn 100, 2x at turn 150)
- Monument provides passive SCORE to controller

### 12.3 Unit Balance
- **Soldiers > Raiders**: ZoC trap + auto-attack + 3 HP
- **Raiders > Archers**: Speed and numbers overwhelm
- **Archers > Soldiers**: Range advantage, kiting potential

### 12.4 Economic Balance
- Territory: 10-turn payback (5 GOLD cost, 0.5 GOLD/turn)
- Cities: 16-turn payback (80 GOLD cost, 5 GOLD/turn)
- Combat provides immediate SCORE vs slow economic gains
