import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { winnerName, loserName, winnerAbility, loserAbility, round, duration } = req.body ?? {};

    if (!winnerName || !loserName) {
        return res.status(400).json({ error: 'winnerName and loserName are required' });
    }

    try {
        const entry = {
            winnerName,
            loserName,
            winnerAbility,
            loserAbility,
            round,
            duration: Math.round(duration ?? 0),
            timestamp: Date.now()
        };

        // Increment win counter for the winner
        await kv.incr(`wins:${winnerName}`);

        // Append to match history list, keep last 100
        await kv.lpush('history', JSON.stringify(entry));
        await kv.ltrim('history', 0, 99);

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('KV write failed:', err);
        // Degrade gracefully — the game keeps working
        return res.status(503).json({ error: 'Storage unavailable' });
    }
}
