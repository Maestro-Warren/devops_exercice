const express = require('express');
const app = express();
app.use(express.json());

let requestCount = 0;

app.get('/', (req, res) => {
    res.json({ projet: '06', message: 'Webhook GitHub → Jenkins', version: process.env.APP_VERSION || '0.0.0', requests: requestCount });
});

app.post('/api/data', (req, res) => {
    requestCount++;
    res.status(201).json({ id: requestCount, received: req.body });
});

app.get('/health', (req, res) => res.status(200).json({ status: 'healthy' }));

app.listen(3000, () => console.log('Projet 06 on :3000'));
