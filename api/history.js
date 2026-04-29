import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const raw     = await kv.lrange('history', 0, 19); // last 20 matches
        const history = raw.map(item => (typeof item === 'string' ? JSON.parse(item) : item));

        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
        return res.status(200).json(history);
    } catch (err) {
        console.error('KV read failed:', err);
        return res.status(503).json({ error: 'Storage unavailable' });
    }
}
