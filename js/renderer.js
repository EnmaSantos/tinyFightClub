// Pure rendering functions — no imports from state.js or game logic.
// Each function receives only what it needs to draw.

export function drawArenaAtmosphere(ctx, w, h, env) {
    const glow = Math.max(0, env.windStrength * 8);
    if (glow > 0) {
        ctx.fillStyle = `rgba(56, 189, 248, ${0.03 + glow * 0.012})`;
        ctx.fillRect(0, 0, w, h);
    }
}

export function drawBall(ctx, ball) {
    ctx.save();
    ctx.translate(ball.x, ball.y);

    if (ball.intangible > 0) ctx.globalAlpha = 0.4;

    if (ball.shield > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();
    }

    if (ball.momentumArmor > 0) {
        const armorPct = Math.max(0, ball.momentumArmor / ball.momentumArmorDuration);
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.2 + armorPct * 0.45})`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    if (ball.pulseVisual > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + (15 - ball.pulseVisual) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(14, 165, 233, ${ball.pulseVisual / 15})`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    if (ball.windWall > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + 14, -0.9, 0.9);
        ctx.strokeStyle = `rgba(96, 165, 250, ${Math.min(0.8, ball.windWall)})`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    if (ball.bloodFrenzy > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + 12, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(220, 38, 38, ${Math.min(0.7, ball.bloodFrenzy / 3)})`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    if (ball.ultimateFxTimer > 0) {
        const t = Math.min(1, ball.ultimateFxTimer / 1.4);
        const a = 0.18 + t * 0.42;
        const color = ball.ultimateFxColor || ball.color;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        if (ball.ultimateFxStyle === 'shock') {
            ctx.beginPath();
            ctx.arc(0, 0, ball.r + 22 + (1 - t) * 8, 0, Math.PI * 2);
            ctx.lineWidth = 6;
            ctx.globalAlpha = a;
            ctx.stroke();
        } else if (ball.ultimateFxStyle === 'nova') {
            ctx.globalAlpha = a;
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2 + ball.ultimateFxTimer * 3;
                const px = Math.cos(ang) * (ball.r + 22);
                const py = Math.sin(ang) * (ball.r + 22);
                ctx.beginPath();
                ctx.arc(px, py, 4 + t * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (ball.ultimateFxStyle === 'swarm') {
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(0, 0, ball.r + 16, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, ball.r + 30, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (ball.ultimateFxStyle === 'lock') {
            ctx.globalAlpha = a;
            ctx.rotate(ball.ultimateFxTimer * 2.2);
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const ang = (i / 8) * Math.PI * 2;
                const rr = ball.r + (i % 2 ? 18 : 28);
                const px = Math.cos(ang) * rr;
                const py = Math.sin(ang) * rr;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.rotate(-ball.ultimateFxTimer * 2.2);
        } else if (ball.ultimateFxStyle === 'overdrive') {
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.arc(0, 0, ball.r + 18, 0, Math.PI * 2);
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, ball.r + 30, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    if (ball.scytheVisual > 0) {
        ctx.save();
        ctx.rotate(ball.angle);
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + 34, -0.95, 0.95);
        ctx.strokeStyle = `rgba(220, 38, 38, ${Math.min(1, ball.scytheVisual * 5)})`;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    if (ball.slashVisual > 0) {
        ctx.save();
        ctx.rotate(ball.angle);
        ctx.beginPath();
        ctx.arc(0, 0, ball.r + 30, -0.65, 0.65);
        ctx.strokeStyle = `rgba(248, 250, 252, ${Math.min(1, ball.slashVisual * 3)})`;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    if (ball.punchVisual > 0) {
        ctx.save();
        ctx.rotate(ball.angle);
        ctx.fillStyle = `rgba(236, 72, 153, ${Math.min(0.8, ball.punchVisual * 3)})`;
        ctx.beginPath();
        ctx.ellipse(ball.r + 18, 0, 26, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.rotate(ball.angle);
    ctx.beginPath();
    ctx.moveTo(Math.cos(-Math.PI / 3) * ball.r, Math.sin(-Math.PI / 3) * ball.r);
    ctx.lineTo(ball.r * 1.6, 0);
    ctx.lineTo(Math.cos(Math.PI / 3) * ball.r, Math.sin(Math.PI / 3) * ball.r);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(-ball.angle);

    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = ball.flash > 0 ? '#ffffff' : ball.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#020617';
    ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1.0;

    const barW = ball.r * 1.5;
    const hpPct = Math.max(0, ball.hp / ball.maxHp);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(ball.x - barW / 2, ball.y - ball.r - 24, barW, 6);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(ball.x - barW / 2, ball.y - ball.r - 24, barW * hpPct, 6);

    if (ball.shield > 0) {
        ctx.fillStyle = '#3b82f6';
        const shieldPct = Math.min(1, ball.shield / 50);
        ctx.fillRect(ball.x - barW / 2, ball.y - ball.r - 24, barW * shieldPct, 3);
    }

    if (ball.grit > 0) {
        ctx.fillStyle = '#fb7185';
        const gritPct = Math.min(1, ball.grit / 36);
        ctx.fillRect(ball.x - barW / 2, ball.y - ball.r - 20, barW * gritPct, 3);
    }

    const ultPct = Math.max(0, Math.min(1, ball.ultimateCharge / 100));
    if (ultPct > 0) {
        ctx.fillStyle = '#7c3aed';
        ctx.fillRect(ball.x - barW / 2, ball.y - ball.r - 16, barW * ultPct, 2);
    }

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(ball.x - barW / 2, ball.y - ball.r - 24, barW, 6);

    if (ball.damageBuff > 0 || ball.haste > 0 || ball.fortify > 0) {
        const tags = [];
        if (ball.damageBuff > 0) tags.push('DMG');
        if (ball.haste > 0) tags.push('HST');
        if (ball.fortify > 0) tags.push('DEF');
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(tags.join('+'), ball.x, ball.y - ball.r - 8);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ball.name, ball.x, ball.y - ball.r - 35);
}

export function drawHazard(ctx, hazard) {
    ctx.fillStyle = '#d97706';
    ctx.globalAlpha = Math.min(1, hazard.life / 60);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(hazard.x + Math.cos(a) * hazard.r, hazard.y + Math.sin(a) * hazard.r);
        const a2 = ((i + 0.5) / 6) * Math.PI * 2;
        ctx.lineTo(hazard.x + Math.cos(a2) * (hazard.r / 2), hazard.y + Math.sin(a2) * (hazard.r / 2));
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

export function drawPickup(ctx, pickup) {
    const colors = {
        damage: '#f97316',
        haste: '#22d3ee',
        fortify: '#3b82f6',
        heal: '#10b981',
        rocket: '#f59e0b'
    };

    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(pickup.spin);
    ctx.fillStyle = colors[pickup.type] || '#e2e8f0';
    ctx.globalAlpha = Math.min(1, pickup.life / 2);
    ctx.beginPath();
    ctx.moveTo(0, -pickup.r);
    ctx.lineTo(pickup.r * 0.86, 0);
    ctx.lineTo(0, pickup.r);
    ctx.lineTo(-pickup.r * 0.86, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
}

export function drawArenaEffect(ctx, effect) {
    if (effect.kind === 'strike') {
        const t = Math.max(0, effect.life / 1.6);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.r * (1 - t * 0.4), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(250, 204, 21, ${0.2 + t * 0.5})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        if (effect.life < 0.32) {
            ctx.beginPath();
            ctx.moveTo(effect.x, effect.y - 42);
            ctx.lineTo(effect.x + 10, effect.y - 8);
            ctx.lineTo(effect.x - 4, effect.y - 8);
            ctx.lineTo(effect.x + 6, effect.y + 32);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
            ctx.lineWidth = 6;
            ctx.stroke();
        }
    }
}

export function drawProjectile(ctx, proj) {
    if (proj.isBoomerang) {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.spin);
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, proj.r, Math.PI * 0.15, Math.PI * 1.35);
        ctx.stroke();
        ctx.strokeStyle = '#fff7ed';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (proj.effect === 'brand') {
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
    }

    if (proj.effect === 'wind') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.strokeStyle = '#bfdbfe';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, proj.r + 9, -0.8, 0.8);
        ctx.stroke();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-proj.r, 0);
        ctx.lineTo(proj.r + 14, 0);
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (proj.effect === 'cleaver') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#c4b5fd';
        ctx.beginPath();
        ctx.moveTo(proj.r + 12, 0);
        ctx.lineTo(-proj.r, -7);
        ctx.lineTo(-proj.r + 4, 0);
        ctx.lineTo(-proj.r, 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (proj.effect === 'raven') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.moveTo(proj.r + 10, 0);
        ctx.lineTo(-proj.r, -10);
        ctx.lineTo(-proj.r + 4, 0);
        ctx.lineTo(-proj.r, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (proj.effect === 'headshot') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-proj.r - 12, 0);
        ctx.lineTo(proj.r + 18, 0);
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(proj.r + 10, 0, proj.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
    }

    if (proj.effect === 'rocket') {
        const angle = Math.atan2(proj.vy, proj.vx);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(proj.r + 12, 0);
        ctx.lineTo(-proj.r, -7);
        ctx.lineTo(-proj.r, 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(-proj.r, 0);
        ctx.lineTo(-proj.r - 12, -5);
        ctx.lineTo(-proj.r - 8, 0);
        ctx.lineTo(-proj.r - 12, 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        return;
    }

    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
}

export function drawParticle(ctx, particle) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
}

export function drawFloatingText(ctx, ft) {
    ctx.globalAlpha = Math.max(0, ft.life);
    ctx.fillStyle = ft.color;
    ctx.font = '900 27px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 4;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1.0;
}

export function drawGrappleLine(ctx, from, to) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = from.color;
    ctx.lineWidth = 3;
    ctx.stroke();
}

export function drawConfetti(ctx, piece) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, piece.life);
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
    ctx.restore();
    ctx.globalAlpha = 1.0;
}

export function drawArenaBorder(ctx, w, h) {
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
}
