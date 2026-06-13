const express = require('express');
const app = express();

const ENV = process.env.NODE_ENV || 'development';
const VERSION = process.env.APP_VERSION || '0.0.0';

app.get('/', (req, res) => {
    res.json({
        projet: '05',
        environment: ENV,
        version: VERSION,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => res.status(200).json({ status: 'up', env: ENV }));

app.listen(3000, () => console.log(`Projet 05 [${ENV}] running on :3000`));
