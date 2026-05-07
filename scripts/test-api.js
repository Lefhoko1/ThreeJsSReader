const http = require('http');

const testData = {
    triggered_at: new Date().toISOString(),
    target_boundary: new Date().toISOString(),
    timing: '3_seconds_before'
};

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/trading-bot',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'your-super-secret-key-here'
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => console.log('Response:', JSON.parse(data)));
});

req.on('error', (error) => console.error('Error:', error.message));
req.write(JSON.stringify(testData));
req.end();
