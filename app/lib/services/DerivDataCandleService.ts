import WebSocket from 'ws';
import { ALL_VOLATILITY_SYMBOLS } from '../constants/volatilitySymbols';
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

// ─── Config ───────────────────────────────────────────────────────
const DERIV_APP_ID = process.env.DERIV_APP_ID ? parseInt(process.env.DERIV_APP_ID, 10) : 1089;
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const GRANULARITY = 1800; // 30 minutes

// Candle interface
interface Candle {
  id: number;
  granularity: number;
  epoch: number;
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Symbol configuration matching working script
interface SymbolConfig {
  name: string;
  table: string;
  display: string;
}

const SYMBOLS_CONFIG: SymbolConfig[] = [
  { name: "R_10", table: "candles_r_10", display: "Volatility 10 Index" },
  { name: "R_25", table: "candles_r_25", display: "Volatility 25 Index" },
  { name: "R_50", table: "candles_r_50", display: "Volatility 50 Index" },
  { name: "R_75", table: "candles_r_75", display: "Volatility 75 Index" },
  { name: "R_100", table: "candles_r_100", display: "Volatility 100 Index" },
  { name: "1HZ10V", table: "candles_1hz10v", display: "Volatility 10 Index (1s)" },
  { name: "1HZ25V", table: "candles_1hz25v", display: "Volatility 25 Index (1s)" },
  { name: "1HZ50V", table: "candles_1hz50v", display: "Volatility 50 Index (1s)" },
  { name: "1HZ75V", table: "candles_1hz75v", display: "Volatility 75 Index (1s)" },
  { name: "1HZ100V", table: "candles_1hz100v", display: "Volatility 100 Index (1s)" }
];

export class DerivDataCandleService {
  private symbols: SymbolConfig[] = [...SYMBOLS_CONFIG];
  private ws: WebSocket | null = null;
  private appId: number;
  private pool: mysql.Pool;

  constructor() {
    this.appId = DERIV_APP_ID;
    this.pool = mysql.createPool(DB_CONFIG);
  }

  /**
   * Format date like working script
   */
  private formatDate(epoch: number): string {
    return new Date(epoch * 1000).toISOString().replace("T", " ").replace("Z", "");
  }

  /**
   * Sleep helper - matches working script exactly
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get table name for a symbol
   */
  private getTableName(symbolConfig: SymbolConfig): string {
    return symbolConfig.table;
  }

  /**
   * Create table for a specific symbol
   */
  private async createTableForSymbol(symbolConfig: SymbolConfig): Promise<void> {
    const tableName = this.getTableName(symbolConfig);
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        granularity INT NOT NULL,
        epoch BIGINT NOT NULL,
        datetime DATETIME NOT NULL,
        open DECIMAL(20, 8) NOT NULL,
        high DECIMAL(20, 8) NOT NULL,
        low DECIMAL(20, 8) NOT NULL,
        close DECIMAL(20, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_epoch (epoch),
        INDEX idx_epoch (epoch),
        INDEX idx_datetime (datetime)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.pool.execute(createTableSQL);
    console.log(`✅ Table "${tableName}" created or already exists.`);
  }

  /**
   * Create tables for all candle patterns.
   */
  async createTables(): Promise<void> {
    for (const symbolConfig of this.symbols) {
      await this.createTableForSymbol(symbolConfig);
    }
    console.log('All candle tables created or verified.');
  }

  /**
   * Load candles from database for a symbol
   */
  private async loadCandles(symbolConfig: SymbolConfig): Promise<Candle[]> {
    const tableName = this.getTableName(symbolConfig);
    
    const [rows] = await this.pool.execute(`SELECT * FROM ${tableName} ORDER BY epoch ASC`);
    return rows as Candle[];
  }

  /**
   * Save candles to database for a symbol
   */
  private async saveCandles(symbolConfig: SymbolConfig, candles: Candle[]): Promise<void> {
    const tableName = this.getTableName(symbolConfig);
    
    // Clear existing data
    await this.pool.execute(`DELETE FROM ${tableName}`);
    
    // Insert all candles
    if (candles.length === 0) return;
    
    const insertSQL = `
      INSERT INTO ${tableName} (id, granularity, epoch, datetime, open, high, low, close)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const candle of candles) {
      await this.pool.execute(insertSQL, [
        candle.id,
        candle.granularity,
        candle.epoch,
        candle.datetime,
        candle.open,
        candle.high,
        candle.low,
        candle.close
      ]);
    }
  }

  /**
   * Get next ID for a symbol
   */
  private async getNextId(symbolConfig: SymbolConfig): Promise<number> {
    const tableName = this.getTableName(symbolConfig);
    
    const [rows] = await this.pool.execute(`SELECT MAX(id) as max_id FROM ${tableName}`);
    const maxId = (rows as any[])[0]?.max_id || 0;
    return maxId + 1;
  }

  /**
   * Get the latest epoch from database for a symbol
   */
  private async getLatestEpochFromDB(symbolConfig: SymbolConfig): Promise<number | null> {
    const tableName = this.getTableName(symbolConfig);
    
    const [rows] = await this.pool.execute(`SELECT MAX(epoch) as latest_epoch FROM ${tableName}`);
    const latest = (rows as any[])[0]?.latest_epoch;
    return latest ? Number(latest) : null;
  }

  /**
   * Calculate the last completed candle epoch (30-minute boundary)
   */
  private getLastCompletedCandleEpoch(): number {
    const now = Math.floor(Date.now() / 1000);
    // Current 30-minute candle open time
    const currentCandleOpen = now - (now % GRANULARITY);
    // Last completed candle closed at currentCandleOpen
    return currentCandleOpen - GRANULARITY;
  }

  /**
   * Fetch only the latest completed candle for a symbol (incremental update)
   */
  private async fetchLatestCompletedCandle(symbolConfig: SymbolConfig): Promise<any | null> {
    return new Promise((resolve, reject) => {
      console.log(`\n📊 Checking ${symbolConfig.display} (${symbolConfig.name})...`);
      
      const ws = new WebSocket(WS_URL);
      let done = false;

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          ws.terminate();
          reject(new Error(`Timeout fetching ${symbolConfig.name}`));
        }
      }, 30000);

      ws.on("open", () => {
        // Request only the last 2 candles to get the most recent completed one
        ws.send(JSON.stringify({
          ticks_history: symbolConfig.name,
          style: "candles",
          granularity: GRANULARITY,
          count: 2,  // Only fetch last 2 candles
          end: "latest"
        }));
      });

      ws.on("message", (data) => {
        let response;
        try {
          response = JSON.parse(data.toString());
        } catch (err) {
          clearTimeout(timeout);
          done = true;
          ws.close();
          reject(new Error(`Failed to parse response`));
          return;
        }

        if (response.error) {
          clearTimeout(timeout);
          done = true;
          ws.close();
          reject(new Error(`API error: ${response.error.message}`));
          return;
        }

        if (response.msg_type === "candles") {
          clearTimeout(timeout);
          
          const candles = response.candles;
          console.log(`   📈 Received ${candles.length} candles`);
          
          if (!candles || candles.length === 0) {
            ws.close();
            reject(new Error("No candles returned"));
            return;
          }
          
          // Determine the last completed candle
          const lastCompletedEpoch = this.getLastCompletedCandleEpoch();
          
          let latestCandle = null;
          
          // Check which candle is the last completed one
          if (candles[0].epoch <= lastCompletedEpoch) {
            latestCandle = candles[0];
          } else if (candles.length > 1 && candles[1].epoch <= lastCompletedEpoch) {
            latestCandle = candles[1];
          }
          
          if (!latestCandle) {
            console.log(`   ⚠️ No completed candle found yet (waiting for current candle to close)`);
            ws.close();
            resolve(null);
            return;
          }
          
          const now = Math.floor(Date.now() / 1000);
          const hoursAgo = (now - latestCandle.epoch) / 3600;
          
          console.log(`   🕯️ Latest completed candle: ${this.formatDate(latestCandle.epoch)}`);
          console.log(`   ⏰ Age: ${hoursAgo.toFixed(1)} hours old`);
          console.log(`   📊 OHLC: O=${latestCandle.open} H=${latestCandle.high} L=${latestCandle.low} C=${latestCandle.close}`);
          
          ws.close();
          resolve(latestCandle);
        }
      });

      ws.on("error", (err) => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          reject(new Error(`WebSocket error: ${err.message}`));
        }
      });
    });
  }

  /**
   * Append a single candle to database
   */
  private async appendCandleToDB(symbolConfig: SymbolConfig, candle: any): Promise<void> {
    const tableName = this.getTableName(symbolConfig);
    
    // Check if candle with this epoch already exists
    const [existing] = await this.pool.execute(
      `SELECT id FROM ${tableName} WHERE epoch = ?`,
      [candle.epoch]
    );
    
    if ((existing as any[]).length > 0) {
      console.log(`   ⚠️ Candle epoch ${candle.epoch} already exists, skipping`);
      return;
    }
    
    const newId = await this.getNextId(symbolConfig);
    
    const insertSQL = `
      INSERT INTO ${tableName} (id, granularity, epoch, datetime, open, high, low, close)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.pool.execute(insertSQL, [
      newId,
      GRANULARITY,
      candle.epoch,
      this.formatDate(candle.epoch),
      parseFloat(candle.open),
      parseFloat(candle.high),
      parseFloat(candle.low),
      parseFloat(candle.close)
    ]);
    
    console.log(`   💾 Appended to table: ${tableName}`);
  }

  /**
   * Update latest candles for all symbols (incremental update)
   * This method only adds new candles, never overwrites existing data
   */
  async updateLatestCandles(): Promise<{ totalAdded: number; results: any[] }> {
    console.log(`🚀 Starting incremental update - fetching latest completed candles only...`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    
    const lastCompletedEpoch = this.getLastCompletedCandleEpoch();
    const lastCompletedTime = new Date(lastCompletedEpoch * 1000).toISOString();
    console.log(`\n🎯 Target: Last completed candle at ${lastCompletedTime}`);
    console.log(`\n${"=".repeat(60)}`);
    
    const results = [];
    let totalAdded = 0;
    
    for (const symbolConfig of this.symbols) {
      try {
        // Get the latest epoch already in database
        const latestEpochInDB = await this.getLatestEpochFromDB(symbolConfig);
        
        // Fetch the latest completed candle from Deriv
        const latestCandle = await this.fetchLatestCompletedCandle(symbolConfig);
        
        if (!latestCandle) {
          console.log(`   ⏳ No new candle available yet`);
          results.push({ 
            symbol: symbolConfig.name, 
            success: true, 
            added: false, 
            reason: "No new candle available" 
          });
          continue;
        }
        
        // Check if we already have this candle
        if (latestEpochInDB && latestCandle.epoch <= latestEpochInDB) {
          console.log(`   ✅ Already have latest candle (epoch: ${latestCandle.epoch})`);
          results.push({ 
            symbol: symbolConfig.name, 
            success: true, 
            added: false, 
            reason: "Already exists",
            epoch: latestCandle.epoch
          });
        } else {
          // New candle - append to database
          await this.appendCandleToDB(symbolConfig, latestCandle);
          totalAdded++;
          results.push({ 
            symbol: symbolConfig.name, 
            success: true, 
            added: true, 
            epoch: latestCandle.epoch,
            date: this.formatDate(latestCandle.epoch)
          });
          console.log(`   ✅ Added new candle!`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ❌ Failed: ${errorMessage}`);
        results.push({ symbol: symbolConfig.name, success: false, error: errorMessage });
      }
      
      // Wait 1 second between requests to be polite to the API
      if (this.symbols.indexOf(symbolConfig) < this.symbols.length - 1) {
        console.log(`   ⏳ Waiting 1 second before next request...`);
        await this.sleep(1000);
      }
    }
    
    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 UPDATE SUMMARY:`);
    console.log(`   ✅ Successful: ${results.filter(r => r.success).length}/${this.symbols.length}`);
    console.log(`   ➕ New candles added: ${totalAdded}`);
    
    if (totalAdded > 0) {
      console.log(`\n   New candles added for:`);
      results.filter(r => r.added).forEach(r => {
        console.log(`      - ${r.symbol}: ${r.date} (epoch: ${r.epoch})`);
      });
    }
    
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log(`\n   ❌ Failed: ${failed.map(f => f.symbol).join(", ")}`);
    }
    
    console.log(`⏰ Finished at: ${new Date().toISOString()}`);
    
    return { totalAdded, results };
  }

  /**
   * Fetch previous completed candle (for strategy reference)
   */
  async fetchPreviousCompletedCandle(symbol: string): Promise<Candle | null> {
    try {
      const symbolConfig = this.symbols.find(s => s.name === symbol);
      if (!symbolConfig) return null;
      
      const tableName = this.getTableName(symbolConfig);
      
      const [rows] = await this.pool.execute(
        `SELECT * FROM ${tableName} ORDER BY epoch DESC LIMIT 1`
      );
      
      const candles = rows as Candle[];
      return candles.length > 0 ? candles[0] : null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error fetching previous candle for ${symbol}:`, errorMessage);
      return null;
    }
  }

  /**
   * Get all candles for a symbol (with optional date range)
   */
  async getCandles(symbol: string, options?: { 
    startDate?: Date; 
    endDate?: Date; 
    limit?: number;
    offset?: number;
  }): Promise<Candle[]> {
    const symbolConfig = this.symbols.find(s => s.name === symbol);
    if (!symbolConfig) return [];
    
    const tableName = this.getTableName(symbolConfig);
    let query = `SELECT * FROM ${tableName} WHERE 1=1`;
    const params: any[] = [];
    
    // Filter by date range
    if (options?.startDate) {
      query += ` AND datetime >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      query += ` AND datetime <= ?`;
      params.push(options.endDate);
    }
    
    // Order by epoch ascending
    query += ` ORDER BY epoch ASC`;
    
    // Apply pagination
    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
      
      if (options?.offset) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }
    }
    
    const [rows] = await this.pool.execute(query, params);
    return rows as Candle[];
  }

  /**
   * Get the latest candle for a symbol
   */
  async getLatestCandle(symbol: string): Promise<Candle | null> {
    const symbolConfig = this.symbols.find(s => s.name === symbol);
    if (!symbolConfig) return null;
    
    const tableName = this.getTableName(symbolConfig);
    
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${tableName} ORDER BY epoch DESC LIMIT 1`
    );
    
    const candles = rows as Candle[];
    return candles.length > 0 ? candles[0] : null;
  }

  /**
   * Get statistics for a symbol
   */
  async getStatistics(symbol: string): Promise<{ 
    totalCandles: number; 
    firstCandle: Candle | null; 
    lastCandle: Candle | null;
    dateRange: { from: Date | null; to: Date | null };
  }> {
    const symbolConfig = this.symbols.find(s => s.name === symbol);
    if (!symbolConfig) {
      return {
        totalCandles: 0,
        firstCandle: null,
        lastCandle: null,
        dateRange: { from: null, to: null }
      };
    }
    
    const tableName = this.getTableName(symbolConfig);
    
    // Get total count
    const [countResult] = await this.pool.execute(`SELECT COUNT(*) as total FROM ${tableName}`);
    const totalCandles = (countResult as any[])[0].total;
    
    if (totalCandles === 0) {
      return {
        totalCandles: 0,
        firstCandle: null,
        lastCandle: null,
        dateRange: { from: null, to: null }
      };
    }
    
    // Get first and last candles
    const [firstResult] = await this.pool.execute(
      `SELECT * FROM ${tableName} ORDER BY epoch ASC LIMIT 1`
    );
    
    const [lastResult] = await this.pool.execute(
      `SELECT * FROM ${tableName} ORDER BY epoch DESC LIMIT 1`
    );
    
    const firstCandle = (firstResult as Candle[])[0];
    const lastCandle = (lastResult as Candle[])[0];
    
    return {
      totalCandles,
      firstCandle,
      lastCandle,
      dateRange: {
        from: firstCandle ? new Date(firstCandle.datetime) : null,
        to: lastCandle ? new Date(lastCandle.datetime) : null,
      }
    };
  }

  /**
   * Check if data exists for a symbol
   */
  async hasData(symbol: string): Promise<boolean> {
    const symbolConfig = this.symbols.find(s => s.name === symbol);
    if (!symbolConfig) return false;
    
    const tableName = this.getTableName(symbolConfig);
    
    const [rows] = await this.pool.execute(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
    return (rows as any[])[0].count > 0;
  }

  /**
   * Get all available symbols
   */
  getSymbols(): string[] {
    return this.symbols.map(s => s.name);
  }

  /**
   * Initialize service - fetches initial 1000 candles if no data exists
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing DerivDataCandleService...');
    await this.createTables();
    
    const firstSymbol = this.symbols[0];
    const hasExistingData = await this.hasData(firstSymbol.name);
    
    if (!hasExistingData) {
      console.log('📊 No existing data found, fetching initial 1000 candles...');
      await this.fetchInitialCandles();
    } else {
      console.log('🔄 Existing data found, updating only latest candles...');
      await this.updateLatestCandles();
    }
    
    console.log('✅ Candle service initialization completed successfully!');
  }

  /**
   * Fetch initial 1000 candles for all symbols
   */
  async fetchInitialCandles(): Promise<{ totalInserted: number; results: any[] }> {
    console.log(`🚀 Starting to fetch all Volatility Indices...`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`\n${"=".repeat(60)}`);
    
    const results = [];
    let totalInserted = 0;

    for (const symbolConfig of this.symbols) {
      try {
        // Fetch candles from Deriv
        const candles = await this.fetchCandles(symbolConfig);
        
        // Upsert to database
        const inserted = await this.upsertCandles(symbolConfig, candles);
        totalInserted += inserted;

        results.push({ symbol: symbolConfig.name, status: "ok", inserted });
        console.log(`✅ Stored ${inserted} candles for ${symbolConfig.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({ symbol: symbolConfig.name, status: "error", error: errorMessage });
        console.error(`❌ Failed to fetch/store ${symbolConfig.name}:`, errorMessage);
      }

      // Wait 1 second between requests
      if (this.symbols.indexOf(symbolConfig) < this.symbols.length - 1) {
        console.log(`   ⏳ Waiting 1 second before next request...`);
        await this.sleep(1000);
      }
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 SUMMARY:`);
    const successCount = results.filter(r => r.status === "ok").length;
    console.log(`   ✅ Successful: ${successCount}/${this.symbols.length}`);
    const failed = results.filter(r => r.status !== "ok");
    if (failed.length > 0) {
      console.log(`   ❌ Failed: ${failed.map(f => f.symbol).join(", ")}`);
    }
    console.log(`⏰ Finished at: ${new Date().toISOString()}`);
    
    return { totalInserted, results };
  }

  /**
   * Fetch candles for a single symbol
   */
  private async fetchCandles(symbolConfig: SymbolConfig): Promise<any[]> {
    return new Promise((resolve, reject) => {
      console.log(`\n📊 Fetching ${symbolConfig.display} (${symbolConfig.name})...`);
      
      const ws = new WebSocket(WS_URL);
      let done = false;

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          ws.terminate();
          reject(new Error(`Timeout fetching ${symbolConfig.name}`));
        }
      }, 30000);

      ws.on("open", () => {
        console.log(`   🔌 Connected, requesting 1000 candles...`);
        
        ws.send(JSON.stringify({
          ticks_history: symbolConfig.name,
          style: "candles",
          granularity: GRANULARITY,
          count: 1000,
          end: "latest"
        }));
      });

      ws.on("message", (data) => {
        let response;
        try {
          response = JSON.parse(data.toString());
        } catch (err) {
          clearTimeout(timeout);
          done = true;
          ws.close();
          reject(new Error(`Failed to parse response`));
          return;
        }

        if (response.error) {
          clearTimeout(timeout);
          done = true;
          ws.close();
          reject(new Error(`API error: ${response.error.message}`));
          return;
        }

        if (response.msg_type === "candles") {
          clearTimeout(timeout);
          done = true;
          
          const candles = response.candles;
          console.log(`   📈 Received ${candles.length} candles`);
          
          if (!candles || candles.length === 0) {
            ws.close();
            reject(new Error("No candles returned"));
            return;
          }

          const first = candles[candles.length - 1];
          const last = candles[0];
          console.log(`   📅 From : ${this.formatDate(first.epoch)}`);
          console.log(`   📅 To   : ${this.formatDate(last.epoch)}`);
          
          const now = Math.floor(Date.now() / 1000);
          const hoursAgo = (now - last.epoch) / 3600;
          console.log(`   ⏰ Latest candle is ${hoursAgo.toFixed(1)} hours old`);
          
          ws.close();
          resolve(candles);
        }
      });

      ws.on("error", (err) => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          reject(new Error(`WebSocket error: ${err.message}`));
        }
      });
    });
  }

  /**
   * Upsert candles to database
   */
  private async upsertCandles(symbolConfig: SymbolConfig, candles: any[]): Promise<number> {
    const tableName = this.getTableName(symbolConfig);
    let upsertCount = 0;
    
    // Get existing candles
    const existingCandles = await this.loadCandles(symbolConfig);
    const existingEpochs = new Set(existingCandles.map(c => c.epoch));
    
    const sortedCandles = [...candles].sort((a, b) => a.epoch - b.epoch);
    
    for (const candle of sortedCandles) {
      if (!existingEpochs.has(candle.epoch)) {
        const newId = await this.getNextId(symbolConfig);
        
        const insertSQL = `
          INSERT INTO ${tableName} (id, granularity, epoch, datetime, open, high, low, close)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await this.pool.execute(insertSQL, [
          newId,
          GRANULARITY,
          candle.epoch,
          this.formatDate(candle.epoch),
          parseFloat(candle.open),
          parseFloat(candle.high),
          parseFloat(candle.low),
          parseFloat(candle.close)
        ]);
        
        upsertCount++;
      }
    }
    
    console.log(`   💾 Saved to table: ${tableName}`);
    return upsertCount;
  }

  /**
   * Force full refresh (fetch all candles even if data exists)
   */
  async forceFullRefresh(): Promise<void> {
    console.log('🔄 Force refreshing all candles for all symbols...');
    
    // Clear existing data from all tables
    for (const symbolConfig of this.symbols) {
      const tableName = this.getTableName(symbolConfig);
      await this.pool.execute(`DELETE FROM ${tableName}`);
      console.log(`🗑️ Cleared table: ${tableName}`);
    }
    
    await this.fetchInitialCandles();
    console.log('✅ Force refresh completed!');
  }

  /**
   * Close database connection pool
   */
  async closeConnection(): Promise<void> {
    await this.pool.end();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('Database connection closed');
  }
}