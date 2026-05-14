import WebSocket from 'ws';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DerivConfig {
  appId: number;
  token: string;
  wsUrl: string;
}

export interface BinaryOptionsParams {
  amount: number;
  contract_type: 'CALL' | 'PUT';
  duration: number;
  duration_unit: 't' | 's' | 'm' | 'h';
  symbol: string;
  barrier?: number;
  basis?: 'stake' | 'payout';
}

export interface TradeResult {
  success: boolean;
  contract_id?: string;
  buy_price?: number;
  sell_price?: number;
  payout?: number;
  profit?: number;
  start_time?: string;
  expiry_time?: string;
  balance?: number;
  error?: string;
  timestamp: string;
}

export interface TradeRecord {
  id: number;
  contract_id: string;
  symbol: string;
  contract_type: 'CALL' | 'PUT';
  amount: number;
  duration: number;
  duration_unit: 't' | 's' | 'm' | 'h';
  buy_price: number;
  sell_price?: number;
  payout?: number;
  profit?: number;
  start_time: string;
  expiry_time?: string;
  status: 'open' | 'closed' | 'expired' | 'cancelled';
  balance_before?: number;
  balance_after?: number;
  created_at: string;
  updated_at: string;
}

// Data directory for storing trade history
const DATA_DIR = path.join(process.cwd(), 'data', 'trades');

export class DerivTradingService {
  private ws: WebSocket | null = null;
  private config: DerivConfig;
  private messageId: number = 1;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private isConnected: boolean = false;
  private dataDir: string;

  constructor(config: DerivConfig) {
    this.config = config;
    this.dataDir = DATA_DIR;
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get file path for trade history
   */
  private getTradeHistoryPath(): string {
    return path.join(this.dataDir, 'trade_history.json');
  }

  /**
   * Get file path for transaction log
   */
  private getTransactionLogPath(): string {
    return path.join(this.dataDir, 'transaction_log.json');
  }

  /**
   * Load trades from JSON file
   */
  private async loadTrades(): Promise<TradeRecord[]> {
    const filePath = this.getTradeHistoryPath();
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to load trades: ${error.message}`);
    }
  }

  /**
   * Save trades to JSON file
   */
  private async saveTrades(trades: TradeRecord[]): Promise<void> {
    const filePath = this.getTradeHistoryPath();
    await fs.writeFile(filePath, JSON.stringify(trades, null, 2), 'utf-8');
  }

  /**
   * Load transaction log
   */
  private async loadTransactionLog(): Promise<any[]> {
    const filePath = this.getTransactionLogPath();
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to load transaction log: ${error.message}`);
    }
  }

  /**
   * Save transaction log
   */
  private async saveTransactionLog(logs: any[]): Promise<void> {
    const filePath = this.getTransactionLogPath();
    await fs.writeFile(filePath, JSON.stringify(logs, null, 2), 'utf-8');
  }

  /**
   * Get next trade ID
   */
  private async getNextTradeId(): Promise<number> {
    const trades = await this.loadTrades();
    if (trades.length === 0) return 1;
    return Math.max(...trades.map(t => t.id)) + 1;
  }

  /**
   * Log a transaction
   */
  private async logTransaction(transaction: any): Promise<void> {
    const logs = await this.loadTransactionLog();
    logs.push({
      ...transaction,
      id: logs.length + 1,
      timestamp: new Date().toISOString()
    });
    await this.saveTransactionLog(logs);
  }

  /**
   * Save a trade record
   */
  private async saveTradeRecord(trade: Partial<TradeRecord>): Promise<TradeRecord> {
    const trades = await this.loadTrades();
    const now = new Date().toISOString();
    
    const newTrade: TradeRecord = {
      id: await this.getNextTradeId(),
      contract_id: trade.contract_id || '',
      symbol: trade.symbol || '',
      contract_type: trade.contract_type || 'CALL',
      amount: trade.amount || 0,
      duration: trade.duration || 0,
      duration_unit: trade.duration_unit || 't',
      buy_price: trade.buy_price || 0,
      sell_price: trade.sell_price,
      payout: trade.payout,
      profit: trade.profit,
      start_time: trade.start_time || now,
      expiry_time: trade.expiry_time,
      status: trade.status || 'open',
      balance_before: trade.balance_before,
      balance_after: trade.balance_after,
      created_at: now,
      updated_at: now
    };
    
    trades.push(newTrade);
    await this.saveTrades(trades);
    
    // Log the transaction
    await this.logTransaction({
      type: 'trade_created',
      trade_id: newTrade.id,
      contract_id: newTrade.contract_id,
      symbol: newTrade.symbol,
      amount: newTrade.amount,
      contract_type: newTrade.contract_type
    });
    
    return newTrade;
  }

  /**
   * Update a trade record
   */
  private async updateTradeRecord(contractId: string, updates: Partial<TradeRecord>): Promise<TradeRecord | null> {
    const trades = await this.loadTrades();
    const index = trades.findIndex(t => t.contract_id === contractId);
    
    if (index === -1) return null;
    
    trades[index] = {
      ...trades[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await this.saveTrades(trades);
    
    // Log the update
    await this.logTransaction({
      type: 'trade_updated',
      trade_id: trades[index].id,
      contract_id: contractId,
      updates: Object.keys(updates)
    });
    
    return trades[index];
  }

  /**
   * Get trade by contract ID
   */
  async getTradeByContractId(contractId: string): Promise<TradeRecord | null> {
    const trades = await this.loadTrades();
    return trades.find(t => t.contract_id === contractId) || null;
  }

  /**
   * Get all trades with optional filtering
   */
  async getTrades(options?: {
    symbol?: string;
    status?: 'open' | 'closed' | 'expired' | 'cancelled';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<TradeRecord[]> {
    let trades = await this.loadTrades();
    
    // Apply filters
    if (options?.symbol) {
      trades = trades.filter(t => t.symbol === options.symbol);
    }
    if (options?.status) {
      trades = trades.filter(t => t.status === options.status);
    }
    if (options?.startDate) {
      trades = trades.filter(t => new Date(t.created_at) >= options.startDate!);
    }
    if (options?.endDate) {
      trades = trades.filter(t => new Date(t.created_at) <= options.endDate!);
    }
    
    // Sort by creation date (newest first)
    trades.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Apply pagination
    if (options?.offset !== undefined) {
      const limit = options?.limit || 50;
      trades = trades.slice(options.offset, options.offset + limit);
    } else if (options?.limit) {
      trades = trades.slice(0, options.limit);
    }
    
    return trades;
  }

  /**
   * Get trade statistics
   */
  async getTradeStatistics(symbol?: string): Promise<{
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalProfit: number;
    winRate: number;
    averageProfit: number;
    bestTrade: number;
    worstTrade: number;
  }> {
    let trades = await this.loadTrades();
    
    if (symbol) {
      trades = trades.filter(t => t.symbol === symbol);
    }
    
    const closedTrades = trades.filter(t => t.status === 'closed' && t.profit !== undefined);
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const profits = closedTrades.map(t => t.profit || 0);
    
    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      totalProfit: totalProfit,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      averageProfit: closedTrades.length > 0 ? totalProfit / closedTrades.length : 0,
      bestTrade: profits.length > 0 ? Math.max(...profits) : 0,
      worstTrade: profits.length > 0 ? Math.min(...profits) : 0,
    };
  }

  /**
   * Clear all trade history (use with caution)
   */
  async clearTradeHistory(): Promise<void> {
    await this.saveTrades([]);
    await this.saveTransactionLog([]);
    console.log('Trade history cleared');
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      const url = `${this.config.wsUrl}?app_id=${this.config.appId}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', async () => {
        try {
          const authResponse = await this.send({ authorize: this.config.token });
          if (authResponse.error) {
            reject(new Error(`Authentication failed: ${authResponse.error.message}`));
          }
          console.log('✅ Authenticated with Deriv');
          this.isConnected = true;
          
          // Log connection
          await this.logTransaction({
            type: 'connection',
            status: 'connected',
            timestamp: new Date().toISOString()
          });
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const response = JSON.parse(data.toString());
        const reqId = response.req_id;

        if (reqId && this.pendingRequests.has(reqId)) {
          const { resolve, reject } = this.pendingRequests.get(reqId)!;
          this.pendingRequests.delete(reqId);

          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response);
          }
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', async () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.ws = null;
        
        // Log disconnection
        await this.logTransaction({
          type: 'connection',
          status: 'disconnected',
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  private async send(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const req_id = this.messageId++;
      const message = { ...request, req_id };

      this.pendingRequests.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify(message));

      // Timeout after 15 seconds
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

  async getProposal(params: {
    amount: number;
    basis: 'stake' | 'payout';
    contract_type: 'CALL' | 'PUT';
    currency: 'USD';
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h';
    symbol: string;
  }): Promise<any> {
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

  async placeTrade(params: BinaryOptionsParams): Promise<TradeResult> {
    const balanceBefore = await this.getBalance();
    
    try {
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
        return {
          success: false,
          error: buyResponse.error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Save trade record
      await this.saveTradeRecord({
        contract_id: buyResponse.buy.contract_id,
        symbol: params.symbol,
        contract_type: params.contract_type,
        amount: params.amount,
        duration: params.duration,
        duration_unit: params.duration_unit,
        buy_price: buyResponse.buy.buy_price,
        payout: buyResponse.buy.payout,
        start_time: buyResponse.buy.start_time,
        expiry_time: buyResponse.buy.expiry_time,
        status: 'open',
        balance_before: balanceBefore,
        balance_after: buyResponse.balance?.balance
      });

      return {
        success: true,
        contract_id: buyResponse.buy.contract_id,
        buy_price: buyResponse.buy.buy_price,
        sell_price: buyResponse.buy.sell_price,
        payout: buyResponse.buy.payout,
        profit: buyResponse.buy.profit,
        start_time: buyResponse.buy.start_time,
        expiry_time: buyResponse.buy.expiry_time,
        balance: buyResponse.balance?.balance,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async sellContract(contractId: string, price: number): Promise<TradeResult> {
    try {
      const response = await this.send({
        sell: contractId,
        price: price
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Update trade record
      const profit = response.sell.profit;
      await this.updateTradeRecord(contractId, {
        status: 'closed',
        sell_price: response.sell.sold_for,
        profit: profit,
        balance_after: response.balance?.balance
      });

      return {
        success: true,
        contract_id: contractId,
        sell_price: response.sell.sold_for,
        profit: profit,
        balance: response.balance?.balance,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  isConnectedToDeriv(): boolean {
    return this.isConnected;
  }
}