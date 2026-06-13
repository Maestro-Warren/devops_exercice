const http = require('http');

const checks = [
    { path: '/health', expect: (d) => JSON.parse(d).status === 'up' },
    { path: '/', expect: (d) => JSON.parse(d).projet === '05' }
];

const server = require('./server');
const s = require('http').createServer(server);

s.listen(4005, async () => {
    let failed = false;
    for (const check of checks) {
        const result = await new Promise((resolve) => {
            http.get(`http://localhost:4005${check.path}`, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            });
        });
        if (!check.expect(result)) {
            console.error(`FAIL: ${check.path}`);
            failed = true;
        } else {
            console.log(`PASS: ${check.path}`);
        }
    }
    s.close();
    process.exit(failed ? 1 : 0);
});
