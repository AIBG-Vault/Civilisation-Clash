# Civilization Clash - Frontend Visual Plan

## Tech Stack

- **Rendering**: HTML5 Canvas (isometric game board)
- **Styling**: Tailwind CSS
- **Icons**: Lucide Icons
- **Framework**: Vanilla JS (can migrate to framework later)
- **Layout**: CSS Grid + Flexbox

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────┐                  ┌─────────────┐           ┌─────────────┐  │
│ │ PLAYER 0    │                  │  TURN INFO  │           │ PLAYER 1    │  │
│ │ Stats Panel │                  │   + Timer   │           │ Stats Panel │  │
│ │ (top-left)  │                  │ (top-center)│           │ (top-right) │  │
│ └─────────────┘                  └─────────────┘           └─────────────┘  │
│                                                                             │
│                                                                             │
│                        ╔═══════════════════════════╗                        │
│                        ║                           ║                        │
│                        ║     ISOMETRIC CANVAS      ║        ┌─────────────┐ │
│                        ║       (game board)        ║        │  INSPECTOR  │ │
│                        ║                           ║        │   PANEL     │ │
│                        ║    - Terrain tiles        ║   ◄──  │  (slide-in) │ │
│                        ║    - Units                ║        │             │ │
│                        ║    - Cities               ║        │ Tile/Unit   │ │
│                        ║    - Monument             ║        │ details     │ │
│                        ║    - Territory borders    ║        └─────────────┘ │
│                        ║                           ║                        │
│                        ╚═══════════════════════════╝                        │
│                                                                             │
│ ┌─────────────┐                                                             │
│ │  CONTROLS   │                                                             │
│ │ (bot-left)  │                                                             │
│ └─────────────┘                                                             │
│                  ┌───────────────────────────────────────┐                  │
│                  │            ACTION BAR                 │                  │
│                  │  [Submit] | [Build] [Expand] [City]   │                  │
│                  │           | Queued: 2 actions         │                  │
│                  └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components Breakdown

### 1. Player Stats Panel (x2 - corners)

```
┌──────────────────────────────┐
│ ● Blue Empire          [−]  │  <- connection dot, minimize btn
├──────────────────────────────┤
│  💰 145    📈 +12    ⭐ 320  │  <- gold, income, score
│  🏛️ 2      ⚔️ 4     📍 8    │  <- cities, units, tiles
└──────────────────────────────┘
```

- Frosted glass background (backdrop-blur)
- Collapsible (minimize to just title bar)
- Connection status indicator
- Lucide icons for stats

### 2. Turn Info Panel (top center)

```
┌─────────────────────────────────────────────┐
│  ● Live  │  Turn 12/200  │  01:45  │  🏆 Blue  │
└─────────────────────────────────────────────┘
```

- Connection status
- Turn counter
- Timer (countdown or elapsed)
- Monument controller

### 3. Action Bar (bottom center)

```
┌────────────────────────────────────────────────────────────┐
│ [✓ Submit Turn]  │  [🏗️ Build] [📍 Expand] [🏛️ City]  │  2 queued │
└────────────────────────────────────────────────────────────┘
```

- Primary action: Submit Turn
- Build actions open modals/popovers
- Queued actions count
- Can show/hide based on role (spectator vs player)

### 4. Controls Panel (bottom left)

```
┌──────────────────┐
│ [📟] [📋] [⚙️] [🌓] │
└──────────────────┘
```

- Terminal toggle
- Replays/History
- Settings
- Theme toggle

### 5. Inspector Panel (right slide-in)

```
┌──────────────────────────────┐
│ Tile Details            [×] │
├──────────────────────────────┤
│ Position     (5, 3)         │
│ Terrain      Grass          │
│ Owner        Blue           │
│ Income       +1/turn        │
├──────────────────────────────┤
│ UNIT                        │
│ Type         Soldier        │
│ HP           ███░░  2/3     │
│ Can Move     Yes            │
├──────────────────────────────┤
│ [→ Move Unit] [👁️ Range]    │
└──────────────────────────────┘
```

- Opens when tile clicked
- Shows tile info + unit info if present
- Action buttons for selected unit

### 6. Terminal Overlay (bottom slide-up)

```
┌─────────────────────────────────────────────────────────────┐
│ Server Messages                                         [×] │
├─────────────────────────────────────────────────────────────┤
│ [14:32:15] Connected to ws://localhost:8080                 │
│ [14:32:16] AUTH_SUCCESS: spectator                          │
│ [14:32:18] TURN_START: Turn 12, timeout 2000ms              │
│ [14:32:19] ACTIONS_RECEIVED: Team 0 - 3 actions             │
└─────────────────────────────────────────────────────────────┘
```

### 7. Modal Dialogs

**Settings Modal:**

- Server status + URL
- Map type selector
- Map size selector
- Turn timeout input
- Manual play toggle
- Client override toggle
- Theme toggle

**Build Unit Modal:**

- Unit type cards (Soldier, Archer, Raider)
- City selector
- Cost display
- Confirm button

**Replays Modal:**

- List of past games
- Current game indicator
- Click to load replay

---

## Isometric Canvas Design

### Coordinate System

```
        (0,0)
          ◆
         ╱ ╲
        ╱   ╲
    (0,1)    (1,0)
       ◆─────◆
      ╱ ╲   ╱ ╲
     ╱   ╲ ╱   ╲
    ◆─────◆─────◆
  (0,2) (1,1) (2,0)
```

- Each tile is a diamond shape
- Grid coordinates (x, y) map to screen via:
  ```
  screenX = (x - y) * tileWidth/2 + offsetX
  screenY = (x + y) * tileHeight/2 + offsetY
  ```

### Tile Rendering Layers (bottom to top)

1. **Terrain base** - grass, forest, mountain, water textures
2. **Territory overlay** - semi-transparent team color
3. **Tile border** - subtle edge highlight
4. **City/Monument** - building sprites
5. **Units** - character sprites with team colors
6. **Selection highlight** - animated border
7. **Movement indicators** - valid move targets
8. **Attack indicators** - valid attack targets

### Tile Types Visual

| Type     | Base Color | Texture/Pattern           |
| -------- | ---------- | ------------------------- |
| Grass    | #8fbc8f    | Subtle noise              |
| Forest   | #228b22    | Tree pattern overlay      |
| Mountain | #808080    | Rocky texture, impassable |
| Water    | #4682b4    | Wave animation            |
| Monument | #ffd700    | Golden glow, special tile |

### Unit Sprites

```
     ╭───╮
     │ S │  <- Letter badge
     ╰───╯
    ╱▓▓▓▓▓╲  <- Team color fill
   ╱ ▓▓▓▓▓ ╲
  ▔▔▔▔▔▔▔▔▔▔
```

- Circular badge with unit letter (S/A/R)
- Team color (blue/orange)
- Shadow underneath
- HP bar below unit

### Territory Borders

- Draw thick colored lines between owned and unowned tiles
- Use team colors with ~30% opacity fill
- Dashed lines for contested areas

---

## Interaction States

### Tile States

- **Default**: Normal rendering
- **Hover**: Slight brightness increase, cursor change
- **Selected**: Animated pulsing border
- **Valid Move**: Green tint overlay
- **Valid Attack**: Red tint overlay
- **Disabled**: Grayed out

### Unit States

- **Idle**: Static sprite
- **Selected**: Bounce animation, range indicators shown
- **Can't Move**: Slightly faded
- **Damaged**: HP bar visible in red

---

## Color Palette

```css
:root {
  /* Teams */
  --team-0: #0071e3; /* Blue */
  --team-0-light: #4da3ff;
  --team-0-bg: rgba(0, 113, 227, 0.15);

  --team-1: #ff6b35; /* Orange */
  --team-1-light: #ff9a76;
  --team-1-bg: rgba(255, 107, 53, 0.15);

  /* Terrain */
  --grass: #90b060;
  --forest: #4a7c3f;
  --mountain: #8b8b8b;
  --water: #5b9bd5;
  --monument: #ffd700;

  /* UI */
  --bg-light: #f5f5f7;
  --bg-dark: #1c1c1e;
  --card-light: rgba(255, 255, 255, 0.85);
  --card-dark: rgba(44, 44, 46, 0.85);

  /* Status */
  --success: #34c759;
  --warning: #ff9f0a;
  --danger: #ff3b30;
}
```

---

## File Structure

```
visuals/
├── index.html              # Main app entry
├── css/
│   └── styles.css          # Custom styles (Tailwind imported)
├── js/
│   ├── app.js              # Main application
│   ├── canvas/
│   │   ├── renderer.js     # Canvas rendering engine
│   │   ├── isometric.js    # Isometric math utilities
│   │   ├── tiles.js        # Tile rendering
│   │   ├── units.js        # Unit rendering
│   │   └── animations.js   # Animation loops
│   ├── ui/
│   │   ├── panels.js       # HUD panels
│   │   ├── modals.js       # Modal dialogs
│   │   ├── inspector.js    # Inspector panel
│   │   └── terminal.js     # Terminal overlay
│   ├── state/
│   │   ├── game.js         # Game state management
│   │   └── actions.js      # Action queue
│   └── network/
│       └── websocket.js    # WebSocket connection
└── assets/
    └── (sprites if needed)
```

---

## Responsive Considerations

- **Desktop (>1200px)**: Full layout as designed
- **Tablet (768-1200px)**:
  - Smaller tile size
  - Inspector as modal instead of slide-in
  - Stacked stats panels on mobile
- **Mobile (<768px)**:
  - Touch-friendly larger buttons
  - Bottom sheet for inspector
  - Swipe gestures for panning

---

## Animation List

1. **Turn timer pulse** - Warning when <10 seconds
2. **Unit selection bounce** - Subtle up/down
3. **Movement path** - Dotted line animation
4. **Attack flash** - Red flash on damaged unit
5. **Score change** - Number fly-up animation
6. **Territory capture** - Color wash transition
7. **Monument glow** - Pulsing golden aura
8. **Connection indicator** - Gentle pulse when connected

---

## Implementation Priority

### Phase 1: Core Canvas

1. [ ] Set up canvas with proper scaling
2. [ ] Implement isometric coordinate system
3. [ ] Render static tile grid
4. [ ] Add terrain types with colors
5. [ ] Implement camera pan/zoom

### Phase 2: Game Objects

1. [ ] Render cities
2. [ ] Render units with team colors
3. [ ] Render monument
4. [ ] Add territory ownership visuals
5. [ ] Implement tile selection

### Phase 3: UI Panels

1. [ ] Player stats panels
2. [ ] Turn info bar
3. [ ] Action bar
4. [ ] Controls panel
5. [ ] Inspector panel

### Phase 4: Interactivity

1. [ ] Tile click handling
2. [ ] Unit selection
3. [ ] Move/attack indicators
4. [ ] Action queuing
5. [ ] Submit turn flow

### Phase 5: Network

1. [ ] WebSocket connection
2. [ ] State synchronization
3. [ ] Real-time updates
4. [ ] Replay playback

### Phase 6: Polish

1. [ ] Animations
2. [ ] Sound effects (optional)
3. [ ] Responsive adjustments
4. [ ] Performance optimization
