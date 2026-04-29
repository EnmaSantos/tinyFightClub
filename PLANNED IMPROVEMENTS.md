# Tiny Fight Club — Improvement Ideas

## High Impact

1. **Match timer / Sudden Death** — Matches can go indefinitely if two tanky balls (Titan, Thorn) get stuck in a loop. A 60-second countdown that shrinks the arena or deals escalating damage to both balls would force resolution cleanly.

2. **Speed multiplier button** — A 1x / 2x / 4x toggle on the arena overlay. `fpsInterval` already drives the loop, so this is a small change with big UX payoff.

3. ~~**HiDPI canvas scaling**~~ ✅ — Implemented via `devicePixelRatio` in `resizeCanvas()` and a `resize` event listener.

4. **Arena obstacles** — A few static circular pillars in the arena would break up open-field fights and create more interesting AI pathing. Better fix for stalemates than the current random-jitter failsafe.

## Medium Impact

5. **Particle object pool** — `new Particle()` is called hundreds of times per second; GC pressure will cause stutters over long sessions. Pre-allocate a fixed array and recycle dead particles.

6. **Bracket round connectors** — The bracket has no lines connecting matches to their successors. Drawing connector lines would make the bracket much easier to read.

7. **Ability cooldown arc** — A small arc drawn around each ball showing cooldown progress would give viewers context for passive behavior (e.g. Ninja waiting to teleport).

8. **Poison/status visual tint** — A persistent green tint or particle trail on a ball while `this.poisoned > 0` would make status effects readable beyond the fading floating text.

## Polish

9. **Berserk rage visual** — Zerk looks identical at 100% and 5% HP. A pulsing red glow or growing spike effect scaled to `(1 - hpRatio)` would make the mechanic feel dangerous.

10. **Winner celebration** — The current win animation just glides the ball to center. A "WINNER!" floating text, confetti particles in the winner's color, and a zoom effect would make it feel like a real event.

11. ~~**`performance.now()` instead of `Date.now()`**~~ ✅ — Already applied during project restructure.
