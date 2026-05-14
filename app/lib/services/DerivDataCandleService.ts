import WebSocket from 'ws';
import { ALL_VOLATILITY_SYMBOLS } from '../constants/volatilitySymbols';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Config ───────────────────────────────────────────────────────
const DERIV_APP_ID = process.env.DERIV_APP_ID ? parseInt(process.env.DERIV_APP_ID, 10) : 1089;
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const GRANULARITY = 1800; // 30 minutes

// Data directory for storing candles
const DATA_DIR = path.join(process.cwd(), 'data', 'candles');

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
  file: string;
  display: string;
}

const SYMBOLS_CONFIG: SymbolConfig[] = [
  { name: "R_10", file: "v10_30min_candles.json", display: "Volatility 10 Index" },
  { name: "R_25", file: "v25_30min_candles.json", display: "Volatility 25 Index" },
  { name: "R_50", file: "v50_30min_candles.json", display: "Volatility 50 Index" },
  { name: "R_75", file: "v75_30min_candles.json", display: "Volatility 75 Index" },
  { name: "R_100", file: "v100_30min_candles.json", display: "Volatility 100 Index" },
  { name: "1HZ10V", file: "v10_1hz_30min_candles.json", display: "Volatility 10 Index (1s)" },
  { name: "1HZ25V", file: "v25_1hz_30min_candles.json", display: "Volatility 25 Index (1s)" },
  { name: "1HZ50V", file: "v50_1hz_30min_candles.json", display: "Volatility 50 Index (1s)" },
  { name: "1HZ75V", file: "v75_1hz_30min_candles.json", display: "Volatility 75 Index (1s)" },
  { name: "1HZ100V", file: "v100_1hz_30min_candles.json", display: "Volatility 100 Index (1s)" }
];

export class DerivDataCandleService {
  private symbols: SymbolConfig[] = [...SYMBOLS_CONFIG];
  private ws: WebSocket | null = null;
  private appId: number;
  private dataDir: string;

  constructor() {
    this.appId = DERIV_APP_ID;
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
   * Get file path for a symbol
   */
  private getFilePath(symbolConfig: SymbolConfig): string {
    return path.join(this.dataDir, symbolConfig.file);
  }

  /**
   * Load candles from JSON file for a symbol
   */
  private async loadCandles(symbolConfig: SymbolConfig): Promise<Candle[]> {
    const filePath = this.getFilePath(symbolConfig);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to load candles for "${symbolConfig.name}": ${error.message}`);
    }
  }

  /**
   * Save candles to JSON file for a symbol
   */
  private async saveCandles(symbolConfig: SymbolConfig, candles: Candle[]): Promise<void> {
    const filePath = this.getFilePath(symbolConfig);
    await fs.writeFile(filePath, JSON.stringify(candles, null, 2), 'utf-8');
  }

  /**
   * Get next ID for a symbol
   */
  private async getNextId(symbolConfig: SymbolConfig): Promise<number> {
    const candles = await this.loadCandles(symbolConfig);
    if (candles.length === 0) return 1;
    return Math.max(...candles.map(c => c.id)) + 1;
  }

  /**
   * Get the latest epoch from existing JSON file
   */
  private async getLatestEpochFromJSON(symbolConfig: SymbolConfig): Promise<number | null> {
    const candles = await this.loadCandles(symbolConfig);
    if (candles.length === 0) return null;
    
    // Find the maximum epoch
    const maxEpoch = Math.max(...candles.map(c => c.epoch));
    return maxEpoch;
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
   * Append a single candle to JSON file
   */
  private async appendCandleToJSON(symbolConfig: SymbolConfig, candle: any): Promise<void> {
    const candles = await this.loadCandles(symbolConfig);
    
    // Check if candle with this epoch already exists
    const exists = candles.some(c => c.epoch === candle.epoch);
    
    if (exists) {
      console.log(`   ⚠️ Candle epoch ${candle.epoch} already exists, skipping`);
      return;
    }
    
    const newCandle: Candle = {
      id: await this.getNextId(symbolConfig),
      granularity: GRANULARITY,
      epoch: candle.epoch,
      datetime: this.formatDate(candle.epoch),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    };
    
    candles.push(newCandle);
    
    // Sort by epoch
    candles.sort((a, b) => a.epoch - b.epoch);
    
    await this.saveCandles(symbolConfig, candles);
    console.log(`   💾 Appended to: ${this.getFilePath(symbolConfig)}`);
  }

  /**
   * Update latest candles for all symbols (incremental update)
   * This method only adds new candles, never overwrites existing data
   */
  async updateLatestCandles(): Promise<{ totalAdded: number; results: any[] }> {
    console.log(`🚀 Starting incremental update - fetching latest completed candles only...`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log(`📁 Data directory: ${this.dataDir}`);
    
    const lastCompletedEpoch = this.getLastCompletedCandleEpoch();
    const lastCompletedTime = new Date(lastCompletedEpoch * 1000).toISOString();
    console.log(`\n🎯 Target: Last completed candle at ${lastCompletedTime}`);
    console.log(`\n${"=".repeat(60)}`);
    
    const results = [];
    let totalAdded = 0;
    
    for (const symbolConfig of this.symbols) {
      try {
        // Get the latest epoch already in JSON
        const latestEpochInFile = await this.getLatestEpochFromJSON(symbolConfig);
        
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
        if (latestEpochInFile && latestCandle.epoch <= latestEpochInFile) {
          console.log(`   ✅ Already have latest candle (epoch: ${latestCandle.epoch})`);
          results.push({ 
            symbol: symbolConfig.name, 
            success: true, 
            added: false, 
            reason: "Already exists",
            epoch: latestCandle.epoch
          });
        } else {
          // New candle - append to JSON
          await this.appendCandleToJSON(symbolConfig, latestCandle);
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
      
      const candles = await this.loadCandles(symbolConfig);
      
      if (candles.length === 0) return null;
      
      // Return the latest candle (newest by epoch)
      const latest = candles.reduce((latest, current) => 
        current.epoch > latest.epoch ? current : latest
      );
      
      return latest;
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
    
    let candles = await this.loadCandles(symbolConfig);
    
    // Filter by date range
    if (options?.startDate) {
      candles = candles.filter(c => new Date(c.datetime) >= options.startDate!);
    }
    if (options?.endDate) {
      candles = candles.filter(c => new Date(c.datetime) <= options.endDate!);
    }
    
    // Sort by epoch ascending
    candles.sort((a, b) => a.epoch - b.epoch);
    
    // Apply pagination
    if (options?.offset !== undefined) {
      const limit = options?.limit || 50;
      candles = candles.slice(options.offset, options.offset + limit);
    } else if (options?.limit) {
      candles = candles.slice(0, options.limit);
    }
    
    return candles;
  }

  /**
   * Get the latest candle for a symbol
   */
  async getLatestCandle(symbol: string): Promise<Candle | null> {
    const symbolConfig = this.symbols.find(s => s.name === symbol);
    if (!symbolConfig) return null;
    
    const candles = await this.loadCandles(symbolConfig);
    
    if (candles.length === 0) return null;
    
    // Return the candle with the highest epoch
    return candles.reduce((latest, current) => 
      current.epoch > latest.epoch ? current : latest
    );
  }

  /**
   * Create tables - creates JSON files if they don't exist
   */
  async createTables(): Promise<void> {
    console.log('📊 Creating/verifying JSON files for symbols...');
    for (const symbolConfig of this.symbols) {
      const filePath = this.getFilePath(symbolConfig);
      try {
        await fs.access(filePath);
        console.log(`✅ File ${symbolConfig.file} already exists`);
      } catch {
        // Create empty array if file doesn't exist
        await this.saveCandles(symbolConfig, []);
        console.log(`✅ Created new file: ${symbolConfig.file}`);
      }
    }
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
    
    const candles = await this.loadCandles(symbolConfig);
    
    if (candles.length === 0) {
      return {
        totalCandles: 0,
        firstCandle: null,
        lastCandle: null,
        dateRange: { from: null, to: null }
      };
    }
    
    // Sort by epoch
    const sortedCandles = [...candles].sort((a, b) => a.epoch - b.epoch);
    const firstCandle = sortedCandles[0];
    const lastCandle = sortedCandles[sortedCandles.length - 1];
    
    return {
      totalCandles: candles.length,
      firstCandle: firstCandle,
      lastCandle: lastCandle,
      dateRange: {
        from: new Date(firstCandle.datetime),
        to: new Date(lastCandle.datetime),
      }
    };
  }

  /**
   * Check if data exists for a symbol
   */
  async hasData(symbol: string): Promise<boolean> {
    const symbolConfig = this.symbols.find(s => s.name === symbol);
    if (!symbolConfig) return false;
    
    const candles = await this.loadCandles(symbolConfig);
    return candles.length > 0;
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
    await this.ensureDataDirectory();
    
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
    console.log(`📁 Data directory: ${this.dataDir}`);
    console.log(`\n${"=".repeat(60)}`);
    
    const results = [];
    let totalInserted = 0;

    for (const symbolConfig of this.symbols) {
      try {
        // Fetch candles from Deriv
        const candles = await this.fetchCandles(symbolConfig);
        
        // Upsert to JSON
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
   * Upsert candles to JSON file
   */
  private async upsertCandles(symbolConfig: SymbolConfig, candles: any[]): Promise<number> {
    let existingCandles = await this.loadCandles(symbolConfig);
    let upsertCount = 0;
    
    const sortedCandles = [...candles].sort((a, b) => a.epoch - b.epoch);
    
    for (const candle of sortedCandles) {
      const epoch = candle.epoch;
      const existingIndex = existingCandles.findIndex(c => c.epoch === epoch);
      
      const newCandle: Candle = {
        id: existingIndex !== -1 ? existingCandles[existingIndex].id : await this.getNextId(symbolConfig),
        granularity: GRANULARITY,
        epoch: epoch,
        datetime: this.formatDate(epoch),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
      };
      
      if (existingIndex !== -1) {
        existingCandles[existingIndex] = newCandle;
        upsertCount++;
      } else {
        existingCandles.push(newCandle);
        upsertCount++;
      }
    }
    
    existingCandles.sort((a, b) => a.epoch - b.epoch);
    await this.saveCandles(symbolConfig, existingCandles);
    console.log(`   💾 Saved to: ${this.getFilePath(symbolConfig)}`);
    
    return upsertCount;
  }

  /**
   * Force full refresh (fetch all candles even if data exists)
   */
  async forceFullRefresh(): Promise<void> {
    console.log('🔄 Force refreshing all candles for all symbols...');
    await this.fetchInitialCandles();
    console.log('✅ Force refresh completed!');
  }

  closeConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('Connection closed');
  }
}