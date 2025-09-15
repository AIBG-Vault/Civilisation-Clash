# Task: Create Architecture Design Document

## Context
This project is a web-based video game ("Topic") for a hackathon called Artificial Intellgience Battleground ("AIBG").

## Objective
Create a comprehensive architecture design document (`claude/topic-architecture.md`) that will serve as the primary context for all future development of the AIBG Civilization Clash game.

## Background
- Game specification: `claude/aibg-game-spec-final.md`
- Reference implementation from last year: `./LAST_YEAR_SNAKE_GAME_FOR_VIEWING_ONLY/`
- Note: Last year was a different game (Snake), use only for structural inspiration

## Requirements

### Must Have
1. **Docker containerization** - Server must be runnable in a Docker container easily.
2. **Node.js server** - Game server implemented in Node.js
3. **Vanilla frontend** - No heavy frameworks (HTML/CSS/vanilla JS only, WebSocket library allowed, other libraries allowed if they significantly help)
4. **Comprehensive testing** - Especially game logic validation
5. **Clean, readable code** - Clear naming, consistent style

### Architecture Must Support
1. - Two bots connected, frontend with on projector
2. **Dev mode** - Local testing with manual controls and bot debugging
3. **Complete isolation** - Bot developers should need zero knowledge of implementation

## Deliverable Structure
The `topic-architecture.md` file should include:

1. **Overview** (1 paragraph max)
2. **Tech Stack**
3. **Project Structure** (folder layout with purpose of each)
4. **Component Design**
   - Server architecture
   - Frontend architecture
   - Bot client interface
   - WebSocket protocol details
5. **Testing Strategy** (Create tests for the game logic. This is to check if future instances of Claude code will do what they were supposed to do.)
6. **Development Workflow** (how to run, test, deploy)
7. **Key Design Decisions** (explain non-obvious choices+)
8. **More if needed**

## Success Criteria
- Another Claude instance can understand and implement features using only this document
- Game mechanics from spec are testable
- Setup takes < 5 minutes for new developers

## Extra info
- Should the server support concurrent games? I don't know, I want the Reinforecement learning people not to have too hard of a time, I don't know if this will benefit them. It could be useful? Decide.
- Authentication - last year it was with passwords (defined in advance to the server, then told the teams). I think it was ok. You do not want another team to play as one other team.
- Game state saving in a certain format
- Logging
