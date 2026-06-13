const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.json({
        projet: '07',
        message: 'Déployé sur AWS EC2',
        hostname: require('os').hostname(),
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.listen(3000, () => console.log('Projet 07 on :3000'));
