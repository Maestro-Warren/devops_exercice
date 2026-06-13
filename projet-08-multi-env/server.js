const express = require('express');
const app = express();

const CONFIG = {
    env: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '0.0.0',
    db_host: process.env.DB_HOST || 'localhost',
    port: process.env.PORT || 3000
};

app.get('/', (req, res) => res.json({ projet: '08', config: CONFIG }));
app.get('/health', (req, res) => res.status(200).json({ status: 'up', env: CONFIG.env }));

app.listen(CONFIG.port, () => console.log(`Projet 08 [${CONFIG.env}] on :${CONFIG.port}`));
