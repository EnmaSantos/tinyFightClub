import { state } from './state.js';
import { normalizeAngle } from './utils.js';
import { emitter } from './events.js';

// Pure simulation — no canvas, no DOM, no direct FX calls.
// Visual effects are triggered by emitting events; fx.js subscribes.

export class Ball {
    constructor(def) {
        this.def = def;
        this.name = def.name;
        this.color = def.color;
        this.ability = def.ability;
        this.maxHp = def.maxHp;
        this.hp = def.hp;
        this.naturalMaxHp = def.maxHp;
        this.maxHpLost = 0;
        this.maxHpGain = 0;
        this.r = def.r;
        this.mass = def.mass;
        this.speed = def.speed;
        this.baseDamage = def.damage;

        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.angle = 0;

        // All timers in seconds
        this.abilityCooldown = 1.0;
        this.hitCooldown     = 0;
        this.poisoned        = 0;
        this.shield          = 0;
        this.flash           = 0;

        this.intangible  = 0;
        this.grappling   = 0;
        this.charging    = 0;
        this.pulseVisual = 0;
        this.momentumArmor = 0;
        this.momentumArmorDuration = 1;
        this.scytheVisual = 0;
        this.damageBuff = 0;
        this.haste = 0;
        this.fortify = 0;
        this.damageBuffMult = 1;
        this.hasteMult = 1;
        this.fortifyMult = 1;
        this.ultimateCharge = 0;
        this.ultimateCooldown = 0;
        this.ultimateWindup = 0;
        this.ultimateFxTimer = 0;
        this.ultimateFxColor = this.color;
        this.ultimateFxStyle = 'ring';
        this.grit = 0;
        this.windWall = 0;
        this.bloodFrenzy = 0;
        this.punchVisual = 0;
        this.slashVisual = 0;
        this.regenTickTimer = 0;

        this.behaviorState = 'AGGRESSIVE';
        this.behaviorTimer = 0;
        this.flankDir      = 1;

        this.lastBehaviorState = 'AGGRESSIVE';
        this.stateTime         = 0;

        this.poisonTickTimer = 0;
    }

    getLastStandScale() {
        const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
        if (hpRatio >= 0.5) {
            const t = (1 - hpRatio) / 0.5;
            return { damageBonus: t * 0.25, reduction: t * 0.15 };
        }
        if (hpRatio >= 0.25) {
            const t = (0.5 - hpRatio) / 0.25;
            return { damageBonus: 0.25 + t * 0.25, reduction: 0.15 + t * 0.15 };
        }
        const t = Math.min(1, (0.25 - hpRatio) / 0.15);
        return { damageBonus: 0.5 + t * 0.25, reduction: 0.3 + t * 0.1 };
    }

    getLastStandDamageMultiplier() {
        return 1 + this.getLastStandScale().damageBonus;
    }

    getDamageOutputMultiplier() {
        return this.damageBuffMult * (this.ultimateWindup > 0 ? 1.25 : 1);
    }

    scaleDamage(amount) {
        return amount * this.getDamageOutputMultiplier();
    }

    getDamageReduction() {
        let reduction = 0;
        if (this.ability === 'Last Stand') reduction += this.getLastStandScale().reduction;
        if (this.momentumArmor > 0) {
            reduction += 0.3 * Math.max(0, this.momentumArmor / this.momentumArmorDuration);
        }
        return Math.min(0.65, reduction);
    }

    applyMaxHpReduction(amount, maxLossRatio = 0.45) {
        const maxLoss = this.naturalMaxHp * maxLossRatio;
        const availableLoss = Math.max(0, maxLoss - this.maxHpLost);
        const loss = Math.min(amount, availableLoss, Math.max(0, this.maxHp - 1));
        if (loss <= 0) return 0;

        this.maxHp -= loss;
        this.maxHpLost += loss;
        this.hp = Math.min(this.hp, this.maxHp);
        return loss;
    }

    gainMaxHp(amount, maxGainRatio = 0.4) {
        const maxGain = this.naturalMaxHp * maxGainRatio;
        const gain = Math.min(amount, Math.max(0, maxGain - this.maxHpGain));
        if (gain <= 0) return 0;

        this.maxHp += gain;
        this.maxHpGain += gain;
        this.hp = Math.min(this.maxHp, this.hp + gain * 0.5);
        return gain;
    }

    addUltimateCharge(amount) {
        this.ultimateCharge = Math.min(100, this.ultimateCharge + amount);
    }

    triggerUltimateFx(style, color = this.color, duration = 1.2) {
        this.ultimateFxStyle = style;
        this.ultimateFxColor = color;
        this.ultimateFxTimer = duration;
    }

    applyPickup(type, enemy = null) {
        const power = state.settings.pickupPower;
        if (type === 'damage') {
            this.damageBuff = 6.5 + power * 1.5;
            this.damageBuffMult = 1.25 + power * 0.12;
            emitter.emit('fx:text', { text: 'DAMAGE UP', x: this.x, y: this.y - this.r - 45, color: '#f97316' });
        } else if (type === 'haste') {
            this.haste = 6.5 + power * 1.5;
            this.hasteMult = 1.2 + power * 0.1;
            emitter.emit('fx:text', { text: 'HASTE', x: this.x, y: this.y - this.r - 45, color: '#22d3ee' });
        } else if (type === 'fortify') {
            this.fortify = 6.5 + power * 1.5;
            this.fortifyMult = Math.max(0.55, 0.8 - power * 0.08);
            emitter.emit('fx:text', { text: 'FORTIFY', x: this.x, y: this.y - this.r - 45, color: '#3b82f6' });
        } else if (type === 'heal') {
            const heal = this.maxHp * (0.22 + power * 0.08);
            this.hp = Math.min(this.maxHp, this.hp + heal);
            emitter.emit('fx:text', { text: 'MEGA HEAL', x: this.x, y: this.y - this.r - 45, color: '#10b981' });
        } else if (type === 'rocket') {
            this.ultimateCharge = Math.min(100, this.ultimateCharge + 20);
            emitter.emit('fx:text', { text: 'ROCKET', x: this.x, y: this.y - this.r - 45, color: '#f59e0b' });
            if (enemy) {
                const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                const px = this.x + Math.cos(angle) * (this.r + 14);
                const py = this.y + Math.sin(angle) * (this.r + 14);
                const rocket = new Projectile(px, py, enemy, this, angle, false, 20, 20 + power * 6);
                rocket.effect = 'rocket';
                rocket.life = 1.8;
                rocket.r = 9;
                rocket.vx = Math.cos(angle) * rocket.speed;
                rocket.vy = Math.sin(angle) * rocket.speed;
                state.projectiles.push(rocket);
            }
        }
    }

    tryUltimate(enemy, width, height, dist, dx, dy) {
        if (!state.settings.ultimateEnabled || this.ultimateCharge < 100 || this.ultimateCooldown > 0 || this.ultimateWindup > 0) return;

        this.ultimateCharge = 0;
        this.ultimateCooldown = 12;
        this.ultimateWindup = 0.75;
        emitter.emit('ability:used', { ball: this, ability: 'ULTIMATE', x: this.x, y: this.y });

        const ability = this.ability;
        if (ability === 'Heavy' || ability === 'Gauntlet' || ability === 'Haymaker') {
            this.triggerUltimateFx('shock', '#94a3b8', 1.3);
            this.fortify = 5;
            this.fortifyMult = 0.6;
            const burst = ability === 'Haymaker' ? 20 + Math.min(30, this.grit) : 22;
            enemy.takeDamage(this.scaleDamage(burst), this);
            enemy.vx += (dx / Math.max(1, dist)) * 28;
            enemy.vy += (dy / Math.max(1, dist)) * 28;
            this.grit = 0;
            emitter.emit('fx:text', { text: ability === 'Heavy' ? 'COLOSSUS IMPACT' : 'HAYMAKER', x: this.x, y: this.y - this.r - 45, color: '#94a3b8' });
        } else if (ability === 'Missile' || ability === 'Laser' || ability === 'Brand' || ability === 'Headshot' || ability === 'Fishbones') {
            this.triggerUltimateFx('nova', ability === 'Brand' ? '#111827' : '#a855f7', 1.3);
            for (let i = -2; i <= 2; i++) {
                const a = this.angle + i * 0.16;
                const px = this.x + Math.cos(a) * (this.r + 10);
                const py = this.y + Math.sin(a) * (this.r + 10);
                const p = new Projectile(px, py, enemy, this, a, true, 10, this.scaleDamage(9));
                p.effect = ability === 'Brand' ? 'brand' : null;
                if (ability === 'Fishbones') p.effect = 'rocket';
                if (ability === 'Headshot') p.effect = 'headshot';
                state.projectiles.push(p);
            }
            emitter.emit('fx:text', { text: 'BARRAGE', x: this.x, y: this.y - this.r - 45, color: this.color });
        } else if (ability === 'Soulbound' || ability === 'Windblade') {
            this.triggerUltimateFx('nova', ability === 'Windblade' ? '#60a5fa' : '#f8fafc', 1.35);
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const px = this.x + Math.cos(a) * (this.r + 10);
                const py = this.y + Math.sin(a) * (this.r + 10);
                const p = new Projectile(px, py, enemy, this, a, false, 15, this.scaleDamage(10));
                p.effect = 'wind';
                p.life = 1.2;
                p.r = 12;
                state.projectiles.push(p);
            }
            this.slashVisual = 0.6;
            emitter.emit('fx:text', { text: 'TEMPEST SLASH', x: this.x, y: this.y - this.r - 45, color: this.color });
        } else if (ability === 'Bloodhunt' || ability === 'Regen' || ability === 'Ravenous') {
            this.triggerUltimateFx('swarm', ability === 'Bloodhunt' ? '#dc2626' : this.color, 1.5);
            enemy.takeDamage(this.scaleDamage(16), this);
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.22);
            this.bloodFrenzy = ability === 'Bloodhunt' ? 4 : this.bloodFrenzy;
            emitter.emit('fx:text', { text: ability === 'Ravenous' ? 'DEMON DRAIN' : 'UNSTOPPABLE', x: this.x, y: this.y - this.r - 45, color: this.color });
        } else if (ability === 'Minion') {
            this.triggerUltimateFx('swarm', '#a3e635', 1.4);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const px = this.x + Math.cos(a) * (this.r + 10);
                const py = this.y + Math.sin(a) * (this.r + 10);
                const p = new Projectile(px, py, enemy, this, a, true, 5.2, this.scaleDamage(4));
                p.isSwarm = true;
                p.life = 6;
                p.r = 6;
                state.projectiles.push(p);
            }
            emitter.emit('fx:text', { text: 'DRONE STORM', x: this.x, y: this.y - this.r - 45, color: '#a3e635' });
        } else if (ability === 'Trap' || ability === 'Pulse' || ability === 'Reflect') {
            this.triggerUltimateFx('lock', this.color, 1.25);
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                state.hazards.push(new Hazard(this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, this));
            }
            enemy.takeDamage(this.scaleDamage(12), this);
            emitter.emit('fx:text', { text: 'ARENA LOCK', x: this.x, y: this.y - this.r - 45, color: this.color });
        } else {
            this.triggerUltimateFx('overdrive', this.color, 1.4);
            this.damageBuff = 5;
            this.damageBuffMult = 1.55;
            this.haste = 5;
            this.hasteMult = 1.35;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15);
            emitter.emit('fx:text', { text: 'OVERDRIVE', x: this.x, y: this.y - this.r - 45, color: this.color });
        }
    }

    takeDamage(amount, source, isReflect = false) {
        if (this.intangible > 0) return;

        const effectiveAmount = Math.max(0, amount * (1 - this.getDamageReduction()) * this.fortifyMult);

        if (this.shield > 0) {
            this.shield -= effectiveAmount;
            if (this.shield < 0) {
                this.hp += this.shield;
                this.shield = 0;
            }
        } else {
            this.hp -= effectiveAmount;
        }

        if (source && source.ability === 'Vampire' && !isReflect && this.hp > 0) {
            const heal = effectiveAmount * 0.5;
            source.hp = Math.min(source.maxHp, source.hp + heal);
            emitter.emit('fx:text', { text: '+HP', x: source.x, y: source.y - source.r - 45, color: '#10b981' });
        }

        if (source && source.ability === 'Bloodhunt' && !isReflect && this.hp > 0) {
            const lowHpBonus = this.hp / this.maxHp < 0.5 ? 0.45 : 0.25;
            source.hp = Math.min(source.maxHp, source.hp + effectiveAmount * lowHpBonus);
            emitter.emit('fx:text', { text: '+BLOOD', x: source.x, y: source.y - source.r - 45, color: '#dc2626' });
        }

        if (this.ability === 'Haymaker' && !isReflect) {
            this.grit = Math.min(36, this.grit + effectiveAmount * 0.65);
        }

        if (this.ability === 'Reflect' && source && !isReflect && this.hp > 0) {
            const reflected = effectiveAmount * 0.4;
            source.takeDamage(reflected, this, true);
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#14b8a6', count: 5, speed: 2 });
        }

        this.flash = 0.083;
        const ultRate = state.settings.ultimateChargeRate;
        if (source) source.addUltimateCharge(Math.max(2, effectiveAmount * 0.15) * ultRate);
        this.addUltimateCharge(Math.max(1, effectiveAmount * 0.08) * ultRate);
        emitter.emit('ball:hit', { defender: this, attacker: source, damage: effectiveAmount, isReflect });
    }

    update(enemy, width, height, dt) {
        const F = dt * 60;

        if (this.abilityCooldown > 0) {
            if (this.ability === 'Shield' && this.shield > 0) {
                // paused
            } else {
                this.abilityCooldown -= dt;
            }
        }
        if (this.hitCooldown > 0) this.hitCooldown  -= dt;
        if (this.intangible  > 0) this.intangible   -= dt;
        if (this.pulseVisual > 0) this.pulseVisual   -= dt;
        if (this.flash       > 0) this.flash         -= dt;
        if (this.momentumArmor > 0) this.momentumArmor -= dt;
        if (this.scytheVisual  > 0) this.scytheVisual  -= dt;
        if (this.ultimateCooldown > 0) this.ultimateCooldown -= dt;
        if (this.ultimateWindup > 0) this.ultimateWindup -= dt;
        if (this.ultimateFxTimer > 0) this.ultimateFxTimer -= dt;
        if (this.windWall > 0) this.windWall -= dt;
        if (this.bloodFrenzy > 0) this.bloodFrenzy -= dt;
        if (this.punchVisual > 0) this.punchVisual -= dt;
        if (this.slashVisual > 0) this.slashVisual -= dt;

        if (this.damageBuff > 0) this.damageBuff -= dt;
        else this.damageBuffMult = 1;
        if (this.haste > 0) this.haste -= dt;
        else this.hasteMult = 1;
        if (this.fortify > 0) this.fortify -= dt;
        else this.fortifyMult = 1;

        this.addUltimateCharge(dt * 2.2 * state.settings.ultimateChargeRate);

        if (this.ability === 'Regen' && this.hp > 0 && this.hp < this.maxHp) {
            this.regenTickTimer += dt;
            if (this.regenTickTimer >= 0.5) {
                this.regenTickTimer -= 0.5;
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.012);
                if (Math.random() < 0.45) {
                    emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#a78bfa', count: 2, speed: 0.8, size: 2 });
                }
            }
        } else {
            this.regenTickTimer = 0;
        }

        if (this.poisoned > 0) {
            this.poisoned        -= dt;
            this.poisonTickTimer += dt;
            if (this.poisonTickTimer >= 0.25) {
                this.poisonTickTimer -= 0.25;
                this.takeDamage(1, null);
                emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#22c55e', count: 2, speed: 1 });
            }
        } else {
            this.poisonTickTimer = 0;
        }

        const dx   = enemy.x - this.x;
        const dy   = enemy.y - this.y;
        const dist = Math.hypot(dx, dy);

        let laserLeadAngle = Math.atan2(dy, dx);
        if (this.ability === 'Laser' && dist > 0) {
            const travelFrames = dist / 15;
            laserLeadAngle = Math.atan2(
                enemy.y + enemy.vy * travelFrames - this.y,
                enemy.x + enemy.vx * travelFrames - this.x
            );
        }

        if (this.grappling > 0 && enemy.intangible <= 0) {
            this.grappling -= dt;
            enemy.vx -= (dx / dist) * 1.2 * F;
            enemy.vy -= (dy / dist) * 1.2 * F;
            emitter.emit('fx:particles', { x: this.x + dx / 2, y: this.y + dy / 2, color: '#8b5cf6', count: 1, speed: 0, size: 2 });
        }

        if (this.charging > 0) {
            this.charging -= dt;
            this.vx += Math.cos(this.angle) * 0.6 * F;
            this.vy += Math.sin(this.angle) * 0.6 * F;
            if (Math.random() < 0.33 * F) emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#fb923c', count: 2, speed: 1, size: 4 });
        }

        if (dist > 0 && this.charging <= 0) {
            if (this.flash > 0.07) this.behaviorTimer = 0;
            if (dist < this.r + enemy.r + 60 && this.behaviorState === 'FLANKING') this.behaviorTimer = 0;

            this.behaviorTimer -= dt;
            if (this.behaviorTimer <= 0) {
                this.behaviorTimer = 0.5 + Math.random() * 0.67;

                const hpRatio      = this.hp / this.maxHp;
                const enemyHpRatio = enemy.hp / enemy.maxHp;
                const abilityReady = this.abilityCooldown <= 0.5;

                if (this.ability === 'Laser' || this.ability === 'Headshot') {
                    this.behaviorState = abilityReady ? 'SNIPING' : ((dist < 350) ? 'RETREATING' : 'FLANKING');
                } else if (this.ability === 'Missile' || this.ability === 'Fishbones') {
                    this.behaviorState = (dist < 350) ? 'RETREATING' : 'FLANKING';
                } else if (this.ability === 'Trap') {
                    this.behaviorState = 'FLANKING';
                } else if (this.ability === 'Minion') {
                    this.behaviorState = (dist < 200) ? 'RETREATING' : 'FLANKING';
                } else if (this.ability === 'Windblade') {
                    this.behaviorState = abilityReady ? (dist < 220 ? 'RETREATING' : 'SNIPING') : 'FLANKING';
                } else if (this.ability === 'Ravenous') {
                    this.behaviorState = dist < 260 ? 'RETREATING' : (abilityReady ? 'SNIPING' : 'FLANKING');
                } else if (this.ability === 'Soulbound' || this.ability === 'Gauntlet' || this.ability === 'Bloodhunt' || this.ability === 'Haymaker') {
                    this.behaviorState = 'AGGRESSIVE';
                } else if (this.ability === 'Regen') {
                    this.behaviorState = hpRatio < 0.35 && dist < 240 ? 'RETREATING' : 'AGGRESSIVE';
                } else if (this.ability === 'Boomerang') {
                    if (abilityReady) {
                        this.behaviorState = dist > 650 ? 'AGGRESSIVE' : (dist < 240 ? 'RETREATING' : 'AGGRESSIVE');
                    } else {
                        this.behaviorState = this.momentumArmor > 0 ? 'FLANKING' : (dist < 420 ? 'RETREATING' : 'FLANKING');
                    }
                } else if (this.ability === 'Brand') {
                    if (abilityReady && dist < 650 && dist > 180) this.behaviorState = 'SNIPING';
                    else this.behaviorState = dist > 650 ? 'AGGRESSIVE' : (dist < 320 ? 'RETREATING' : 'FLANKING');
                } else if (this.ability === 'Scythe' || this.ability === 'Last Stand') {
                    this.behaviorState = 'AGGRESSIVE';
                } else if (this.ability === 'Berserk') {
                    this.behaviorState = 'AGGRESSIVE';
                } else if (this.ability === 'Poison') {
                    if (enemy.poisoned > 0) {
                        this.behaviorState = dist < 280 ? 'RETREATING' : 'FLANKING';
                    } else if (abilityReady) {
                        this.behaviorState = 'AGGRESSIVE';
                    } else {
                        this.behaviorState = hpRatio < 0.35 ? 'RETREATING' : 'FLANKING';
                    }
                } else if (this.ability === 'Dash' || this.ability === 'Charge') {
                    this.behaviorState = abilityReady ? 'AGGRESSIVE' : 'FLANKING';
                } else if (this.ability === 'Shield') {
                    if (this.shield > 0) this.behaviorState = 'AGGRESSIVE';
                    else if (hpRatio < 0.4 && !abilityReady) this.behaviorState = 'RETREATING';
                    else this.behaviorState = 'AGGRESSIVE';
                } else if (this.ability === 'Vampire' || this.ability === 'Reflect') {
                    this.behaviorState = hpRatio < 0.5 ? 'AGGRESSIVE' : (Math.random() > 0.2 ? 'AGGRESSIVE' : 'FLANKING');
                } else if (this.ability === 'Teleport' || this.ability === 'Phase' || this.ability === 'Pulse') {
                    this.behaviorState = abilityReady ? 'AGGRESSIVE' : 'FLANKING';
                } else if (this.ability === 'Grapple') {
                    this.behaviorState = (dist > 300) ? 'AGGRESSIVE' : 'FLANKING';
                } else if (this.ability === 'Heavy') {
                    this.behaviorState = dist > 250 ? 'AGGRESSIVE' : 'FLANKING';
                } else {
                    if (hpRatio < 0.25 && enemyHpRatio > 0.5) this.behaviorState = 'RETREATING';
                    else if (this.hp > enemy.hp) this.behaviorState = 'AGGRESSIVE';
                    else this.behaviorState = Math.random() > 0.3 ? 'AGGRESSIVE' : 'FLANKING';
                }

                if (Math.random() > 0.5) this.flankDir = Math.random() > 0.5 ? 1 : -1;
            }

            if (this.behaviorState === this.lastBehaviorState) {
                this.stateTime += dt;
            } else {
                this.stateTime         = 0;
                this.lastBehaviorState = this.behaviorState;
            }

            if (this.stateTime > 4.0) {
                if (this.ability === 'Berserk') {
                    this.vx += (Math.random() - 0.5) * 15;
                    this.vy += (Math.random() - 0.5) * 15;
                    this.stateTime = 0;
                } else {
                    let possibleStates = ['AGGRESSIVE', 'FLANKING', 'RETREATING'].filter(s => s !== this.behaviorState);
                    this.behaviorState     = possibleStates[Math.floor(Math.random() * possibleStates.length)];
                    this.behaviorTimer     = 2.0;
                    this.stateTime         = 0;
                    this.lastBehaviorState = this.behaviorState;
                    this.flankDir         *= -1;
                    this.vx += (Math.random() - 0.5) * 10;
                    this.vy += (Math.random() - 0.5) * 10;
                }
            }

            let targetAngle = (this.ability === 'Laser' && this.behaviorState === 'SNIPING')
                ? laserLeadAngle
                : Math.atan2(dy, dx);
            if (this.behaviorState === 'FLANKING') {
                const wallMargin = 100;
                const flankAngle = targetAngle + (Math.PI / 2.5) * this.flankDir;
                const fx = Math.cos(flankAngle), fy = Math.sin(flankAngle);
                const towardWall = (this.x < wallMargin && fx < 0) || (this.x > width - wallMargin && fx > 0)
                                || (this.y < wallMargin && fy < 0) || (this.y > height - wallMargin && fy > 0);
                if (towardWall) this.flankDir *= -1;
                targetAngle += (Math.PI / 2.5) * this.flankDir;
            } else if (this.behaviorState === 'RETREATING') {
                targetAngle += Math.PI;
                const margin = 160;
                if (this.x < margin || this.x > width - margin || this.y < margin || this.y > height - margin) {
                    targetAngle = Math.atan2(height / 2 - this.y, width / 2 - this.x);
                }
            }

            let activeSpeed = this.speed;
            if (this.ability === 'Berserk') activeSpeed *= 1 + ((this.maxHp - this.hp) / this.maxHp) * 0.3;
            if (this.ability === 'Last Stand') activeSpeed *= 1 + (this.getLastStandScale().damageBonus * 0.2);
            if (this.ability === 'Bloodhunt' && enemy.hp / enemy.maxHp < 0.5) activeSpeed *= 1.35;
            if (this.bloodFrenzy > 0) activeSpeed *= 1.2;
            activeSpeed *= this.hasteMult;

            const angleDiff = normalizeAngle(targetAngle - this.angle);
            let turnSpeed = 0.05 * (activeSpeed / 4) * F;
            if (this.behaviorState === 'SNIPING') turnSpeed *= 2;

            if (angleDiff > turnSpeed) this.angle += turnSpeed;
            else if (angleDiff < -turnSpeed) this.angle -= turnSpeed;
            else this.angle = targetAngle;
            this.angle = normalizeAngle(this.angle);

            if (this.behaviorState === 'SNIPING') {
                this.vx *= Math.pow(0.85, F);
                this.vy *= Math.pow(0.85, F);
            } else if (this.behaviorState === 'RETREATING' && Math.hypot(this.vx, this.vy) > activeSpeed * 3) {
                // already moving fast while retreating — don't pile on more acceleration
            } else {
                this.vx += Math.cos(this.angle) * activeSpeed * 0.1 * F;
                this.vy += Math.sin(this.angle) * activeSpeed * 0.1 * F;
            }
        }

        this.tryUltimate(enemy, width, height, dist, dx, dy);

        if (this.abilityCooldown <= 0 && state.gameState === 'FIGHTING') {
            if (this.ability === 'Dash' && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.3) {
                this.vx += Math.cos(this.angle) * 16;
                this.vy += Math.sin(this.angle) * 16;
                this.abilityCooldown = 2.0;
                emitter.emit('ability:used', { ball: this, ability: 'Dash', x: this.x, y: this.y });

            } else if (this.ability === 'Charge' && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.2) {
                this.charging        = 0.75;
                this.abilityCooldown = 3.0;
                emitter.emit('ability:used', { ball: this, ability: 'Charge', x: this.x, y: this.y });

            } else if (this.ability === 'Grapple' && dist < 350) {
                this.grappling       = 0.75;
                this.abilityCooldown = 2.67;
                emitter.emit('ability:used', { ball: this, ability: 'Grapple', x: this.x, y: this.y });

            } else if (this.ability === 'Phase') {
                const angleToMe     = Math.atan2(this.y - enemy.y, this.x - enemy.x);
                const enemyAimDiff  = Math.abs(normalizeAngle(enemy.angle - angleToMe));
                const isMeleeThreat = dist < (this.r + enemy.r + 120) && enemyAimDiff < 0.8 && enemy.intangible <= 0;
                const isProjThreat  = state.projectiles.some(p => p.target === this && Math.hypot(p.x - this.x, p.y - this.y) < (this.r + 100));
                if (isMeleeThreat || isProjThreat) {
                    this.intangible      = 1.5;
                    this.abilityCooldown = 3.67;
                    emitter.emit('ability:used', { ball: this, ability: 'Phase', x: this.x, y: this.y });
                }

            } else if (this.ability === 'Pulse' && dist < (this.r + enemy.r + 120) && enemy.intangible <= 0) {
                this.abilityCooldown = 2.5;
                this.pulseVisual     = 0.25;
                enemy.takeDamage(this.scaleDamage(15), this);
                enemy.vx += (dx / dist) * 18;
                enemy.vy += (dy / dist) * 18;
                emitter.emit('ability:used', { ball: this, ability: 'Pulse', x: this.x, y: this.y });

            } else if (this.ability === 'Teleport' && dist < 350) {
                emitter.emit('fx:particles', { x: this.x, y: this.y, color: this.color, count: 20, speed: 2 });
                const tpDistance = enemy.r + this.r + 30;
                const targetX    = enemy.x - Math.cos(enemy.angle) * tpDistance;
                const targetY    = enemy.y - Math.sin(enemy.angle) * tpDistance;
                this.x           = Math.max(this.r, Math.min(width - this.r, targetX));
                this.y           = Math.max(this.r, Math.min(height - this.r, targetY));
                this.angle       = enemy.angle;
                this.abilityCooldown = 3.0;
                emitter.emit('ability:used', { ball: this, ability: 'Teleport', x: this.x, y: this.y });

            } else if (this.ability === 'Shield') {
                this.shield          = 50;
                this.abilityCooldown = 7.0;
                emitter.emit('ability:used', { ball: this, ability: 'Shield', x: this.x, y: this.y });

            } else if (this.ability === 'Soulbound' && dist < 480 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.45) {
                const nx = dx / Math.max(1, dist);
                const ny = dy / Math.max(1, dist);
                this.vx += nx * 18;
                this.vy += ny * 18;
                this.intangible = 0.22;
                this.slashVisual = 0.35;
                if (dist < this.r + enemy.r + 190 && enemy.intangible <= 0) {
                    enemy.takeDamage(this.scaleDamage(12), this);
                    setTimeout(() => {
                        if (state.gameState === 'FIGHTING' && enemy.hp > 0) enemy.takeDamage(this.scaleDamage(7), this);
                    }, 450);
                }
                this.abilityCooldown = 2.6;
                emitter.emit('ability:used', { ball: this, ability: 'Soulbound', x: this.x, y: this.y });

            } else if (this.ability === 'Windblade' && dist < 720 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.35) {
                const px = this.x + Math.cos(this.angle) * (this.r + 12);
                const py = this.y + Math.sin(this.angle) * (this.r + 12);
                const p = new Projectile(px, py, enemy, this, this.angle, false, 16, this.scaleDamage(11));
                p.effect = 'wind';
                p.r = 13;
                p.life = 1.2;
                state.projectiles.push(p);
                this.windWall = 0.8;
                this.abilityCooldown = 1.6;
                emitter.emit('ability:used', { ball: this, ability: 'Windblade', x: this.x, y: this.y });

            } else if (this.ability === 'Bloodhunt' && dist < 500) {
                const nx = dx / Math.max(1, dist);
                const ny = dy / Math.max(1, dist);
                this.vx += nx * 15;
                this.vy += ny * 15;
                this.bloodFrenzy = 2.2;
                if (dist < this.r + enemy.r + 120 && enemy.intangible <= 0) {
                    enemy.takeDamage(this.scaleDamage(enemy.hp / enemy.maxHp < 0.5 ? 15 : 10), this);
                }
                this.abilityCooldown = 2.2;
                emitter.emit('ability:used', { ball: this, ability: 'Bloodhunt', x: this.x, y: this.y });

            } else if (this.ability === 'Headshot' && dist < 760 && Math.abs(normalizeAngle(this.angle - laserLeadAngle)) < 0.14) {
                const px = this.x + Math.cos(laserLeadAngle) * (this.r + 12);
                const py = this.y + Math.sin(laserLeadAngle) * (this.r + 12);
                const p = new Projectile(px, py, enemy, this, laserLeadAngle, false, 22, this.scaleDamage(21));
                p.effect = 'headshot';
                p.r = 5;
                p.life = 1.25;
                state.projectiles.push(p);
                this.behaviorState = 'RETREATING';
                this.behaviorTimer = 0.8;
                this.abilityCooldown = 2.5;
                emitter.emit('ability:used', { ball: this, ability: 'Headshot', x: this.x, y: this.y });

            } else if (this.ability === 'Gauntlet' && dist < 360 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.5 && enemy.intangible <= 0) {
                const nx = dx / Math.max(1, dist);
                const ny = dy / Math.max(1, dist);
                this.vx += nx * 12;
                this.vy += ny * 12;
                enemy.takeDamage(this.scaleDamage(16), this);
                enemy.vx += nx * 22;
                enemy.vy += ny * 22;
                this.punchVisual = 0.28;
                this.abilityCooldown = 2.3;
                emitter.emit('ability:used', { ball: this, ability: 'Gauntlet', x: this.x, y: this.y });

            } else if (this.ability === 'Regen' && dist < 560 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.45) {
                const px = this.x + Math.cos(this.angle) * (this.r + 12);
                const py = this.y + Math.sin(this.angle) * (this.r + 12);
                const p = new Projectile(px, py, enemy, this, this.angle, true, 7.5, this.scaleDamage(10));
                p.effect = 'cleaver';
                p.r = 12;
                p.life = 2.6;
                state.projectiles.push(p);
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04);
                this.abilityCooldown = 2.6;
                emitter.emit('ability:used', { ball: this, ability: 'Regen', x: this.x, y: this.y });

            } else if (this.ability === 'Fishbones' && dist < 700) {
                for (let i = -1; i <= 1; i++) {
                    const a = Math.atan2(dy, dx) + i * 0.18 + (Math.random() - 0.5) * 0.08;
                    const px = this.x + Math.cos(a) * (this.r + 12);
                    const py = this.y + Math.sin(a) * (this.r + 12);
                    const p = new Projectile(px, py, enemy, this, a, false, 14, this.scaleDamage(12));
                    p.effect = 'rocket';
                    p.r = 8;
                    p.life = 1.55;
                    state.projectiles.push(p);
                }
                this.abilityCooldown = 2.4;
                emitter.emit('ability:used', { ball: this, ability: 'Fishbones', x: this.x, y: this.y });

            } else if (this.ability === 'Ravenous' && dist < 660) {
                if (dist < this.r + enemy.r + 150 && enemy.intangible <= 0) {
                    enemy.takeDamage(this.scaleDamage(9), this);
                    this.hp = Math.min(this.maxHp, this.hp + 7);
                    this.abilityCooldown = 1.7;
                } else if (dist < 660) {
                    const px = this.x + Math.cos(this.angle) * (this.r + 12);
                    const py = this.y + Math.sin(this.angle) * (this.r + 12);
                    const p = new Projectile(px, py, enemy, this, this.angle, true, 8, this.scaleDamage(8));
                    p.effect = 'raven';
                    p.r = 10;
                    p.life = 2.8;
                    state.projectiles.push(p);
                    this.abilityCooldown = 1.9;
                }
                emitter.emit('ability:used', { ball: this, ability: 'Ravenous', x: this.x, y: this.y });

            } else if (this.ability === 'Haymaker' && dist < this.r + enemy.r + 150 && enemy.intangible <= 0) {
                const nx = dx / Math.max(1, dist);
                const ny = dy / Math.max(1, dist);
                const gritDamage = Math.min(24, this.grit * 0.8);
                enemy.takeDamage(this.scaleDamage(10 + gritDamage), this);
                enemy.vx += nx * (18 + gritDamage * 0.35);
                enemy.vy += ny * (18 + gritDamage * 0.35);
                this.fortify = 2.2;
                this.fortifyMult = 0.7;
                this.grit = 0;
                this.punchVisual = 0.36;
                this.abilityCooldown = 3.1;
                emitter.emit('ability:used', { ball: this, ability: 'Haymaker', x: this.x, y: this.y });

            } else if (this.ability === 'Boomerang' && dist < 720 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.45) {
                const leadFrames = Math.min(24, dist / 16);
                const throwAngle = Math.atan2(
                    enemy.y + enemy.vy * leadFrames - this.y,
                    enemy.x + enemy.vx * leadFrames - this.x
                );
                const px = this.x + Math.cos(throwAngle) * (this.r + 16);
                const py = this.y + Math.sin(throwAngle) * (this.r + 16);
                const boom = new BoomerangProjectile(px, py, enemy, this, throwAngle, this.flankDir);
                boom.damage = this.scaleDamage(boom.damage);
                state.projectiles.push(boom);
                this.momentumArmorDuration = 1.9;
                this.momentumArmor = this.momentumArmorDuration;
                this.abilityCooldown = 3.2;
                this.behaviorState = 'FLANKING';
                this.behaviorTimer = 1.1;
                emitter.emit('ability:used', { ball: this, ability: 'Boomerang', x: this.x, y: this.y });

            } else if (this.ability === 'Brand' && dist < 680 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 0.35) {
                const px = this.x + Math.cos(this.angle) * (this.r + 12);
                const py = this.y + Math.sin(this.angle) * (this.r + 12);
                const p = new Projectile(px, py, enemy, this, this.angle, true, 8.5, 8);
                p.effect = 'brand';
                p.color = '#0f172a';
                p.r = 11;
                p.life = 2.5;
                p.damage = this.scaleDamage(p.damage);
                state.projectiles.push(p);
                this.abilityCooldown = 3.4;
                this.behaviorState = 'RETREATING';
                this.behaviorTimer = 0.9;
                emitter.emit('ability:used', { ball: this, ability: 'Brand', x: this.x, y: this.y });

            } else if (this.ability === 'Scythe' && dist < this.r + enemy.r + 150 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 1.45 && enemy.intangible <= 0) {
                const damage = this.scaleDamage(9);
                enemy.takeDamage(damage, this);
                const stolen = enemy.applyMaxHpReduction(enemy.naturalMaxHp * 0.06, 0.4);
                const gained = this.gainMaxHp(stolen, 0.4);
                if (stolen > 0 || gained > 0) {
                    emitter.emit('fx:text', { text: 'MAX STEAL', x: enemy.x, y: enemy.y - enemy.r - 45, color: '#dc2626' });
                }
                this.scytheVisual = 0.25;
                this.abilityCooldown = 1.2;
                emitter.emit('fx:particles', { x: enemy.x, y: enemy.y, color: '#dc2626', count: 18, speed: 4 });
                emitter.emit('ability:used', { ball: this, ability: 'Scythe', x: this.x, y: this.y });

            } else if (this.ability === 'Last Stand' && dist < this.r + enemy.r + 70 && Math.abs(normalizeAngle(this.angle - Math.atan2(dy, dx))) < 1.1 && enemy.intangible <= 0) {
                enemy.takeDamage(this.scaleDamage(7 * this.getLastStandDamageMultiplier()), this);
                this.abilityCooldown = 1.0;
                emitter.emit('fx:particles', { x: enemy.x, y: enemy.y, color: this.color, count: 12, speed: 3 });
                emitter.emit('ability:used', { ball: this, ability: 'Last Stand', x: this.x, y: this.y });

            } else if (this.ability === 'Missile') {
                const px = this.x + Math.cos(this.angle) * (this.r + 10);
                const py = this.y + Math.sin(this.angle) * (this.r + 10);
                const p = new Projectile(px, py, enemy, this, this.angle, true, 7, this.scaleDamage(10));
                state.projectiles.push(p);
                this.abilityCooldown = 1.5;

            } else if (this.ability === 'Laser' && Math.abs(normalizeAngle(this.angle - laserLeadAngle)) < 0.15) {
                const px = this.x + Math.cos(this.angle) * (this.r + 10);
                const py = this.y + Math.sin(this.angle) * (this.r + 10);
                const p = new Projectile(px, py, enemy, this, this.angle, false, 18, this.scaleDamage(20));
                state.projectiles.push(p);
                this.abilityCooldown = 1.33;
                this.behaviorState   = 'RETREATING';
                this.behaviorTimer   = 0.67;
                emitter.emit('fx:particles', { x: px, y: py, color: this.color, count: 10, speed: 2 });

            } else if (this.ability === 'Minion') {
                const px     = this.x + Math.cos(this.angle) * (this.r + 10);
                const py     = this.y + Math.sin(this.angle) * (this.r + 10);
                const spread = (Math.random() - 0.5) * 1.5;
                const p      = new Projectile(px, py, enemy, this, this.angle + spread, true, 4.5, this.scaleDamage(2));
                p.isSwarm        = true;
                p.r              = 5.25;
                p.life           = 5.0;
                state.projectiles.push(p);
                this.abilityCooldown = 0.25;

            } else if (this.ability === 'Trap') {
                state.hazards.push(new Hazard(this.x, this.y, this));
                this.abilityCooldown = 1.67;
            }
        }

        this.vx *= Math.pow(0.95, F);
        this.vy *= Math.pow(0.95, F);
        this.x  += this.vx * F;
        this.y  += this.vy * F;

        if (this.x - this.r < 0)      { this.x = this.r;         this.vx *= -1; this.vy += (Math.random() - 0.5) * 2; }
        if (this.x + this.r > width)  { this.x = width - this.r; this.vx *= -1; this.vy += (Math.random() - 0.5) * 2; }
        if (this.y - this.r < 0)      { this.y = this.r;          this.vy *= -1; this.vx += (Math.random() - 0.5) * 2; }
        if (this.y + this.r > height) { this.y = height - this.r; this.vy *= -1; this.vx += (Math.random() - 0.5) * 2; }
    }
}

export class Hazard {
    constructor(x, y, source) {
        this.x = x; this.y = y; this.source = source;
        this.r      = 24.5;
        this.active = true;
        this.life   = 7.0;
        this.damage = 18;
    }
    update(enemy, dt) {
        this.life -= dt;
        if (this.life <= 0) { this.active = false; return; }
        const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (dist < enemy.r + this.r && enemy.intangible <= 0) {
            enemy.takeDamage(this.damage, this.source);
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#d97706', count: 25, speed: 5 });
            this.active = false;
        }
    }
}

export class Projectile {
    constructor(x, y, target, source, startAngle, homing = true, speed = 8, damage = 10) {
        this.x = x; this.y = y;
        this.target  = target;
        this.source  = source;
        this.homing  = homing;
        this.speed   = speed;
        this.r       = homing ? 10.5 : 7;
        this.damage  = damage;
        this.color   = source.color;
        this.vx      = Math.cos(startAngle) * speed;
        this.vy      = Math.sin(startAngle) * speed;
        this.active  = true;
        this.life    = homing ? 4.0 : 1.33;
        this.isSwarm = false;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) { this.active = false; return; }
        if (!this.target) { this.active = false; return; }

        const dx   = this.target.x - this.x;
        const dy   = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.target.r + this.r && this.target.intangible <= 0) {
            this.target.takeDamage(this.damage, this.source);
            if (this.effect === 'brand') {
                const loss = this.target.applyMaxHpReduction(this.target.naturalMaxHp * 0.07, 0.45);
                if (loss > 0) {
                    emitter.emit('fx:text', { text: 'MAX-', x: this.target.x, y: this.target.y - this.target.r - 45, color: '#111827' });
                }
            } else if (this.effect === 'rocket') {
                emitter.emit('fx:text', { text: 'BOOM!', x: this.target.x, y: this.target.y - this.target.r - 45, color: '#f59e0b' });
                emitter.emit('fx:particles', { x: this.target.x, y: this.target.y, color: '#f59e0b', count: 26, speed: 6, size: 4 });
            } else if (this.effect === 'wind') {
                const push = Math.hypot(this.vx, this.vy) || 1;
                this.target.vx += (this.vx / push) * 12;
                this.target.vy += (this.vy / push) * 12;
                emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#60a5fa', count: 14, speed: 4, size: 3 });
            } else if (this.effect === 'cleaver') {
                this.source.hp = Math.min(this.source.maxHp, this.source.hp + 5);
                emitter.emit('fx:text', { text: '+REGEN', x: this.source.x, y: this.source.y - this.source.r - 45, color: '#a78bfa' });
            } else if (this.effect === 'raven') {
                this.source.hp = Math.min(this.source.maxHp, this.source.hp + 6);
                emitter.emit('fx:text', { text: '+DRAIN', x: this.source.x, y: this.source.y - this.source.r - 45, color: '#991b1b' });
            } else if (this.effect === 'headshot') {
                emitter.emit('fx:text', { text: 'HEADSHOT', x: this.target.x, y: this.target.y - this.target.r - 45, color: '#38bdf8' });
            }
            this.active = false;
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: this.color, count: 12, speed: 3 });
            return;
        }

        if (this.homing) {
            const turnRate = this.isSwarm ? 0.8 : 1.2;
            this.vx += (dx / dist) * turnRate * dt * 60;
            this.vy += (dy / dist) * turnRate * dt * 60;

            if (this.isSwarm) {
                this.vx += (Math.random() - 0.5) * 2.5 * dt * 60;
                this.vy += (Math.random() - 0.5) * 2.5 * dt * 60;
            }

            const v = Math.hypot(this.vx, this.vy);
            if (v > this.speed) {
                this.vx = (this.vx / v) * this.speed;
                this.vy = (this.vy / v) * this.speed;
            }
        }

        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;

        if (Math.random() < 0.5 * dt * 60) {
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: this.color, count: 1, speed: 0.5, size: 2 });
        }
    }
}

export class BoomerangProjectile extends Projectile {
    constructor(x, y, target, source, startAngle, curveDir) {
        super(x, y, target, source, startAngle, false, 10.5, 9);
        this.isBoomerang = true;
        this.r = 13;
        this.life = 1.9;
        this.maxLife = 1.9;
        this.returning = false;
        this.curveDir = curveDir || 1;
        this.hitOutbound = false;
        this.hitReturn = false;
        this.spin = 0;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            this.source.momentumArmor = 0;
            return;
        }

        const F = dt * 60;
        const elapsed = this.maxLife - this.life;
        this.spin += 0.35 * F;
        if (!this.returning && elapsed > 0.82) this.returning = true;

        if (this.returning) {
            const dx = this.source.x - this.x;
            const dy = this.source.y - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            this.vx += (dx / dist) * 1.35 * F;
            this.vy += (dy / dist) * 1.35 * F;
            if (dist < this.source.r + this.r) {
                this.active = false;
                this.source.momentumArmor = 0;
                return;
            }
        } else {
            const v = Math.hypot(this.vx, this.vy) || 1;
            const vx = this.vx / v;
            const vy = this.vy / v;
            this.vx += -vy * this.curveDir * 0.35 * F;
            this.vy += vx * this.curveDir * 0.35 * F;
        }

        const v = Math.hypot(this.vx, this.vy) || 1;
        const maxSpeed = this.returning ? 12 : this.speed;
        if (v > maxSpeed) {
            this.vx = (this.vx / v) * maxSpeed;
            this.vy = (this.vy / v) * maxSpeed;
        }

        this.x += this.vx * F;
        this.y += this.vy * F;

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        const canHit = this.returning ? !this.hitReturn : !this.hitOutbound;

        if (canHit && dist < this.target.r + this.r && this.target.intangible <= 0) {
            this.target.takeDamage(this.damage, this.source);
            if (this.returning) this.hitReturn = true;
            else this.hitOutbound = true;
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: this.color, count: 14, speed: 4 });
        }

        if (Math.random() < 0.55 * F) {
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: this.color, count: 1, speed: 0.4, size: 2 });
        }
    }
}

export class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.r = 18;
        this.life = 12;
        this.active = true;
        this.spin = 0;
    }

    update(dt, ballA, ballB) {
        this.life -= dt;
        this.spin += dt * 4;
        if (this.life <= 0) {
            this.active = false;
            return;
        }

        const checkPickup = (owner, enemy) => {
            const dist = Math.hypot(owner.x - this.x, owner.y - this.y);
            if (dist < owner.r + this.r) {
                owner.applyPickup(this.type, enemy);
                emitter.emit('fx:particles', { x: this.x, y: this.y, color: owner.color, count: 20, speed: 3, size: 3 });
                this.active = false;
            }
        };

        checkPickup(ballA, ballB);
        if (this.active) checkPickup(ballB, ballA);
    }
}

export class ArenaEffect {
    constructor(kind, x, y, power = 1, damage = 12) {
        this.kind = kind;
        this.x = x;
        this.y = y;
        this.power = power;
        this.damage = damage;
        this.life = kind === 'strike' ? 1.6 : 1.2;
        this.active = true;
        this.triggered = false;
        this.r = kind === 'strike' ? 74 : 96;
    }

    update(dt, ballA, ballB) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            return;
        }

        if (!this.triggered && this.kind === 'strike' && this.life <= 0.3) {
            this.triggered = true;
            const hit = (ball) => {
                const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
                if (dist < this.r + ball.r) {
                    ball.takeDamage(this.damage * this.power, null);
                    const pushX = (ball.x - this.x) / Math.max(1, dist);
                    const pushY = (ball.y - this.y) / Math.max(1, dist);
                    ball.vx += pushX * 18 * this.power;
                    ball.vy += pushY * 18 * this.power;
                }
            };
            hit(ballA);
            hit(ballB);
            emitter.emit('fx:particles', { x: this.x, y: this.y, color: '#eab308', count: 36, speed: 7, size: 4 });
            emitter.emit('fx:text', { text: 'STRIKE!', x: this.x, y: this.y - 24, color: '#facc15' });
        }
    }
}
