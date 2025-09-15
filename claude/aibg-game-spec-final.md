# Artificial Intelligence Battleground - Game Specification

## 1. Context

### 1.1 Event Overview
The **Artificial Intelligence Battleground (AIBG)** is a 20-hour hackathon where teams develop AI bots to compete in a custom-built strategy game. Teams have 20 hours to analyze the game mechanics, develop strategies, and implement their bots. The best performing bot wins a cash prize.

### 1.2 Competition Format
- **Development Time**: Teams have 20 hours to create their bots
- **Game Type**: Turn-based strategy with perfect information
- **Evaluation**: Bots compete in a tournament format
- **Requirements**: Bots must be able to play via API, making decisions within 0.25 seconds per turn

## 2. Game Rules

### 2.1 Victory Conditions
- **Duration**: 200 turns (Standard) or 50 turns (Blitz)
- **Early End**: If one player eliminated
- **Score**: Territory Points + (Blood Points × 2)
- **Winner**: Highest score

### 2.2 Map
- **Size**: 25×15 tiles (Standard), 15×10 tiles (Blitz)
- **Layout**: Symmetrical island
- **Starting**: Each player has 1 city on opposite edges
- **Terrain Types**:
  - Field: 0.5 TP/turn when controlled
  - Mountain: Impassable, cannot be controlled
  - Water: Impassable, cannot be controlled (shapes the island)

### 2.3 Monument
- Located at center of map
- One unit can occupy it
- Generates BP per turn for controller:
  - Turns 1-100: 5 BP/turn
  - Turns 101-150: 10 BP/turn
  - Turns 151-200: 15 BP/turn

### 2.4 Visual Elements
- **Units**: Pixel art sprites with health bars
- **Cities**: Pixel art buildings
- **Monument**: Distinct pixel art structure
- **Terrain**: Pixel art tiles for fields, mountains, water

## 3. Economy

### 3.1 Territory Points (TP)
- **Income**: Fields generate 0.5 TP/turn, Cities generate 5 TP/turn
- **Starting TP**: 20 (Standard), 50 (Blitz)
- **Collection**: Start of each turn

### 3.2 Blood Points (BP)
- **Value**: Worth 2x in final score
- **Sources**:
  - Dealing damage: 5 BP per damage
  - Unit death (when YOUR unit dies): Soldier 10 BP, Archer 12 BP, Raider 3 BP
  - Monument control: 5/10/15 BP per turn
- **Multipliers**: Combat BP × 1.5 after turn 100, × 2 after turn 150 (monument not affected)

### 3.3 Actions

#### Territory Expansion (5 TP)
- Claims one unclaimed adjacent tile
- Can expand from any controlled territory
- New territory generates income next turn

#### City Building (80 TP)
- Build on your controlled territory
- Must be 5+ tiles from other friendly cities  
- Takes 3 turns to complete (cancelled if tile lost)
- Generates 5 TP/turn when complete

## 4. Units

### 4.1 Soldier (20 TP)
- **HP**: 3
- **Damage**: 1
- **Movement**: 1 tile/turn
- **Combat**: Auto-attacks ALL adjacent enemies each turn
- **Zone of Control**: 2-tile radius (traps enemies except other soldiers)
- **Immune to enemy soldier ZoC**
- **Can capture cities** (3-turn occupation)
- **Death Bonus**: 10 BP

### 4.2 Archer (25 TP)
- **HP**: 2
- **Damage**: 1
- **Movement**: 1 tile/turn (cannot move if shoots)
- **Combat**: Shoots ONE enemy within range 1-2
- **Target Priority**: Nearest enemy (lowest HP breaks ties)
- **Death Bonus**: 12 BP

### 4.3 Raider (10 TP)
- **HP**: 1
- **Damage**: 1
- **Movement**: 2 tiles/turn
- **Combat**: Attacks ALL adjacent enemies
- **Trapped by soldier ZoC**
- **Death Bonus**: 3 BP

## 5. Combat Mechanics

### 5.1 Basic Rules
- **One unit per tile** (no stacking)
- **Adjacent combat**: Melee units fight enemies 1 tile away
- **Ranged combat**: Archers shoot at range 1-2
- **Deterministic**: No randomness
- **Simultaneous**: All damage resolves at same time
- **No healing**: All damage is permanent

### 5.2 Zone of Control (ZoC)
- **Source**: Each soldier projects 2-tile radius ZoC
- **Effect**: Raiders/Archers entering ZoC cannot move (completely stuck)
- **Exception**: Enemy soldiers ignore all ZoC
- **Combat**: Trapped units still fight if adjacent to enemies
- **Example**: Raider enters ZoC → cannot move until soldier leaves/dies

### 5.3 Territory Capture
- **Enemy territory**: Changes control when your unit moves onto it
- **Capture fatigue**: Unit that captures enemy territory cannot move next turn
- **Expansion**: Using expand action (5 TP) claims neutral tiles
- **Income**: Controlled territory generates TP starting next turn

### 5.4 City Capture
- Only soldiers can capture cities
- Must occupy city for 3 consecutive turns
- Progress resets if soldier leaves or dies
- Captured city immediately produces for new owner

## 6. Turn Order

1. **Income Phase**: Collect TP from territory and cities
2. **Archer Phase**: Each archer shoots one enemy within range 1-2 (marks archer unable to move)
3. **Movement Phase**: 
   - Units move up to their movement allowance
   - Cannot move if: shot this turn, trapped in ZoC, or captured territory last turn
   - Moving onto enemy territory captures it automatically
4. **Combat Phase**: All adjacent units fight:
   - Soldiers auto-attack ALL adjacent enemies
   - Raiders attack ALL adjacent enemies
   - Archers do NOT participate (no melee)
5. **Economic Phase**: Process builds and expansions
6. **Control Phase**: Update territory and monument ownership
7. **BP Phase**: Award BP and apply multipliers

## 7. API Specification

### 7.1 Communication Protocol
- Turn-based synchronous gameplay
- Both players submit actions simultaneously
- 0.25 second timeout per turn
- Complete game state sent each turn

### 7.2 Client → Server

#### SUBMIT_TURN
```json
{
  "type": "SUBMIT_TURN",
  "actions": [
    {"action": "MOVE", "unit_id": 42, "x": 10, "y": 5},
    {"action": "BUILD_UNIT", "city_id": 1, "unit_type": "SOLDIER"},
    {"action": "BUILD_CITY", "x": 20, "y": 12},
    {"action": "EXPAND_TERRITORY", "x": 15, "y": 8}
  ]
}
```

### 7.3 Server → Client

#### GAME_STATE
```json
{
  "type": "GAME_STATE",
  "turn": 42,
  "game_over": false,
  "winner": null,
  "players": [
    {
      "id": 0,
      "territory_points": 150,
      "blood_points": 45,
      "income_per_turn": 12
    },
    {
      "id": 1,
      "territory_points": 132,
      "blood_points": 60,
      "income_per_turn": 10
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
    {"id": 1, "x": 2, "y": 7, "owner": 0, "capture_progress": 0, "under_construction": false}
  ],
  "units": [
    {"id": 42, "x": 10, "y": 5, "owner": 0, "type": "SOLDIER", "hp": 3, "can_move": true}
  ],
  "monument": {
    "x": 12,
    "y": 7,
    "controlled_by": 0
  }
}
```

### 7.4 Action Validation
- Invalid actions silently ignored
- Server has final authority
- Actions processed in order submitted

## 8. Game Modes

### 8.1 Blitz Mode (Development)
- 50 turns
- 15×10 map
- 50 starting TP
- Monument: 10 BP/turn constant
- 5-10 minute games

### 8.2 Standard Mode (Competition)
- 200 turns
- 25×15 map
- 20 starting TP
- Monument: 5/10/15 BP scaling
- 20-40 minute games

## 9. Development Tools

Agents connect to the server via WebSockets. The server just responds to user systems.

### 9.1 Debug API
```json
{"type": "SAVE_STATE", "filename": "turn_42.json"}
{"type": "LOAD_STATE", "filename": "turn_42.json"}
{"type": "RESET_GAME"}
```

### 9.2 Playback Controls (frontend)
- Pause/Resume
- Step forward one turn
- Take control of either player

### 9.3 Debug Overlays (low priority)
- Combat View: ZoC and archer ranges
- Economic View: TP income per tile
- Ownership View: Territory control


## 10. Design Philosophy (Brief)

**Core Concept**: Both players earn BP from combat - you get points when dealing damage AND when your units die. This makes aggression always favorable (except raiders who lose money on death).

**Anti-Turtling**: Soldiers auto-attack ALL adjacent enemies (forced combat), ZoC traps units completely (no escape), BP worth 2x TP in score, BP multipliers late game (1.5x turn 100, 2x turn 150), fast 0.25s timer prevents calculation.

**Unit Balance**: Soldiers beat Raiders (ZoC trap + auto-attack + 3 HP), Raiders beat Archers (3+ raiders overwhelm), Archers beat single units (range advantage).

**Economic Balance**: Territory has 10-turn payback (5 TP → 0.5 TP/turn), Cities have 16-turn payback (80 TP → 5 TP/turn), Combat gives immediate BP vs slow territory income.

## 11. Basic Strategies

- **Rush**: Early soldiers, contest monument, use ZoC to trap enemies
- **Economic**: Build cities first (80 TP investment), expand territory, defend minimally
- **Raider Swarm**: Mass cheap units (10 TP each), need 3+ to overwhelm one archer
- **Archer Fortress**: Static defense at chokepoints, soldiers provide ZoC support
- **Combined Arms**: Mix all three unit types for flexibility

## 12. Edge Cases

- Soldier dies during city capture → progress resets to 0
- Units can capture territory while trapped in ZoC (still get capture fatigue)
- Monument control → whoever has unit on tile gets BP
- Archer targeting → Manhattan distance, then lowest HP for ties
- No enemies in archer range 1-2 → archer can move normally
- Multiple soldiers' ZoC → overlaps don't stack
- Territory expansion (5 TP action) → no capture fatigue
- Moving onto enemy territory → automatic capture with fatigue
- Archer adjacent to enemy → cannot attack (range 1-2 only, adjacent is melee)
- Water and mountain tiles → impassable, cannot be controlled