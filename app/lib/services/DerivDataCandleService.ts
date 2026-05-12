import WebSocket from 'ws';
import { createClient } from "@supabase/supabase-js";
import { ALL_VOLATILITY_SYMBOLS } from '../constants/volatilitySymbols';

// ─── Config ───────────────────────────────────────────────────────
const DERIV_APP_ID = process.env.DERIV_APP_ID ? parseInt(process.env.DERIV_APP_ID, 10) : 1089;
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GRANULARITY = 1800; // 30 minutes
const COUNT = 1000;

// Candle table schema (matches your first code)
const CANDLE_SCHEMA = `
  id          BIGSERIAL   PRIMARY KEY,
  granularity INT         NOT NULL,
  epoch       BIGINT      NOT NULL,
  datetime    TIMESTAMPTZ NOT NULL,
  open        NUMERIC     NOT NULL,
  high        NUMERIC     NOT NULL,
  low         NUMERIC     NOT NULL,
  close       NUMERIC     NOT NULL,
  UNIQUE (granularity, epoch)
`;

export class DerivDataCandleService {
  private symbols = [...ALL_VOLATILITY_SYMBOLS];
  private supabase;
  private ws: WebSocket | null = null;
  private appId: number;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.appId = DERIV_APP_ID;
  }

  /**
   * Sleep helper (like in your first code)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize symbol name to be a valid PostgreSQL table name
   * - Prefix with 'candle_' to avoid numeric starting characters
   * - Convert to lowercase
   * - Replace any invalid characters with underscores
   */
  private sanitizeTableName(symbol: string): string {
    // Convert to lowercase and prefix with 'candle_' to ensure valid identifier
    let tableName = `candle_${symbol.toLowerCase()}`;
    
    // Replace any characters that are not letters, numbers, or underscores
    tableName = tableName.replace(/[^a-z0-9_]/g, '_');
    
    return tableName;
  }

  /**
   * Ensure table exists for a symbol (like ensureTable in your candle sync)
   */
  private async ensureTable(symbol: string): Promise<void> {
    const tableName = this.sanitizeTableName(symbol);
    
    const { error } = await this.supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${CANDLE_SCHEMA}
        );
        CREATE INDEX IF NOT EXISTS idx_${tableName}_epoch ON ${tableName} (epoch DESC);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_datetime ON ${tableName} (datetime DESC);
      `,
    });
    
    if (error) throw new Error(`Table creation failed for "${tableName}": ${error.message}`);
  }

  async createTables(): Promise<void> {
    console.log('📊 Creating tables for symbols:', this.symbols);
    for (const symbol of this.symbols) {
      await this.ensureTable(symbol);
      const tableName = this.sanitizeTableName(symbol);
      console.log(`✅ Table ${tableName} created/verified for symbol ${symbol}`);
    }
  }

  async hasData(symbol: string): Promise<boolean> {
    const tableName = this.sanitizeTableName(symbol);
    await this.ensureTable(symbol);
    
    const { count, error } = await this.supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) throw new Error(`Failed to check data for "${tableName}": ${error.message}`);
    return (count || 0) > 0;
  }

  /**
   * Fetch candles for a single symbol (like fetchCandles in your first code)
   */
  private async fetchCandles(symbol: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let done = false;

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          ws.terminate();
          reject(new Error(`Timeout fetching ${symbol}`));
        }
      }, 30000);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            ticks_history: symbol,
            style: "candles",
            granularity: GRANULARITY,
            count: COUNT,
            end: "latest",
            adjust_start_time: 1,
          })
        );
      });

      ws.on("message", (data) => {
        let res;
        try { 
          res = JSON.parse(data.toString()); 
        } catch { 
          return; 
        }

        if (res.error) {
          clearTimeout(timeout);
          done = true;
          ws.close();
          return reject(new Error(res.error.message));
        }

        if (res.msg_type === "candles") {
          clearTimeout(timeout);
          done = true;
          ws.close();
          resolve(res.candles);
        }
      });

      ws.on("error", (err) => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  /**
   * Upsert candles to Supabase (like upsertCandles in your first code)
   */
  private async upsertCandles(symbol: string, candles: any[]): Promise<number> {
    const tableName = this.sanitizeTableName(symbol);
    await this.ensureTable(symbol);
    
    const rows = candles.map((candle) => ({
      granularity: GRANULARITY,
      epoch: candle.epoch,
      datetime: new Date(candle.epoch * 1000).toISOString(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    }));
    
    const { error, count } = await this.supabase
      .from(tableName)
      .upsert(rows, { onConflict: 'granularity,epoch', ignoreDuplicates: false });
    
    if (error) throw new Error(`Upsert failed on "${tableName}": ${error.message}`);
    return count || rows.length;
  }

  /**
   * Fetch initial 1000 candles for all symbols (one by one with delays, like your first code)
   */
  async fetchInitialCandles(): Promise<{ totalInserted: number; results: any[] }> {
    console.log('🔄 Fetching initial 1000 candles for all symbols...');
    const results = [];
    let totalInserted = 0;

    for (const symbol of this.symbols) {
      try {
        // 1. Ensure table exists
        await this.ensureTable(symbol);

        // 2. Fetch candles from Deriv
        console.log(`📡 Requesting ${COUNT} candles for ${symbol}`);
        const candles = await this.fetchCandles(symbol);
        console.log(`📊 Received ${candles.length} candles for ${symbol}`);

        // 3. Upsert into Supabase
        const inserted = await this.upsertCandles(symbol, candles);
        totalInserted += inserted;

        results.push({ symbol, status: "ok", inserted });
        console.log(`✅ Stored ${inserted} candles for ${symbol}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({ symbol, status: "error", error: errorMessage });
        console.error(`❌ Failed to fetch/store ${symbol}:`, errorMessage);
      }

      // Be nice to Deriv API between symbols (like your first code)
      await this.sleep(1500);
    }

    console.log(`✅ Completed: ${totalInserted} total candles inserted across ${this.symbols.length} symbols`);
    return { totalInserted, results };
  }

  /**
   * Fetch latest candle for a single symbol (reuse fetchCandles with count=1)
   */
  private async fetchLatestCandleData(symbol: string): Promise<any | null> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let done = false;

      const timeout = setTimeout(() => {
        if (!done) {
          done = true;
          ws.terminate();
          reject(new Error(`Timeout fetching latest candle for ${symbol}`));
        }
      }, 10000);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            ticks_history: symbol,
            style: "candles",
            granularity: GRANULARITY,
            count: 1,
            end: "latest",
            adjust_start_time: 1,
          })
        );
      });

      ws.on("message", (data) => {
        let res;
        try { 
          res = JSON.parse(data.toString()); 
        } catch { 
          return; 
        }

        if (res.error) {
          clearTimeout(timeout);
          done = true;
          ws.close();
          return reject(new Error(res.error.message));
        }

        if (res.msg_type === "candles") {
          clearTimeout(timeout);
          done = true;
          ws.close();
          const candles = res.candles || [];
          resolve(candles.length > 0 ? candles[0] : null);
        }
      });

      ws.on("error", (err) => {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  /**
   * Update latest candle for a single symbol
   */
  async updateLatestCandle(symbol: string): Promise<boolean> {
    try {
      const latestCandle = await this.fetchLatestCandleData(symbol);
      if (!latestCandle) {
        console.log(`⚠️ No latest candle received for ${symbol}`);
        return false;
      }

      const inserted = await this.upsertCandles(symbol, [latestCandle]);
      console.log(`✅ Updated latest candle for ${symbol} (epoch: ${latestCandle.epoch})`);
      return inserted > 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed to update latest candle for ${symbol}:`, errorMessage);
      return false;
    }
  }

  /**
   * Update latest candles for all symbols (one by one with delays, like your first code)
   */
  async updateLatestCandles(): Promise<{ totalUpdated: number; results: any[] }> {
    console.log('🔄 Updating latest candles for all symbols...');
    const results = [];
    let totalUpdated = 0;

    for (const symbol of this.symbols) {
      try {
        const updated = await this.updateLatestCandle(symbol);
        if (updated) {
          totalUpdated++;
          results.push({ symbol, status: "ok", updated: true });
        } else {
          results.push({ symbol, status: "skipped", updated: false });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({ symbol, status: "error", error: errorMessage });
        console.error(`❌ Failed to update ${symbol}:`, errorMessage);
      }

      // Be nice to Deriv API between symbols (like your first code)
      await this.sleep(1500);
    }

    console.log(`✅ Updated latest candles for ${totalUpdated}/${this.symbols.length} symbols`);
    return { totalUpdated, results };
  }

  /**
   * Fetch previous completed candle (for strategy reference)
   */
  async fetchPreviousCompletedCandle(symbol: string): Promise<any | null> {
    try {
      const tableName = this.sanitizeTableName(symbol);
      await this.ensureTable(symbol);
      
      const { data: candle, error } = await this.supabase
        .from(tableName)
        .select('*')
        .order('epoch', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching previous candle for ${symbol}:`, error);
        return null;
      }
      
      return candle;
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
  }): Promise<any[]> {
    const tableName = this.sanitizeTableName(symbol);
    await this.ensureTable(symbol);
    
    let query = this.supabase
      .from(tableName)
      .select('*')
      .order('epoch', { ascending: true });
    
    if (options?.startDate) {
      query = query.gte('datetime', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('datetime', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }
    
    const { data: candles, error } = await query;
    if (error) throw new Error(`Failed to get candles for "${tableName}": ${error.message}`);
    return candles || [];
  }

  /**
   * Get the latest candle for a symbol
   */
  async getLatestCandle(symbol: string): Promise<any | null> {
    const tableName = this.sanitizeTableName(symbol);
    await this.ensureTable(symbol);
    
    const { data: candle, error } = await this.supabase
      .from(tableName)
      .select('*')
      .order('epoch', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get latest candle for "${tableName}": ${error.message}`);
    }
    return candle;
  }

  /**
   * Delete old candles (cleanup utility)
   */
  async deleteOldCandles(symbol: string, olderThan: Date): Promise<number> {
    const tableName = this.sanitizeTableName(symbol);
    await this.ensureTable(symbol);
    
    const { error, count } = await this.supabase
      .from(tableName)
      .delete({ count: 'exact' })
      .lt('datetime', olderThan.toISOString());
    
    if (error) throw new Error(`Failed to delete old candles for "${tableName}": ${error.message}`);
    return count || 0;
  }

  /**
   * Initialize service - either fetch all candles or just update latest
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing DerivDataCandleService...');
    await this.createTables();
    
    const firstSymbol = this.symbols[0];
    const hasExistingData = await this.hasData(firstSymbol);
    
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
   * Force full refresh (fetch all candles even if data exists)
   */
  async forceFullRefresh(): Promise<void> {
    console.log('🔄 Force refreshing all candles for all symbols...');
    await this.fetchInitialCandles();
    console.log('✅ Force refresh completed!');
  }

  /**
   * Get statistics for a symbol
   */
  async getStatistics(symbol: string): Promise<{ 
    totalCandles: number; 
    firstCandle: any | null; 
    lastCandle: any | null;
    dateRange: { from: Date | null; to: Date | null };
  }> {
    const tableName = this.sanitizeTableName(symbol);
    await this.ensureTable(symbol);
    
    // Get count
    const { count: totalCandles } = await this.supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    // Get first candle
    const { data: firstCandle } = await this.supabase
      .from(tableName)
      .select('*')
      .order('epoch', { ascending: true })
      .limit(1)
      .single();
    
    // Get last candle
    const { data: lastCandle } = await this.supabase
      .from(tableName)
      .select('*')
      .order('epoch', { ascending: false })
      .limit(1)
      .single();
    
    return {
      totalCandles: totalCandles || 0,
      firstCandle: firstCandle || null,
      lastCandle: lastCandle || null,
      dateRange: {
        from: firstCandle ? new Date(firstCandle.datetime) : null,
        to: lastCandle ? new Date(lastCandle.datetime) : null,
      }
    };
  }

  closeConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('Connection closed');
  }
}