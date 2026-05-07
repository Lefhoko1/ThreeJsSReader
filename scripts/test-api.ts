import * as http from 'http';

interface TestData {
    triggered_at: string;
    target_boundary: string;
    timing: string;
}

interface TradingResponse {
    success: boolean;
    trade?: {
        contract_id: string;
        buy_price: number;
        payout?: number;
        start_time: string;
        expiry_time?: string;
    };
    balance?: number;
    error?: string;
    timestamp: string;
}

const testData: TestData = {
    triggered_at: new Date().toISOString(),
    target_boundary: new Date().toISOString(),
    timing: 'test_3_seconds_before'
};

const options: http.RequestOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/trading-bot',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'MyTradingBot2024!SuperSecretKey'
    }
};

const req = http.request(options, (res: http.IncomingMessage) => {
    let data = '';
    
    res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
    });
    
    res.on('end', () => {
        try {
            const response: TradingResponse = JSON.parse(data);
            console.log('Response:', JSON.stringify(response, null, 2));
        } catch (error) {
            console.error('Failed to parse response:', data);
        }
    });
});

req.on('error', (error: Error) => {
    console.error('Error:', error.message);
});

req.write(JSON.stringify(testData));
req.end();