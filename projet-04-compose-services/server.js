const express = require('express');
const { createClient } = require('redis');
const app = express();

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.connect();

app.get('/', async (req, res) => {
    await redis.incr('visits');
    const visits = await redis.get('visits');
    res.json({ projet: '04', visits: parseInt(visits) });
});

app.get('/health', async (req, res) => {
    try {
        await redis.ping();
        res.status(200).json({ healthy: true, redis: 'connected' });
    } catch (e) {
        res.status(500).json({ healthy: false, redis: 'disconnected' });
    }
});

app.listen(3000, () => console.log('Projet 04 running on :3000'));
