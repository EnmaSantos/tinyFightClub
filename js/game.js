import { state } from './state.js';
import { baseBalls } from './data.js';
import { Ball } from './entities.js';
import { resolveCollision } from './systems.js';
import { createParticles, createConfetti } from './fx.js';
import { emitter } from './events.js';
import { normalizeAngle } from './utils.js';
import {
    drawBall, drawHazard, drawProjectile,
    drawParticle, drawFloatingText,
    drawGrappleLine, drawArenaBorder, drawConfetti
} from './renderer.js';
// ui.js: imported for side-effects (event subscriptions) + direct overlay/render calls
import { showOverlay, hideOverlay, renderBracket, renderRoster } from './ui.js';

// Record each match result to the backend — fire-and-forget, never throws.
emitter.on('match:end', async ({ winner, loser, round, duration }) => {
    try {
        await fetch('/api/record-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                winnerName:    winner.name,
                loserName:     loser.name,
                winnerAbility: winner.ability,
                loserAbility:  loser.ability,
                round,
                duration
            })
        });
    } catch { /* network failure — game continues unaffected */ }
});

// Canvas and rendering context live here — not in shared game state.
let canvas, ctx;

const VIRTUAL_W = 1056;
const VIRTUAL_H = 1080;

function resizeCanvas() {
    const container = document.getElementById('arena-container');
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = container.clientWidth  * dpr;
    canvas.height = container.clientHeight * dpr;
}

function getViewport() {
    const scale   = Math.min(canvas.width / VIRTUAL_W, canvas.height / VIRTUAL_H);
    const offsetX = (canvas.width  - VIRTUAL_W * scale) / 2;
    const offsetY = (canvas.height - VIRTUAL_H * scale) / 2;
    return { scale, offsetX, offsetY };
}

function createEmptyMatch() {
    return { p1: null, p2: null, winner: null };
}

function createBracket(roster) {
    const bracket = [];
    let roundSize = Math.max(1, Math.ceil(roster.length / 2));

    bracket.push(Array.from({ length: roundSize }, (_, i) => ({
        p1: roster[i * 2] ?? null,
        p2: roster[i * 2 + 1] ?? null,
        winner: null
    })));

    while (roundSize > 1) {
        roundSize = Math.ceil(roundSize / 2);
        bracket.push(Array.from({ length: roundSize }, createEmptyMatch));
    }

    return bracket;
}

function getRoundName(roundIndex, firstRoundSize = state.bracket[0]?.length ?? 0) {
    const matchesInRound = state.bracket[roundIndex]?.length ?? 0;
    const fighterCount = matchesInRound * 2;

    if (matchesInRound === 1) return 'Final';
    if (matchesInRound === 2) return 'Semifinals';
    if (matchesInRound === 4) return 'Quarterfinals';
    if (roundIndex === 0) return `Round of ${Math.max(fighterCount, firstRoundSize * 2)}`;
    return `Round ${roundIndex + 1}`;
}

function advanceByeMatches() {
    while (!state.tourneyWinner && state.currentRound < state.bracket.length) {
        const roundMatches = state.bracket[state.currentRound];
        if (!roundMatches || state.currentMatch >= roundMatches.length) break;

        const match = roundMatches[state.currentMatch];
        const winner = match.p1 ?? match.p2;
        const loser = match.p1 && match.p2 ? null : null;

        if (match.p1 && match.p2) break;
        if (!winner) {
            state.currentMatch++;
        } else {
            endMatch(winner, loser, 0, true);
        }
    }
}

function initTournament() {
    const roster = baseBalls.map(base => {
        const hpVar    = 0.9 + Math.random() * 0.2;
        const speedVar = 0.9 + Math.random() * 0.2;
        const dmgVar   = 0.9 + Math.random() * 0.2;
        return {
            ...base,
            hp:     Math.floor(base.hp    * hpVar),
            maxHp:  Math.floor(base.maxHp * hpVar),
            speed:  parseFloat((base.speed * speedVar).toFixed(1)),
            damage: Math.floor(base.damage * dmgVar)
        };
    }).sort(() => Math.random() - 0.5);

    state.bracket = createBracket(roster);

    state.currentRound  = 0;
    state.currentMatch  = 0;
    state.tourneyWinner = null;
    state.gameState     = 'BRACKET';

    advanceByeMatches();
    renderBracket();
    renderRoster();
    showOverlay('Tiny Fight Club', `${roster.length} fighters enter. Only one survives.`, 'Start Tournament', startNextMatch);
}

function startNextMatch() {
    if (state.autoStartTimer) clearTimeout(state.autoStartTimer);

    const match = state.bracket[state.currentRound][state.currentMatch];
    state.ball1 = new Ball(match.p1);
    state.ball2 = new Ball(match.p2);

    const margin = 120;
    const halfW  = VIRTUAL_W / 2;

    state.ball1.x     = margin + Math.random() * (halfW - margin * 2);
    state.ball1.y     = margin + Math.random() * (VIRTUAL_H - margin * 2);
    state.ball1.angle = Math.random() * Math.PI * 2;
    state.ball1.vx    = (Math.random() - 0.5) * 12;
    state.ball1.vy    = (Math.random() - 0.5) * 12;

    state.ball2.x     = halfW + margin + Math.random() * (halfW - margin * 2);
    state.ball2.y     = margin + Math.random() * (VIRTUAL_H - margin * 2);
    state.ball2.angle = Math.random() * Math.PI * 2;
    state.ball2.vx    = (Math.random() - 0.5) * 12;
    state.ball2.vy    = (Math.random() - 0.5) * 12;

    state.projectiles   = [];
    state.particles     = [];
    state.floatingTexts = [];
    state.hazards       = [];
    state.confetti      = [];
    state.gameState     = 'FIGHTING';
    state.matchStartTime = performance.now();

    hideOverlay();
    emitter.emit('match:start', {
        ball1: state.ball1,
        ball2: state.ball2,
        round: state.currentRound,
        matchIndex: state.currentMatch
    });
}

function endMatch(winnerDef, loserDef, duration, skipEvent = false) {
    state.bracket[state.currentRound][state.currentMatch].winner = winnerDef;

    const round      = state.currentRound;
    const matchIndex = state.currentMatch;

    if (state.currentRound < state.bracket.length - 1) {
        const nextIdx = Math.floor(state.currentMatch / 2);
        const isP1    = state.currentMatch % 2 === 0;
        if (isP1) state.bracket[state.currentRound + 1][nextIdx].p1 = winnerDef;
        else      state.bracket[state.currentRound + 1][nextIdx].p2 = winnerDef;
    } else {
        state.tourneyWinner = winnerDef;
    }

    state.currentMatch++;
    if (state.currentMatch >= state.bracket[state.currentRound].length) {
        state.currentRound++;
        state.currentMatch = 0;
    }

    state.gameState = 'BRACKET';

    // Emit for subscribers (API recording, stats, etc.)
    if (!skipEvent && loserDef) {
        emitter.emit('match:end', { winner: winnerDef, loser: loserDef, round, matchIndex, duration });
    }

    if (state.tourneyWinner) {
        emitter.emit('tournament:end', { champion: state.tourneyWinner });
        showOverlay(`${state.tourneyWinner.name} Wins!`, 'The ultimate champion has been crowned.', 'Play Again', initTournament, state.tourneyWinner.color);
        return;
    }

    advanceByeMatches();
    if (state.tourneyWinner) {
        emitter.emit('tournament:end', { champion: state.tourneyWinner });
        showOverlay(`${state.tourneyWinner.name} Wins!`, 'The ultimate champion has been crowned.', 'Play Again', initTournament, state.tourneyWinner.color);
        return;
    }

    const match  = state.bracket[state.currentRound][state.currentMatch];
    showOverlay(
        `Next: ${getRoundName(state.currentRound)}`,
        `${match.p1.name} vs ${match.p2.name} (Auto-starting in 5s...)`,
        'Start Now',
        () => { if (state.autoStartTimer) clearTimeout(state.autoStartTimer); startNextMatch(); }
    );

    state.autoStartTimer = setTimeout(() => {
        if (state.gameState === 'BRACKET') startNextMatch();
    }, 5000);
}

// --- MAIN LOOP ---
// Delta-time loop: no FPS cap, dt in seconds capped at 50ms to prevent spiral.

let then;
let winAnimTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const dt = Math.min((timestamp - then) / 1000, 0.05);
    then = timestamp;

    // Keep backing store in sync with container + DPR
    const container = document.getElementById('arena-container');
    const dpr = window.devicePixelRatio || 1;
    const expectedW = container.clientWidth  * dpr;
    const expectedH = container.clientHeight * dpr;
    if (canvas.width !== expectedW || canvas.height !== expectedH) resizeCanvas();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { scale, offsetX, offsetY } = getViewport();

    if (state.gameState === 'FIGHTING') {
        // Update
        state.ball1.update(state.ball2, VIRTUAL_W, VIRTUAL_H, dt);
        state.ball2.update(state.ball1, VIRTUAL_W, VIRTUAL_H, dt);
        resolveCollision(state.ball1, state.ball2);

        state.projectiles.forEach(p => p.update(dt));
        state.particles.forEach(p => p.update(dt));
        state.floatingTexts.forEach(ft => ft.update(dt));
        state.hazards.forEach(h => h.update(h.source === state.ball1 ? state.ball2 : state.ball1, dt));

        state.projectiles   = state.projectiles.filter(p => p.active);
        state.particles     = state.particles.filter(p => p.life > 0);
        state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);
        state.hazards       = state.hazards.filter(h => h.active);

        // Draw
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.rect(0, 0, VIRTUAL_W, VIRTUAL_H);
        ctx.clip();

        state.hazards.forEach(h => drawHazard(ctx, h));

        if (state.ball1.grappling > 0 && state.ball2.intangible <= 0) drawGrappleLine(ctx, state.ball1, state.ball2);
        if (state.ball2.grappling > 0 && state.ball1.intangible <= 0) drawGrappleLine(ctx, state.ball2, state.ball1);

        state.projectiles.forEach(p => drawProjectile(ctx, p));
        state.particles.forEach(p => drawParticle(ctx, p));
        drawBall(ctx, state.ball1);
        drawBall(ctx, state.ball2);
        state.floatingTexts.forEach(ft => drawFloatingText(ctx, ft));

        drawArenaBorder(ctx, VIRTUAL_W, VIRTUAL_H);
        ctx.restore();

        // Win condition
        if (state.ball1.hp <= 0 || state.ball2.hp <= 0) {
            let winner, loser;

            if (state.ball1.hp > 0) {
                winner = state.ball1; loser = state.ball2;
            } else if (state.ball2.hp > 0) {
                winner = state.ball2; loser = state.ball1;
            } else {
                if (state.ball1.hp > state.ball2.hp)      { winner = state.ball1; loser = state.ball2; }
                else if (state.ball2.hp > state.ball1.hp) { winner = state.ball2; loser = state.ball1; }
                else {
                    winner = Math.random() > 0.5 ? state.ball1 : state.ball2;
                    loser  = winner === state.ball1 ? state.ball2 : state.ball1;
                }
                winner.hp = 1;
            }

            createParticles(loser.x, loser.y, loser.color, 80, 8, 5);
            createParticles(loser.x, loser.y, '#ffffff', 20, 10, 2);

            winner.flash = 0;
            loser.flash  = 0;
            winAnimTime  = 0;
            createConfetti(200, VIRTUAL_W);
            state.gameState = 'ANIMATING_WIN';
            const duration = (performance.now() - state.matchStartTime) / 1000;
            setTimeout(() => endMatch(winner.def, loser.def, duration), 3500);
        }

    } else if (state.gameState === 'ANIMATING_WIN') {
        winAnimTime += dt;
        const winner = state.ball1.hp > 0 ? state.ball1 : state.ball2;

        winner.vx += (VIRTUAL_W / 2 - winner.x) * 0.001 * dt * 60;
        winner.vy += (VIRTUAL_H / 2 - winner.y) * 0.001 * dt * 60;
        winner.vx *= Math.pow(0.95, dt * 60);
        winner.vy *= Math.pow(0.95, dt * 60);
        winner.x  += winner.vx * dt * 60;
        winner.y  += winner.vy * dt * 60;

        const angleDiff = normalizeAngle(0 - winner.angle);
        if (Math.abs(angleDiff) > 0.05) {
            winner.angle += (angleDiff > 0 ? 0.05 : -0.05) * dt * 60;
        }

        state.confetti.forEach(c => c.update(dt));
        state.particles.forEach(p => p.update(dt));
        state.floatingTexts.forEach(ft => ft.update(dt));
        state.confetti      = state.confetti.filter(c => c.life > 0);
        state.particles     = state.particles.filter(p => p.life > 0);
        state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.beginPath();
        ctx.rect(0, 0, VIRTUAL_W, VIRTUAL_H);
        ctx.clip();

        state.confetti.forEach(c => drawConfetti(ctx, c));
        state.particles.forEach(p => drawParticle(ctx, p));
        drawBall(ctx, winner);
        state.floatingTexts.forEach(ft => drawFloatingText(ctx, ft));

        // Splash text: scale in with slight overshoot
        const t = Math.min(1, winAnimTime / 0.45);
        const textScale = t < 0.75 ? (t / 0.75) * 1.18 : 1.18 - ((t - 0.75) / 0.25) * 0.18;
        ctx.save();
        ctx.translate(VIRTUAL_W / 2, VIRTUAL_H / 2 - 80);
        ctx.scale(textScale, textScale);
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = 'bold 90px "Segoe UI", sans-serif';
        ctx.lineWidth    = 14;
        ctx.strokeStyle  = '#020617';
        ctx.strokeText(`${winner.name} Wins!`, 0, 0);
        ctx.fillStyle    = winner.color;
        ctx.fillText(`${winner.name} Wins!`, 0, 0);
        ctx.restore();

        drawArenaBorder(ctx, VIRTUAL_W, VIRTUAL_H);
        ctx.restore();
    }
}

window.onload = () => {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initTournament();
    then = performance.now();
    requestAnimationFrame(gameLoop);
};
