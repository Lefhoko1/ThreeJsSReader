import { NextResponse } from 'next/server';
import { DerivClient } from '@/lib/deriv-client';

export async function POST(request) {
    try {
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        console.log('Trading triggered at:', body.triggered_at);

        const derivClient = new DerivClient({
            appId: parseInt(process.env.DERIV_APP_ID),
            token: process.env.DERIV_API_TOKEN,
            wsUrl: process.env.DERIV_WS_URL
        });

        await derivClient.connect();
        console.log('Connected to Deriv');

        const balance = await derivClient.getBalance();
        console.log('Balance:', balance);

        const tradeResult = await derivClient.buyContract({
            amount: parseFloat(process.env.DERIV_TRADE_AMOUNT),
            contract_type: process.env.DERIV_CONTRACT_TYPE,
            duration: 5,
            duration_unit: 'm',
            symbol: process.env.DERIV_SYMBOL
        });

        derivClient.disconnect();

        return NextResponse.json({
            success: true,
            trade: tradeResult.buy,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: 'alive', message: 'Trading bot is running' });
}
