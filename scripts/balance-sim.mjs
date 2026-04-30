import fs from 'node:fs';
import path from 'node:path';

function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function parseRoster() {
    const file = path.join(process.cwd(), 'js', 'data.js');
    const raw = fs.readFileSync(file, 'utf8');
    const normalized = raw.replace('export const baseBalls =', 'const baseBalls =');
    const baseBalls = new Function(`${normalized}\nreturn baseBalls;`)();
    return baseBalls;
}

const ABILITY = {
    Dash:      { off: 1.07, def: 0.97, ctrl: 1.00, sustain: 0.96 },
    Heavy:     { off: 0.86, def: 1.06, ctrl: 0.87, sustain: 1.05 },
    Vampire:   { off: 1.02, def: 1.03, ctrl: 0.95, sustain: 1.16 },
    Teleport:  { off: 1.08, def: 0.98, ctrl: 1.02, sustain: 0.97 },
    Berserk:   { off: 1.12, def: 0.93, ctrl: 0.96, sustain: 1.02 },
    Shield:    { off: 0.95, def: 1.12, ctrl: 0.92, sustain: 1.15 },
    Poison:    { off: 1.03, def: 1.00, ctrl: 0.98, sustain: 1.04 },
    Missile:   { off: 1.08, def: 0.98, ctrl: 1.12, sustain: 0.98 },
    Trap:      { off: 1.00, def: 1.01, ctrl: 1.08, sustain: 1.00 },
    Laser:     { off: 1.18, def: 0.95, ctrl: 1.15, sustain: 0.95 },
    Grapple:   { off: 1.03, def: 1.01, ctrl: 1.07, sustain: 1.00 },
    Phase:     { off: 1.03, def: 1.05, ctrl: 1.01, sustain: 1.03 },
    Pulse:     { off: 0.99, def: 1.06, ctrl: 1.06, sustain: 1.02 },
    Minion:    { off: 1.05, def: 1.00, ctrl: 1.13, sustain: 0.99 },
    Reflect:   { off: 0.98, def: 1.11, ctrl: 0.97, sustain: 1.07 },
    Charge:    { off: 1.09, def: 0.98, ctrl: 0.98, sustain: 1.00 },
    Boomerang: { off: 1.04, def: 1.03, ctrl: 1.05, sustain: 1.03 },
    Brand:     { off: 1.12, def: 0.99, ctrl: 1.06, sustain: 1.06 },
    Scythe:    { off: 1.12, def: 0.99, ctrl: 0.98, sustain: 1.08 },
    'Last Stand': { off: 1.12, def: 1.00, ctrl: 0.95, sustain: 1.08 },
    Soulbound: { off: 1.07, def: 0.98, ctrl: 1.06, sustain: 0.98 },
    Windblade: { off: 1.05, def: 0.99, ctrl: 1.10, sustain: 0.97 },
    Bloodhunt: { off: 1.08, def: 1.01, ctrl: 1.02, sustain: 1.12 },
    Headshot:  { off: 1.55, def: 0.93, ctrl: 1.18, sustain: 0.94 },
    Gauntlet:  { off: 1.07, def: 1.04, ctrl: 0.99, sustain: 1.00 },
    Regen:     { off: 0.96, def: 1.11, ctrl: 0.94, sustain: 1.18 },
    Fishbones: { off: 1.45, def: 0.94, ctrl: 1.12, sustain: 0.95 },
    Ravenous:  { off: 1.08, def: 1.03, ctrl: 1.01, sustain: 1.20 },
    Haymaker:  { off: 1.07, def: 1.08, ctrl: 0.96, sustain: 1.05 }
};

function matchupMultiplier(a, b) {
    let mult = 1;

    if (a.ability === 'Brand' && b.hp >= 120) mult += 0.06;
    if (a.ability === 'Poison' && (b.ability === 'Vampire' || b.ability === 'Shield')) mult += 0.05;
    if (a.ability === 'Reflect' && (b.ability === 'Vampire' || b.ability === 'Charge' || b.ability === 'Dash')) mult += 0.07;
    if (a.ability === 'Pulse' && (b.ability === 'Grapple' || b.ability === 'Berserk')) mult += 0.05;
    if (a.ability === 'Phase' && (b.ability === 'Laser' || b.ability === 'Missile')) mult += 0.06;
    if (a.ability === 'Heavy' && (b.ability === 'Laser' || b.ability === 'Missile')) mult -= 0.03;
    if (a.ability === 'Last Stand' && b.damage <= 8) mult += 0.04;
    if (a.ability === 'Boomerang' && b.speed >= 4.5) mult -= 0.03;
    if (a.ability === 'Headshot' && b.speed <= 3.2) mult += 0.04;
    if (a.ability === 'Bloodhunt' && b.hp <= 105) mult += 0.04;
    if (a.ability === 'Windblade' && (b.ability === 'Gauntlet' || b.ability === 'Haymaker')) mult += 0.03;
    if (a.ability === 'Haymaker' && b.damage >= 11) mult += 0.04;
    if (a.ability === 'Regen' && (b.ability === 'Brand' || b.ability === 'Headshot')) mult -= 0.04;
    if (a.ability === 'Ravenous' && (b.ability === 'Vampire' || b.ability === 'Regen')) mult += 0.03;
    if (a.ability === 'Fishbones' && b.mass >= 1.5) mult += 0.03;

    return Math.max(0.85, Math.min(1.15, mult));
}

function fighterPower(f) {
    const mod = ABILITY[f.ability] || { off: 1, def: 1, ctrl: 1, sustain: 1 };
    const offense = (f.damage * 2.8 + f.speed * 2.25 - f.mass * 0.9 - f.r * 0.03) * mod.off;
    const defense = (f.hp * 0.17 + f.mass * 5.3 + f.r * 0.16) * mod.def;
    const control = (f.speed * 0.8 + f.r * 0.045) * mod.ctrl;
    const sustain = (f.hp * 0.08) * mod.sustain;
    return { offense: Math.max(1, offense), defense, control, sustain };
}

function simulateMatch(a, b, rand) {
    const ap = fighterPower(a);
    const bp = fighterPower(b);

    const aPressure = (ap.offense + ap.control * 4.4) * matchupMultiplier(a, b);
    const bPressure = (bp.offense + bp.control * 4.4) * matchupMultiplier(b, a);

    const aStaying = ap.defense + ap.sustain * 2.4;
    const bStaying = bp.defense + bp.sustain * 2.4;

    const aScore = (aPressure * 0.62 + aStaying * 0.38) * (0.92 + rand() * 0.16);
    const bScore = (bPressure * 0.62 + bStaying * 0.38) * (0.92 + rand() * 0.16);

    if (aScore === bScore) return rand() > 0.5 ? a : b;
    return aScore > bScore ? a : b;
}

function runTournament(roster, rand) {
    let bracket = shuffle([...roster], rand);
    const matchWins = new Map();

    for (const f of roster) matchWins.set(f.name, 0);

    while (bracket.length > 1) {
        const next = [];
        for (let i = 0; i < bracket.length; i += 2) {
            const p1 = bracket[i];
            const p2 = bracket[i + 1];
            if (!p2) {
                next.push(p1);
                continue;
            }
            const winner = simulateMatch(p1, p2, rand);
            matchWins.set(winner.name, matchWins.get(winner.name) + 1);
            next.push(winner);
        }
        bracket = next;
    }

    return { champion: bracket[0].name, matchWins };
}

function main() {
    const tournaments = Number.parseInt(process.argv[2] || '100', 10);
    const seed = Number.parseInt(process.argv[3] || '42', 10);
    if (!Number.isFinite(tournaments) || tournaments < 1) {
        console.error('Usage: node scripts/balance-sim.mjs [tournaments>=1] [seed]');
        process.exit(1);
    }

    const rand = mulberry32(seed);
    const roster = parseRoster();

    const champions = new Map();
    const wins = new Map();
    const losses = new Map();
    for (const f of roster) {
        champions.set(f.name, 0);
        wins.set(f.name, 0);
        losses.set(f.name, 0);
    }

    for (let i = 0; i < tournaments; i++) {
        const result = runTournament(roster, rand);
        champions.set(result.champion, champions.get(result.champion) + 1);
        for (const [name, w] of result.matchWins.entries()) {
            wins.set(name, wins.get(name) + w);
        }
        const matchesPerTournament = Math.ceil(Math.log2(roster.length));
        for (const f of roster) {
            const wasChampion = f.name === result.champion;
            losses.set(f.name, losses.get(f.name) + (wasChampion ? matchesPerTournament - result.matchWins.get(f.name) : 1));
        }
    }

    const rows = roster
        .map(f => {
            const champCount = champions.get(f.name);
            const totalWins = wins.get(f.name);
            const totalLosses = losses.get(f.name);
            return {
                fighter: f.name,
                ability: f.ability,
                champRate: `${((champCount / tournaments) * 100).toFixed(1)}%`,
                matchWinRate: `${((totalWins / Math.max(1, totalWins + totalLosses)) * 100).toFixed(1)}%`,
                champions: champCount,
                matchWins: totalWins
            };
        })
        .sort((a, b) => b.champions - a.champions || b.matchWins - a.matchWins);

    console.log(`Balance sim complete: ${tournaments} tournaments, seed ${seed}`);
    console.table(rows);

    const top = rows.slice(0, 3).map(r => `${r.fighter} (${r.champRate})`).join(', ');
    const bottom = rows.slice(-3).map(r => `${r.fighter} (${r.champRate})`).join(', ');
    console.log(`Top 3 champ rates: ${top}`);
    console.log(`Bottom 3 champ rates: ${bottom}`);
    console.log('Note: this is a fast statistical harness, not a full physics replay.');
}

main();
