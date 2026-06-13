const http = require('http');
const app = require('./server');

const server = app.listen(4000, () => {
    http.get('http://localhost:4000/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const json = JSON.parse(data);
            if (json.healthy === true) {
                console.log('TEST PASSED: /health retourne healthy=true');
                server.close();
                process.exit(0);
            } else {
                console.error('TEST FAILED: healthy !== true');
                server.close();
                process.exit(1);
            }
        });
    }).on('error', (err) => {
        console.error('TEST FAILED:', err.message);
        server.close();
        process.exit(1);
    });
});
