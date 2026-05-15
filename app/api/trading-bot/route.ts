import { NextRequest, NextResponse } from 'next/server';
import { StarBotTradingLogic } from '@/app/lib/tradinglogic';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';

// ============================================
// TYPES FOR BINARY OPTIONS TRADING
// ============================================

interface DerivConfig {
    appId: number;
    token: string;
    wsUrl: string;
}

// ============================================
// MAIN API ENDPOINT
// ============================================

// Store trading bot instance
let tradingBot: StarBotTradingLogic | null = null;
let candleService: DerivDataCandleService | null = null;
let isCandleServiceInitialized = false;

// Hardcoded secret for authorization
const EXPECTED_SECRET = 'a3f8c2e1b7d4e9f0c6a2b5d8e1f4a7c0b3d6e9f2a5b8c1d4e7f0a3b6c9d2e5';

export async function POST(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    
    try {
        // 1. Authentication - using hardcoded secret
        const cronSecret = request.headers.get('x-cron-secret');
        if (cronSecret !== EXPECTED_SECRET) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
                { status: 401 }
            );
        }

        // 2. Parse request - with error handling for empty body
        let body = {};
        try {
            const text = await request.text();
            if (text) {
                body = JSON.parse(text);
            }
            console.log('📡 Trading triggered:', body);
        } catch (parseError) {
            console.log('📡 Trading triggered (no body or invalid JSON)');
        }

        // 3. Validate environment
        const appId = parseInt(process.env.DERIV_APP_ID || '1089');
        const apiToken = process.env.DERIV_API_TOKEN;
        
        if (!apiToken) {
            throw new Error('Missing Deriv API token');
        }

        // 4. Initialize Candle Service if not already initialized
        if (!candleService) {
            console.log('🕯️ Initializing DerivDataCandleService...');
            candleService = new DerivDataCandleService();
            await candleService.initialize();
            isCandleServiceInitialized = true;
            console.log('✅ Candle service initialized successfully');
        }

        // 5. Initialize StarBot if not exists
        if (!tradingBot) {
            console.log('🤖 Initializing StarBot...');
            tradingBot = new StarBotTradingLogic({
                appId: appId,
                token: apiToken,
                wsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3'
            });

            // Initialize bot on first run
            await tradingBot.initializeBot();
            console.log('✅ StarBot initialized successfully');
        }

        // 6. Process trading cycle
        console.log('🔄 Processing trading cycle...');
        await tradingBot.processTradingCycle();

        const duration_ms = Date.now() - startTime;
        const botState = tradingBot.getBotState();

        console.log(`✅ Trading cycle completed (${duration_ms}ms)`);

        return NextResponse.json({
            success: true,
            message: 'Trading cycle processed successfully',
            candleServiceStatus: {
                isInitialized: isCandleServiceInitialized,
                symbolsTracked: candleService ? 'active' : 'inactive'
            },
            botState: {
                isInitialized: botState.isInitialized,
                isWaitingForSignal: botState.isWaitingForSignal,
                activeSessionId: botState.activeSessionId,
                activeSymbol: botState.activeSymbol,
                lastProcessedCandle: botState.lastProcessedCandle
            },
            duration_ms: duration_ms,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('❌ Trading cycle error:', error);
        
        // Ensure we always return valid JSON
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

// Optional: Add a cleanup endpoint for graceful shutdown
export async function DELETE(): Promise<NextResponse> {
    try {
        if (candleService) {
            await candleService.closeConnection();
            candleService = null;
            isCandleServiceInitialized = false;
        }
        
        if (tradingBot) {
            await tradingBot.closeConnections();
            tradingBot = null;
        }
        
        return NextResponse.json({
            success: true,
            message: 'Services cleaned up successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

export async function GET(): Promise<NextResponse> {
    try {
        const status = {
            candleService: {
                isInitialized: isCandleServiceInitialized,
                isActive: candleService !== null
            },
            tradingBot: tradingBot ? {
                isInitialized: tradingBot.getBotState().isInitialized,
                isWaitingForSignal: tradingBot.getBotState().isWaitingForSignal,
                activeSessionId: tradingBot.getBotState().activeSessionId
            } : null
        };
        
        if (!tradingBot) {
            return NextResponse.json({
                status: 'ready',
                message: 'StarBot trading logic and candle service are ready to initialize',
                ...status,
                config: {
                    derivAppId: process.env.DERIV_APP_ID || '1089',
                    derivWsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3',
                    cronSecretRequired: 'Hardcoded - no env var needed'
                },
                timestamp: new Date().toISOString()
            });
        }

        const botState = tradingBot.getBotState();
        const seededTables = tradingBot.getSeededTables();

        return NextResponse.json({
            status: 'running',
            message: 'StarBot trading logic is active',
            ...status,
            botState: {
                isInitialized: botState.isInitialized,
                isWaitingForSignal: botState.isWaitingForSignal,
                activeSessionId: botState.activeSessionId,
                activeSymbol: botState.activeSymbol,
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
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-cron-secret'
        }
    });
}