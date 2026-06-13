const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.json({
        projet: '03',
        message: 'Push automatique vers Docker Hub',
        version: process.env.APP_VERSION || '1.0.0'
    });
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(3000, () => console.log('Projet 03 running on :3000'));
