export const state = {
    bracket: [],
    currentRound: 0,
    currentMatch: 0,
    tourneyWinner: null,
    gameState: 'BRACKET',
    autoStartTimer: null,
    ball1: null,
    ball2: null,
    projectiles: [],
    particles: [],
    floatingTexts: [],
    hazards: [],
    confetti: [],
    pickups: [],
    arenaEffects: [],
    settings: {
        envEnabled: true,
        itemsEnabled: true,
        ultimateEnabled: true,
        envIntensity: 1,
        pickupRate: 1,
        ultimateChargeRate: 1,
        windPushScale: 1,
        strikeDamage: 12,
        pickupPower: 1,
        maxActivePickups: 3
    },
    env: {
        windTimer: 5,
        windAngle: 0,
        windStrength: 0,
        strikeTimer: 8,
        pickupTimer: 6
    }
};
