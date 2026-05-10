import { NextRequest, NextResponse } from 'next/server';
import sequelize from '@/app/lib/database';
import { StarBotTradingLogic } from '@/app/lib/tradinglogic';

// ============================================
// TYPES FOR BINARY OPTIONS TRADING
// ============================================

interface DerivConfig {
    appId: number;
    token: string;
    wsUrl: string;
}

interface BinaryOptionsParams {
    amount: number;           // Stake amount in USD
    contract_type: 'CALL' | 'PUT';  // CALL = price goes up, PUT = price goes down
    duration: number;         // Duration value
    duration_unit: 't' | 's' | 'm' | 'h';  // t=ticks, s=seconds, m=minutes, h=hours
    symbol: string;           // e.g., 'R_100', 'R_75', 'BOOM1000', 'CRASH1000'
    barrier?: number;         // Optional: specific price level
    basis?: 'stake' | 'payout';  // 'stake' = risk amount, 'payout' = target payout
}

interface ProposalRequest {
    amount: number;
    basis: 'stake' | 'payout';
    contract_type: 'CALL' | 'PUT';
    currency: 'USD';
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h';
    symbol: string;
}

interface BuyRequest {
    price: number;           // The proposal price
    parameters: {
        amount: number;
        basis: 'stake' | 'payout';
        contract_type: 'CALL' | 'PUT';
        currency: 'USD';
        duration: number;
        duration_unit: 't' | 's' | 'm' | 'h';
        symbol: string;
    };
}

interface TradeResponse {
    success: boolean;
    message?: string;
    botState?: any;
    seededTables?: any[];
    duration_ms?: number;
    error?: string;
    timestamp: string;
}

// ============================================
// MAIN API ENDPOINT
// ============================================

// Store trading bot instance
let tradingBot: StarBotTradingLogic | null = null;

export async function POST(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    
    try {
        // 1. Authentication
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== process.env.CRON_SECRET) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
                { status: 401 }
            );
        }

        // 2. Parse request
        const body = await request.json();
        console.log('📡 Trading triggered by Firebase:', body);

        // 3. Validate environment
        const appId = parseInt(process.env.DERIV_APP_ID || '');
        const apiToken = process.env.DERIV_API_TOKEN;
        
        if (!appId || !apiToken) {
            throw new Error('Missing Deriv credentials');
        }

        // 4. Initialize StarBot if not exists
        if (!tradingBot) {
            tradingBot = new StarBotTradingLogic(sequelize, {
                appId: appId,
                token: apiToken,
                wsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3'
            });

            // Initialize bot on first run
            await tradingBot.initializeBot();
        }

        // 5. Process trading cycle
        console.log('🔄 Processing trading cycle...');
        await tradingBot.processTradingCycle();

        const duration_ms = Date.now() - startTime;
        const botState = tradingBot.getBotState();

        console.log(`✅ Trading cycle completed (${duration_ms}ms)`);

        return NextResponse.json({
            success: true,
            message: 'Trading cycle processed successfully',
            botState: {
                isInitialized: botState.isInitialized,
                isWaitingForSignal: botState.isWaitingForSignal,
                activeSessionId: botState.activeSessionId,
                lastProcessedCandle: botState.lastProcessedCandle
            },
            duration_ms: duration_ms,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('❌ Trading cycle error:', error);
        
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

export async function GET(): Promise<NextResponse> {
    try {
        if (!tradingBot) {
            return NextResponse.json({
                status: 'ready',
                message: 'StarBot trading logic is ready to initialize',
                config: {
                    derivAppId: process.env.DERIV_APP_ID || 'not set',
                    derivWsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3',
                    cronSecretRequired: !!process.env.CRON_SECRET
                },
                timestamp: new Date().toISOString()
            });
        }

        const botState = tradingBot.getBotState();
        const seededTables = tradingBot.getSeededTables();

        return NextResponse.json({
            status: 'running',
            message: 'StarBot trading logic is active',
            botState: {
                isInitialized: botState.isInitialized,
                isWaitingForSignal: botState.isWaitingForSignal,
                activeSessionId: botState.activeSessionId,
                sessionStartTime: botState.sessionStartTime,
                lastProcessedCandle: botState.lastProcessedCandle
            },
            seededTables: seededTables.map(t => ({
                pattern: t.pattern,
                trend: t.info.trend,
                excludeFromTrading: t.info.excludeFromTrading,
                betLevel: t.info.betLevel
            })),
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('❌ Error retrieving bot status:', error);
        
        return NextResponse.json({
            status: 'error',
            error: error.message || 'Failed to retrieve bot status',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

// OPTIONS endpoint - CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-cron-secret'
        }
    });
}