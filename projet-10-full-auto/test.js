const http = require('http');
const app = require('./server');

const tests = [
    { method: 'GET', path: '/health', expectStatus: 200 },
    { method: 'GET', path: '/', expectStatus: 200 },
    { method: 'GET', path: '/metrics', expectStatus: 200 }
];

const server = app.listen(4010, async () => {
    let passed = 0;
    for (const t of tests) {
        const status = await new Promise((resolve) => {
            http.get(`http://localhost:4010${t.path}`, (res) => {
                res.resume();
                resolve(res.statusCode);
            });
        });
        if (status === t.expectStatus) {
            console.log(`PASS: ${t.method} ${t.path} → ${status}`);
            passed++;
        } else {
            console.error(`FAIL: ${t.method} ${t.path} → ${status} (expected ${t.expectStatus})`);
        }
    }
    server.close();
    process.exit(passed === tests.length ? 0 : 1);
});
