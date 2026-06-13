const express = require('express');
const http = require('http');
const app = express();

function proxyTo(service, path) {
    return (req, res) => {
        http.get(`http://${service}:3000${path}`, (proxyRes) => {
            let data = '';
            proxyRes.on('data', c => data += c);
            proxyRes.on('end', () => res.json(JSON.parse(data)));
        }).on('error', () => res.status(502).json({ error: `${service} unavailable` }));
    };
}

app.get('/users', proxyTo('user-service', '/users'));
app.get('/products', proxyTo('product-service', '/products'));
app.get('/health', (req, res) => res.json({ service: 'gateway', status: 'up' }));

app.listen(8080, () => console.log('Gateway on :8080'));
