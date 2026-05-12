import { createClient } from "@supabase/supabase-js";
import { CandlePattern, UptrendPatterns, DowntrendPatterns } from '../strategyCombinations';

// ─── Config ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fixed schema for bet records (same structure as your candle tables)
const BET_RECORDS_SCHEMA = `
  id              BIGSERIAL   PRIMARY KEY,
  sessionid       UUID        NOT NULL,
  sessionresult   TEXT,
  firstbetAmount          DECIMAL(10,2),
  firstbetResult          TEXT,
  firstbetactual          TEXT,
  firstbetexpectedcandle  TEXT(1),
  secondbetAmount         DECIMAL(10,2),
  secondbetResult         TEXT,
  secondbetactual         TEXT,
  secondbetexpectedcandle TEXT(1),
  thirdbetAmount          DECIMAL(10,2),
  thirdbetResult          TEXT,
  thirdbetactual          TEXT,
  thirdbetexpectedcandle  TEXT(1),
  fourthbetAmount         DECIMAL(10,2),
  fourthbetResult         TEXT,
  fourthbetactual         TEXT,
  fourthbetexpectedcandle TEXT(1),
  fifthbetAmount          DECIMAL(10,2),
  fifthbetResult          TEXT,
  fifthbetactual          TEXT,
  fifthbetexpectedcandle  TEXT(1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
`;

export class BetRecordService {
  private supabase;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /**
   * Ensure table exists for a specific pattern (like ensureTable in candle sync)
   */
  private async ensureTable(pattern: string): Promise<void> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    
    const { error } = await this.supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${BET_RECORDS_SCHEMA}
        );
        CREATE INDEX IF NOT EXISTS idx_${tableName}_sessionid ON ${tableName} (sessionid);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_sessionresult ON ${tableName} (sessionresult);
        CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON ${tableName} (created_at DESC);
      `,
    });
    
    if (error) throw new Error(`Table creation failed for "${tableName}": ${error.message}`);
  }

  /**
   * Create tables for all candle patterns.
   */
  async createTables(): Promise<void> {
    const patterns = Object.values(CandlePattern);
    for (const pattern of patterns) {
      await this.ensureTable(pattern);
    }
    console.log('Bet record tables created or updated.');
  }

  // ---------------------------------------------------------
  // CRUD operations
  // ---------------------------------------------------------

  /**
   * Create a new bet record in the specified pattern table.
   */
  async createRecord(pattern: string, data: Record<string, unknown>): Promise<any> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    const { data: record, error } = await this.supabase
      .from(tableName)
      .insert({ ...data, created_at: new Date(), updated_at: new Date() })
      .select()
      .single();
    
    if (error) throw new Error(`Create failed on "${tableName}": ${error.message}`);
    return record;
  }

  /**
   * Get a single bet record by its primary key.
   */
  async getRecordById(pattern: string, id: number): Promise<any | null> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    const { data: record, error } = await this.supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return record;
  }

  /**
   * Get multiple bet records with optional filtering.
   */
  async getRecords(
    pattern: string,
    options?: {
      sessionid?: string;
      sessionresult?: string;
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<any[]> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    let query = this.supabase.from(tableName).select('*');
    
    if (options?.sessionid) {
      query = query.eq('sessionid', options.sessionid);
    }
    if (options?.sessionresult) {
      query = query.eq('sessionresult', options.sessionresult);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    }
    
    const { data: records, error } = await query;
    if (error) throw new Error(`Query failed on "${tableName}": ${error.message}`);
    return records || [];
  }

  /**
   * Update any fields on a bet record.
   */
  async updateRecord(pattern: string, id: number, updates: Record<string, unknown>): Promise<any | null> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    const { data: record, error } = await this.supabase
      .from(tableName)
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(`Update failed on "${tableName}": ${error.message}`);
    return record;
  }

  // ---------------------------------------------------------
  // Specific bet updates
  // ---------------------------------------------------------

  async updateFirstBet(pattern: string, id: number, data: {
    firstbetAmount?: number;
    firstbetResult?: string;
    firstbetactual?: string;
    firstbetexpectedcandle?: string;
  }): Promise<any | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateSecondBet(pattern: string, id: number, data: {
    secondbetAmount?: number;
    secondbetResult?: string;
    secondbetactual?: string;
    secondbetexpectedcandle?: string;
  }): Promise<any | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateThirdBet(pattern: string, id: number, data: {
    thirdbetAmount?: number;
    thirdbetResult?: string;
    thirdbetactual?: string;
    thirdbetexpectedcandle?: string;
  }): Promise<any | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateFourthBet(pattern: string, id: number, data: {
    fourthbetAmount?: number;
    fourthbetResult?: string;
    fourthbetactual?: string;
    fourthbetexpectedcandle?: string;
  }): Promise<any | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateFifthBet(pattern: string, id: number, data: {
    fifthbetAmount?: number;
    fifthbetResult?: string;
    fifthbetactual?: string;
    fifthbetexpectedcandle?: string;
  }): Promise<any | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateSessionResult(pattern: string, id: number, sessionresult: string): Promise<any | null> {
    return this.updateRecord(pattern, id, { sessionresult });
  }

  // ---------------------------------------------------------
  // Delete
  // ---------------------------------------------------------

  async deleteRecord(pattern: string, id: number): Promise<boolean> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    const { error } = await this.supabase
      .from(tableName)
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(`Delete failed on "${tableName}": ${error.message}`);
    return true;
  }

  // ---------------------------------------------------------
  // Batch operations (like the candle upsert pattern)
  // ---------------------------------------------------------

  /**
   * Batch upsert multiple bet records (like upsertCandles in your candle sync)
   */
  async upsertRecords(pattern: string, records: Record<string, unknown>[]): Promise<number> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    const recordsWithTimestamps = records.map(record => ({
      ...record,
      updated_at: new Date(),
      created_at: record.created_at || new Date(),
    }));
    
    const { error, count } = await this.supabase
      .from(tableName)
      .upsert(recordsWithTimestamps, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      });
    
    if (error) throw new Error(`Upsert failed on "${tableName}": ${error.message}`);
    return count || records.length;
  }

  // ---------------------------------------------------------
  // Seeding methods
  // ---------------------------------------------------------

  async seedTheFirstWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.1, symbol);
  }

  async seedTheSecondWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.2, symbol);
  }

  async seedTheThirdWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.4, symbol);
  }

  private async seedWithStartingAmount(trend: 'uptrend' | 'downtrend', startingAmount: number, symbol: string): Promise<string> {
    const sessionid = crypto.randomUUID();
    
    const patterns = trend === 'uptrend' 
      ? Object.values(UptrendPatterns) 
      : Object.values(DowntrendPatterns);
    
    const betAmounts = [
      startingAmount,
      startingAmount * 2,
      startingAmount * 4,
      startingAmount * 8,
      startingAmount * 16,
    ];
    
    // Create bet records for each pattern
    for (const pattern of patterns) {
      const expectedCandles = pattern.split('').map(c => c.toLowerCase());
      
      await this.createRecord(pattern, {
        sessionid,
        sessionresult: null,
        firstbetAmount: betAmounts[0],
        firstbetResult: null,
        firstbetactual: null,
        firstbetexpectedcandle: expectedCandles[0],
        secondbetAmount: betAmounts[1],
        secondbetResult: null,
        secondbetactual: null,
        secondbetexpectedcandle: expectedCandles[1],
        thirdbetAmount: betAmounts[2],
        thirdbetResult: null,
        thirdbetactual: null,
        thirdbetexpectedcandle: expectedCandles[2],
        fourthbetAmount: betAmounts[3],
        fourthbetResult: null,
        fourthbetactual: null,
        fourthbetexpectedcandle: expectedCandles[3],
        fifthbetAmount: betAmounts[4],
        fifthbetResult: null,
        fifthbetactual: null,
        fifthbetexpectedcandle: expectedCandles[4],
      });
    }
    
    console.log(`Seeded ${patterns.length} patterns for ${trend} with session ID: ${sessionid} (starting amount: ${startingAmount})`);
    return sessionid;
  }
}