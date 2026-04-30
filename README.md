# Tiny Fight Club

A browser-based 2D tournament simulator where AI-controlled ball fighters compete in a single-elimination bracket. Sit back and watch — there's no player input during fights.

**[Play it live →](https://tiny-fight-club.vercel.app)**

## Fighters

29 unique fighters, each with a distinct ability:

| Fighter | Ability | Playstyle |
|---------|---------|-----------|
| Dash | Dash | High speed, dashes forward to strike |
| Titan | Heavy | Massive, high HP, turns slowly |
| Dracula | Vampire | Heals 50% of damage dealt by its weapon |
| Ninja | Teleport | Periodically teleports behind the opponent |
| Zerk | Berserk | Damage and speed massively increase as HP drops |
| Paladin | Shield | Periodically regenerates a protective shield |
| Venom | Poison | Frontal strikes apply dangerous Damage-Over-Time |
| Mage | Missile | Stays away and fires homing magic missiles |
| Spike | Trap | Leaves volatile traps behind |
| Sniper | Laser | Fires fast, non-homing piercing shots |
| Hook | Grapple | Violently pulls the enemy towards itself |
| Ghost | Phase | Periodically becomes intangible to attacks |
| Pulsar | Pulse | Emits a repelling, damaging energy shockwave |
| Swarm | Minion | Spawns small homing drones to harass |
| Thorn | Reflect | Reflects 40% of taken damage back to attacker |
| Comet | Charge | Builds massive momentum in a straight line |
| Razor | Boomerang | Curved blade can hit on the throw and return |
| Malik | Brand | Black flame hits permanently reduce enemy max HP |
| Enma | Scythe | Wide melee hits steal max HP |
| Vanta | Last Stand | Lower HP increases damage and damage reduction |
| Yone | Soulbound | Dashes through enemies with a delayed spirit slash |
| Yasuo | Windblade | Throws cutting wind and circles at mid range |
| Warwick | Bloodhunt | Hunts wounded opponents with speed and healing |
| Caitlyn | Headshot | Keeps distance and fires precision shots |
| Vi | Gauntlet | Charges in with heavy knockback punches |
| Dr Mundo | Regen | Regenerates and throws heavy cleavers |
| Jinx | Fishbones | Fires unstable rocket salvos |
| Swain | Ravenous | Drains nearby enemies and sends ravens |
| Sett | Haymaker | Stores damage as grit, then releases a punch |

## Running Locally

No build step required. Serve `index.html` via a local HTTP server — direct `file://` loading will fail due to ES module CORS restrictions.

```bash
# Option 1: Node http-server
npx http-server .

# Option 2: Python
python -m http.server

# Option 3: VS Code Live Server extension
```

### With API (leaderboard/history)

The `/api/*` endpoints use Vercel KV. To test them locally:

```bash
npm install
npx vercel dev
```

You'll need `KV_REST_API_URL` and `KV_REST_API_TOKEN` set in your environment. The game runs fine without them — API calls are fire-and-forget.

## Architecture

Vanilla JS + Canvas, no framework. Hybrid ECS-adjacent + event-driven pattern.

```
game.js (requestAnimationFrame loop)
  ├── entities.js  — Ball.update(): AI decision tree + physics per frame
  ├── systems.js   — resolveCollision(): impact, damage, special interactions
  ├── renderer.js  — Stateless draw functions
  │
  └── On match events, emits via events.js:
        ├── fx.js      → particles, floating damage text
        ├── ui.js      → bracket DOM, overlays, leaderboard
        └── game.js    → POST /api/record-match (fire-and-forget)
```

### Key Files

| File | Responsibility |
|------|----------------|
| `js/game.js` | Main loop, tournament state machine, canvas/HiDPI setup |
| `js/state.js` | Central singleton: bracket, active entities, game phase |
| `js/entities.js` | `Ball` class — physics, HP, cooldowns, all AI + 29 ability implementations |
| `js/systems.js` | `resolveCollision()` — elastic collision math, weapon hit detection, damage |
| `js/renderer.js` | Pure canvas draw functions (no state mutation) |
| `js/ui.js` | DOM: bracket visualization, roster, leaderboard, overlay modal |
| `js/fx.js` | Particle system, floating damage text |
| `js/events.js` | Tiny `EventEmitter` singleton (`gameEvents`) |
| `js/data.js` | 29 fighter stat/ability definitions |
| `api/*.js` | Vercel serverless: record-match, leaderboard, history |

### Game State Machine

`state.gameState` cycles: `BRACKET → FIGHTING → ANIMATING_WIN → BRACKET → ...`

Dynamic single-elimination rounds with byes as needed until one champion remains.

## Deployment

Deployed on Vercel. Push to `main` triggers a deploy. The static files are served as-is; `api/` functions run as Vercel serverless functions.
