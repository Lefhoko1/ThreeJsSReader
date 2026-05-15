import WebSocket from 'ws';
import mysql from 'mysql2/promise';

// ─── Database Config ───────────────────────────────────────────────────────
const DB_CONFIG = {
  host: 'sql5.freesqldatabase.com',
  user: 'sql5826978',
  password: 'Cd5wHyRQbs',
  database: 'sql5826978',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

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

export class DerivTradingService {
  private ws: WebSocket | null = null;
  private config: DerivConfig;
  private messageId: number = 1;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private isConnected: boolean = false;
  private pool: mysql.Pool;

  constructor(config: DerivConfig) {
    this.config = config;
    this.pool = mysql.createPool(DB_CONFIG);
  }

  /**
   * Create tables if they don't exist
   */
  private async createTables(): Promise<void> {
    // Create trades table
    const createTradesTableSQL = `
      CREATE TABLE IF NOT EXISTS trade_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contract_id VARCHAR(255) NOT NULL UNIQUE,
        symbol VARCHAR(50) NOT NULL,
        contract_type ENUM('CALL', 'PUT') NOT NULL,
        amount DECIMAL(20, 8) NOT NULL,
        duration INT NOT NULL,
        duration_unit ENUM('t', 's', 'm', 'h') NOT NULL,
        buy_price DECIMAL(20, 8) NOT NULL,
        sell_price DECIMAL(20, 8),
        payout DECIMAL(20, 8),
        profit DECIMAL(20, 8),
        start_time DATETIME NOT NULL,
        expiry_time DATETIME,
        status ENUM('open', 'closed', 'expired', 'cancelled') DEFAULT 'open',
        balance_before DECIMAL(20, 8),
        balance_after DECIMAL(20, 8),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_contract_id (contract_id),
        INDEX idx_symbol (symbol),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.pool.execute(createTradesTableSQL);
    
    // Create transaction log table
    const createLogTableSQL = `
      CREATE TABLE IF NOT EXISTS transaction_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        trade_id INT,
        contract_id VARCHAR(255),
        details JSON,
        timestamp DATETIME NOT NULL,
        INDEX idx_type (type),
        INDEX idx_trade_id (trade_id),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.pool.execute(createLogTableSQL);
    
    console.log('✅ Trade tables created or already exist');
  }

  /**
   * Get next trade ID
   */
  private async getNextTradeId(): Promise<number> {
    const [rows] = await this.pool.execute('SELECT MAX(id) as max_id FROM trade_history');
    const maxId = (rows as any[])[0]?.max_id || 0;
    return maxId + 1;
  }

  /**
   * Log a transaction
   */
  private async logTransaction(transaction: any): Promise<void> {
    const insertSQL = `
      INSERT INTO transaction_log (type, trade_id, contract_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this.pool.execute(insertSQL, [
      transaction.type,
      transaction.trade_id || null,
      transaction.contract_id || null,
      JSON.stringify(transaction),
      transaction.timestamp || new Date().toISOString()
    ]);
  }

  /**
   * Save a trade record
   */
  private async saveTradeRecord(trade: Partial<TradeRecord>): Promise<TradeRecord> {
    const now = new Date().toISOString();
    const newId = await this.getNextTradeId();
    
    const insertSQL = `
      INSERT INTO trade_history (
        id, contract_id, symbol, contract_type, amount, duration, duration_unit,
        buy_price, sell_price, payout, profit, start_time, expiry_time, status,
        balance_before, balance_after, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.pool.execute(insertSQL, [
      newId,
      trade.contract_id || '',
      trade.symbol || '',
      trade.contract_type || 'CALL',
      trade.amount || 0,
      trade.duration || 0,
      trade.duration_unit || 't',
      trade.buy_price || 0,
      trade.sell_price || null,
      trade.payout || null,
      trade.profit || null,
      trade.start_time || now,
      trade.expiry_time || null,
      trade.status || 'open',
      trade.balance_before || null,
      trade.balance_after || null,
      now,
      now
    ]);
    
    // Log the transaction
    await this.logTransaction({
      type: 'trade_created',
      trade_id: newId,
      contract_id: trade.contract_id,
      symbol: trade.symbol,
      amount: trade.amount,
      contract_type: trade.contract_type,
      timestamp: now
    });
    
    // Return the created record
    return this.getTradeByContractId(trade.contract_id || '') as Promise<TradeRecord>;
  }

  /**
   * Update a trade record
   */
  private async updateTradeRecord(contractId: string, updates: Partial<TradeRecord>): Promise<TradeRecord | null> {
    // First get the existing record
    const existing = await this.getTradeByContractId(contractId);
    if (!existing) return null;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (updates.sell_price !== undefined) {
      updateFields.push('sell_price = ?');
      values.push(updates.sell_price);
    }
    if (updates.payout !== undefined) {
      updateFields.push('payout = ?');
      values.push(updates.payout);
    }
    if (updates.profit !== undefined) {
      updateFields.push('profit = ?');
      values.push(updates.profit);
    }
    if (updates.expiry_time !== undefined) {
      updateFields.push('expiry_time = ?');
      values.push(updates.expiry_time);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.balance_after !== undefined) {
      updateFields.push('balance_after = ?');
      values.push(updates.balance_after);
    }
    
    if (updateFields.length === 0) return existing;
    
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(contractId);
    
    const updateSQL = `UPDATE trade_history SET ${updateFields.join(', ')} WHERE contract_id = ?`;
    await this.pool.execute(updateSQL, values);
    
    // Log the update
    await this.logTransaction({
      type: 'trade_updated',
      trade_id: existing.id,
      contract_id: contractId,
      updates: Object.keys(updates),
      timestamp: new Date().toISOString()
    });
    
    return this.getTradeByContractId(contractId);
  }

  /**
   * Get trade by contract ID
   */
  async getTradeByContractId(contractId: string): Promise<TradeRecord | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM trade_history WHERE contract_id = ?',
      [contractId]
    );
    
    const trades = rows as TradeRecord[];
    return trades.length > 0 ? trades[0] : null;
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
    let query = 'SELECT * FROM trade_history WHERE 1=1';
    const params: any[] = [];
    
    if (options?.symbol) {
      query += ' AND symbol = ?';
      params.push(options.symbol);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.startDate) {
      query += ' AND created_at >= ?';
      params.push(options.startDate);
    }
    if (options?.endDate) {
      query += ' AND created_at <= ?';
      params.push(options.endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }
    
    const [rows] = await this.pool.execute(query, params);
    return rows as TradeRecord[];
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
    let query = 'SELECT * FROM trade_history WHERE status = "closed"';
    const params: any[] = [];
    
    if (symbol) {
      query += ' AND symbol = ?';
      params.push(symbol);
    }
    
    const [rows] = await this.pool.execute(query, params);
    const trades = rows as TradeRecord[];
    
    const closedTrades = trades.filter(t => t.status === 'closed' && t.profit !== undefined);
    const winningTrades = closedTrades.filter(t => (t.profit || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.profit || 0) < 0);
    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const profits = closedTrades.map(t => t.profit || 0);
    
    // Get total count including open trades
    let countQuery = 'SELECT COUNT(*) as total FROM trade_history';
    const countParams: any[] = [];
    if (symbol) {
      countQuery += ' WHERE symbol = ?';
      countParams.push(symbol);
    }
    
    const [countResult] = await this.pool.execute(countQuery, countParams);
    const totalTrades = (countResult as any[])[0].total;
    
    return {
      totalTrades: totalTrades,
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
    await this.pool.execute('DELETE FROM trade_history');
    await this.pool.execute('DELETE FROM transaction_log');
    console.log('Trade history cleared');
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    await this.createTables();
    console.log('Database tables initialized');
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return; // Already connected
    }

    // Ensure tables exist
    await this.createTables();

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

  /**
   * Close database connection pool
   */
  async closeConnection(): Promise<void> {
    await this.pool.end();
    console.log('Database connection closed');
  }
}