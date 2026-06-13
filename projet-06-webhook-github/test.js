const http = require('http');
const app = require('./server');

const server = app.listen(4006, () => {
    const postData = JSON.stringify({ name: 'test' });
    const options = {
        hostname: 'localhost', port: 4006, path: '/api/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const json = JSON.parse(data);
            if (res.statusCode === 201 && json.id === 1) {
                console.log('TEST PASSED: POST /api/data');
                server.close();
                process.exit(0);
            } else {
                console.error('TEST FAILED');
                server.close();
                process.exit(1);
            }
        });
    });
    req.write(postData);
    req.end();
});
