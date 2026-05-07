import { NextRequest, NextResponse } from 'next/server';
import WebSocket from 'ws';

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
    trade?: {
        contract_id: string;
        buy_price: number;
        sell_price?: number;
        payout?: number;
        profit?: number;
        start_time: string;
        expiry_time?: string;
    };
    proposal?: any;
    balance?: number;
    error?: string;
    timestamp: string;
}

// ============================================
// DERIV WEBSOCKET CLIENT
// ============================================

class DerivClient {
    private ws: WebSocket | null = null;
    private config: DerivConfig;
    private messageId: number = 1;
    private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();

    constructor(config: DerivConfig) {
        this.config = config;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = `${this.config.wsUrl}?app_id=${this.config.appId}`;
            this.ws = new WebSocket(url);

            this.ws.on('open', async () => {
                try {
                    const authResponse = await this.send({ authorize: this.config.token });
                    if (authResponse.error) {
                        reject(new Error(`Auth failed: ${authResponse.error.message}`));
                    }
                    console.log('✅ Authenticated with Deriv');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                const response = JSON.parse(data.toString());
                const reqId = response.req_id;
                
                if (reqId && this.pendingRequests.has(reqId)) {
                    const { resolve } = this.pendingRequests.get(reqId)!;
                    this.pendingRequests.delete(reqId);
                    
                    if (response.error) {
                        const { reject } = this.pendingRequests.get(reqId) || {};
                        if (reject) reject(response.error);
                    } else {
                        resolve(response);
                    }
                }
            });

            this.ws.on('error', reject);
        });
    }

    async send(request: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const req_id = this.messageId++;
            const message = { ...request, req_id };
            
            this.pendingRequests.set(req_id, { resolve, reject });
            this.ws.send(JSON.stringify(message));

            setTimeout(() => {
                if (this.pendingRequests.has(req_id)) {
                    this.pendingRequests.delete(req_id);
                    reject(new Error('Request timeout'));
                }
            }, 15000);
        });
    }

    async getBalance(): Promise<number> {
        const response = await this.send({ balance: 1 });
        return response.balance?.balance || 0;
    }

    async getProposal(params: ProposalRequest): Promise<any> {
        // First get a price proposal
        const proposal = await this.send({
            proposal: 1,
            amount: params.amount,
            basis: params.basis,
            contract_type: params.contract_type,
            currency: params.currency,
            duration: params.duration,
            duration_unit: params.duration_unit,
            symbol: params.symbol
        });
        
        if (proposal.error) {
            throw new Error(proposal.error.message);
        }
        
        return proposal;
    }

    async buyContract(params: BinaryOptionsParams): Promise<any> {
        // Step 1: Get proposal
        const proposal = await this.getProposal({
            amount: params.amount,
            basis: params.basis || 'stake',
            contract_type: params.contract_type,
            currency: 'USD',
            duration: params.duration,
            duration_unit: params.duration_unit,
            symbol: params.symbol
        });

        console.log(`📊 Proposal received: Ask price = ${proposal.proposal.ask_price}`);

        // Step 2: Execute buy
        const buyResponse = await this.send({
            buy: proposal.proposal.id,
            price: proposal.proposal.ask_price
        });

        if (buyResponse.error) {
            throw new Error(buyResponse.error.message);
        }

        return buyResponse;
    }

    async sellContract(contractId: string, price: number): Promise<any> {
        const response = await this.send({
            sell: contractId,
            price: price
        });
        
        if (response.error) {
            throw new Error(response.error.message);
        }
        
        return response;
    }

    subscribeToPrice(symbol: string, callback: (price: number) => void): void {
        if (!this.ws) return;
        
        this.send({
            ticks: symbol,
            subscribe: 1
        });
        
        // Handle incoming ticks
        this.ws.on('message', (data: WebSocket.Data) => {
            const response = JSON.parse(data.toString());
            if (response.tick) {
                callback(response.tick.quote);
            }
        });
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// ============================================
// TRADING STRATEGY & RISK MANAGEMENT
// ============================================

class TradingStrategy {
    private dailyTrades: number = 0;
    private dailyLoss: number = 0;
    private dailyProfit: number = 0;
    private lastTradeDate: string = '';

    constructor(
        private maxDailyTrades: number = 10,
        private maxDailyLoss: number = 100,
        private tradeAmount: number = 10
    ) {}

    private resetDailyCounters(): void {
        const today = new Date().toDateString();
        if (this.lastTradeDate !== today) {
            this.dailyTrades = 0;
            this.dailyLoss = 0;
            this.dailyProfit = 0;
            this.lastTradeDate = today;
            console.log('📊 Daily counters reset');
        }
    }

    shouldTrade(currentBalance: number, currentPrice?: number): { allowed: boolean; reason: string } {
        this.resetDailyCounters();
        
        if (this.dailyTrades >= this.maxDailyTrades) {
            return { allowed: false, reason: `Daily trade limit reached (${this.maxDailyTrades})` };
        }
        
        if (this.dailyLoss >= this.maxDailyLoss) {
            return { allowed: false, reason: `Daily loss limit reached ($${this.maxDailyLoss})` };
        }
        
        if (currentBalance < this.tradeAmount) {
            return { allowed: false, reason: `Insufficient balance: $${currentBalance} < $${this.tradeAmount}` };
        }
        
        return { allowed: true, reason: 'All conditions met' };
    }

    decideDirection(currentPrice: number, previousPrice?: number): 'CALL' | 'PUT' {
        // Simple momentum strategy
        // You can replace this with your own strategy (RSI, Bollinger, etc.)
        if (!previousPrice) {
            return Math.random() > 0.5 ? 'CALL' : 'PUT';
        }
        
        // If price is going up, predict CALL, else PUT
        return currentPrice > previousPrice ? 'CALL' : 'PUT';
    }

    recordTrade(outcome: 'win' | 'loss', profitLoss: number): void {
        this.dailyTrades++;
        if (outcome === 'loss') {
            this.dailyLoss += Math.abs(profitLoss);
        } else {
            this.dailyProfit += profitLoss;
        }
        console.log(`📈 Trade recorded: ${outcome}, P/L: $${profitLoss}`);
    }

    getStats(): object {
        return {
            dailyTrades: this.dailyTrades,
            dailyProfit: this.dailyProfit,
            dailyLoss: this.dailyLoss,
            maxDailyTrades: this.maxDailyTrades,
            maxDailyLoss: this.maxDailyLoss,
            tradeAmount: this.tradeAmount,
            lastTradeDate: this.lastTradeDate,
            winRate: this.dailyTrades > 0 ? (this.dailyProfit / (this.dailyProfit + this.dailyLoss) * 100).toFixed(2) : 0
        };
    }
}

// ============================================
// MAIN API ENDPOINT
// ============================================

// Initialize strategy
const strategy = new TradingStrategy(
    parseInt(process.env.MAX_DAILY_TRADES || '10'),
    parseFloat(process.env.MAX_DAILY_LOSS || '100'),
    parseFloat(process.env.DERIV_TRADE_AMOUNT || '10')
);

// Store last price for strategy
let lastPrice: number | undefined;

export async function POST(request: NextRequest): Promise<NextResponse<TradeResponse>> {
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
        console.log('📡 Trading triggered:', body);

        // 3. Validate environment
        const appId = parseInt(process.env.DERIV_APP_ID || '');
        const apiToken = process.env.DERIV_API_TOKEN;
        
        if (!appId || !apiToken) {
            throw new Error('Missing Deriv credentials');
        }

        // 4. Connect to Deriv
        const derivClient = new DerivClient({
            appId: appId,
            token: apiToken,
            wsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3'
        });

        await derivClient.connect();

        // 5. Get balance
        const balance = await derivClient.getBalance();
        console.log(`💰 Balance: $${balance}`);

        // 6. Get current price (for strategy)
        let currentPrice = 0;
        await new Promise<void>((resolve) => {
            derivClient.subscribeToPrice(process.env.DERIV_SYMBOL || 'R_100', (price) => {
                currentPrice = price;
                resolve();
            });
            setTimeout(resolve, 2000); // Fallback after 2 seconds
        });

        // 7. Check if we should trade
        const { allowed, reason } = strategy.shouldTrade(balance, currentPrice);
        
        if (!allowed) {
            derivClient.disconnect();
            return NextResponse.json({
                success: false,
                error: reason,
                balance: balance,
                timestamp: new Date().toISOString()
            });
        }

        // 8. Decide trade direction (CALL/PUT)
        const direction = strategy.decideDirection(currentPrice, lastPrice);
        lastPrice = currentPrice;

        const tradeAmount = parseFloat(process.env.DERIV_TRADE_AMOUNT || '10');
        const symbol = process.env.DERIV_SYMBOL || 'R_100';
        const duration = parseInt(process.env.DERIV_DURATION || '5');
        const durationUnit = process.env.DERIV_DURATION_UNIT as 't' | 's' | 'm' | 'h' || 'm';

        console.log(`🚀 Placing ${direction} trade on ${symbol}`);
        console.log(`   Amount: $${tradeAmount}, Duration: ${duration}${durationUnit}`);
        console.log(`   Current price: ${currentPrice}`);

        // 9. Execute trade
        const tradeResult = await derivClient.buyContract({
            amount: tradeAmount,
            contract_type: direction,
            duration: duration,
            duration_unit: durationUnit,
            symbol: symbol,
            basis: 'stake'
        });

        // 10. Calculate expiry time
        const expiryTime = new Date();
        if (durationUnit === 't') {
            // For tick contracts, estimate based on average tick rate
            expiryTime.setSeconds(expiryTime.getSeconds() + duration * 2);
        } else if (durationUnit === 's') {
            expiryTime.setSeconds(expiryTime.getSeconds() + duration);
        } else if (durationUnit === 'm') {
            expiryTime.setMinutes(expiryTime.getMinutes() + duration);
        } else {
            expiryTime.setHours(expiryTime.getHours() + duration);
        }

        // 11. Disconnect
        derivClient.disconnect();

        // 12. Return response
        const duration_ms = Date.now() - startTime;
        console.log(`✅ Trade executed! Contract: ${tradeResult.buy.contract_id} (${duration_ms}ms)`);

        return NextResponse.json({
            success: true,
            trade: {
                contract_id: tradeResult.buy.contract_id,
                buy_price: tradeResult.buy.buy_price,
                payout: tradeResult.buy.payout,
                start_time: new Date().toISOString(),
                expiry_time: expiryTime.toISOString()
            },
            proposal: {
                direction: direction,
                current_price: currentPrice,
                duration: `${duration}${durationUnit}`
            },
            balance: balance,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('❌ Trading error:', error);
        
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

// GET endpoint - Health check with strategy stats
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        status: 'alive',
        message: 'Deriv binary options trading bot is running',
        config: {
            symbol: process.env.DERIV_SYMBOL || 'R_100',
            amount: process.env.DERIV_TRADE_AMOUNT || '10',
            duration: process.env.DERIV_DURATION || '5',
            duration_unit: process.env.DERIV_DURATION_UNIT || 'm',
            max_daily_trades: process.env.MAX_DAILY_TRADES || '10',
            max_daily_loss: process.env.MAX_DAILY_LOSS || '100'
        },
        strategy_stats: strategy.getStats(),
        timestamp: new Date().toISOString()
    });
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