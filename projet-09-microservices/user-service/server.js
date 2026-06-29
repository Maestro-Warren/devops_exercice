const express = require('express');
const app = express();

const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
];

app.get('/users', (req, res) => res.json(users));
app.get('/health', (req, res) => res.json({ service: 'user-service', status: 'up' }));

app.listen(3000, () => console.log('User service on :3000'));
