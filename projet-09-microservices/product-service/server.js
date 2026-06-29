const express = require('express');
const app = express();

const products = [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Phone', price: 699 }
];

app.get('/products', (req, res) => res.json(products));
app.get('/health', (req, res) => res.json({ service: 'product-service', status: 'up' }));

app.listen(3000, () => console.log('Product service on :3000'));
