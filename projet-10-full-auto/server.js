const express = require('express');
const app = express();
app.use(express.json());

const VERSION = process.env.APP_VERSION || '0.0.0';
const ENV = process.env.NODE_ENV || 'development';
let healthy = true;

app.get('/', (req, res) => {
    res.json({
        projet: '10 - Full Automation',
        version: VERSION,
        environment: ENV,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    if (healthy) {
        res.status(200).json({ status: 'healthy', version: VERSION });
    } else {
        res.status(503).json({ status: 'unhealthy', version: VERSION });
    }
});

app.get('/metrics', (req, res) => {
    res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: VERSION
    });
});

app.post('/admin/toggle-health', (req, res) => {
    healthy = !healthy;
    res.json({ healthy });
});

app.listen(3000, () => console.log(`[${ENV}] Projet 10 v${VERSION} on :3000`));
