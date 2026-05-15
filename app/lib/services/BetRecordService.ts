import { CandlePattern, UptrendPatterns, DowntrendPatterns } from '../strategyCombinations';
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

// Interface for bet record
export interface BetRecord {
  id: number;
  sessionid: string;
  sessionresult: string | null;
  firstbetAmount: number | null;
  firstbetResult: string | null;
  firstbetactual: string | null;
  firstbetexpectedcandle: string | null;
  secondbetAmount: number | null;
  secondbetResult: string | null;
  secondbetactual: string | null;
  secondbetexpectedcandle: string | null;
  thirdbetAmount: number | null;
  thirdbetResult: string | null;
  thirdbetactual: string | null;
  thirdbetexpectedcandle: string | null;
  fourthbetAmount: number | null;
  fourthbetResult: string | null;
  fourthbetactual: string | null;
  fourthbetexpectedcandle: string | null;
  fifthbetAmount: number | null;
  fifthbetResult: string | null;
  fifthbetactual: string | null;
  fifthbetexpectedcandle: string | null;
  created_at: Date;
}

export class BetRecordService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(DB_CONFIG);
  }

  /**
   * Get table name for a specific pattern
   */
  private getTableName(pattern: string): string {
    return `bet_records_${pattern.toLowerCase()}`;
  }

  /**
   * Create tables for all candle patterns.
   */
  async createTables(): Promise<void> {
    const patterns = Object.values(CandlePattern);
    
    for (const pattern of patterns) {
      const tableName = this.getTableName(pattern);
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sessionid VARCHAR(255) NOT NULL,
          sessionresult VARCHAR(50) NULL,
          firstbetAmount DECIMAL(10, 2) NULL,
          firstbetResult VARCHAR(50) NULL,
          firstbetactual VARCHAR(10) NULL,
          firstbetexpectedcandle VARCHAR(10) NULL,
          secondbetAmount DECIMAL(10, 2) NULL,
          secondbetResult VARCHAR(50) NULL,
          secondbetactual VARCHAR(10) NULL,
          secondbetexpectedcandle VARCHAR(10) NULL,
          thirdbetAmount DECIMAL(10, 2) NULL,
          thirdbetResult VARCHAR(50) NULL,
          thirdbetactual VARCHAR(10) NULL,
          thirdbetexpectedcandle VARCHAR(10) NULL,
          fourthbetAmount DECIMAL(10, 2) NULL,
          fourthbetResult VARCHAR(50) NULL,
          fourthbetactual VARCHAR(10) NULL,
          fourthbetexpectedcandle VARCHAR(10) NULL,
          fifthbetAmount DECIMAL(10, 2) NULL,
          fifthbetResult VARCHAR(50) NULL,
          fifthbetactual VARCHAR(10) NULL,
          fifthbetexpectedcandle VARCHAR(10) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_sessionid (sessionid),
          INDEX idx_sessionresult (sessionresult),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      
      await this.pool.execute(createTableSQL);
      console.log(`Table "${tableName}" created or already exists.`);
    }
    
    console.log('All bet record tables created/verified.');
  }

  /**
   * Initialize the service (create all tables)
   */
  async initialize(): Promise<void> {
    await this.createTables();
    console.log('BetRecordService initialized');
  }

  /**
   * Create a new bet record in the specified pattern table.
   */
  async createRecord(pattern: string, data: Partial<BetRecord>): Promise<BetRecord> {
    const tableName = this.getTableName(pattern);
    
    const insertSQL = `
      INSERT INTO ${tableName} (
        sessionid, sessionresult,
        firstbetAmount, firstbetResult, firstbetactual, firstbetexpectedcandle,
        secondbetAmount, secondbetResult, secondbetactual, secondbetexpectedcandle,
        thirdbetAmount, thirdbetResult, thirdbetactual, thirdbetexpectedcandle,
        fourthbetAmount, fourthbetResult, fourthbetactual, fourthbetexpectedcandle,
        fifthbetAmount, fifthbetResult, fifthbetactual, fifthbetexpectedcandle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await this.pool.execute(insertSQL, [
      data.sessionid || '',
      data.sessionresult || null,
      data.firstbetAmount || null,
      data.firstbetResult || null,
      data.firstbetactual || null,
      data.firstbetexpectedcandle || null,
      data.secondbetAmount || null,
      data.secondbetResult || null,
      data.secondbetactual || null,
      data.secondbetexpectedcandle || null,
      data.thirdbetAmount || null,
      data.thirdbetResult || null,
      data.thirdbetactual || null,
      data.thirdbetexpectedcandle || null,
      data.fourthbetAmount || null,
      data.fourthbetResult || null,
      data.fourthbetactual || null,
      data.fourthbetexpectedcandle || null,
      data.fifthbetAmount || null,
      data.fifthbetResult || null,
      data.fifthbetactual || null,
      data.fifthbetexpectedcandle || null
    ]);
    
    // Fetch the created record
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [(result as any).insertId]
    );
    
    const record = (rows as any[])[0];
    return {
      id: record.id,
      sessionid: record.sessionid,
      sessionresult: record.sessionresult,
      firstbetAmount: record.firstbetAmount ? parseFloat(record.firstbetAmount) : null,
      firstbetResult: record.firstbetResult,
      firstbetactual: record.firstbetactual,
      firstbetexpectedcandle: record.firstbetexpectedcandle,
      secondbetAmount: record.secondbetAmount ? parseFloat(record.secondbetAmount) : null,
      secondbetResult: record.secondbetResult,
      secondbetactual: record.secondbetactual,
      secondbetexpectedcandle: record.secondbetexpectedcandle,
      thirdbetAmount: record.thirdbetAmount ? parseFloat(record.thirdbetAmount) : null,
      thirdbetResult: record.thirdbetResult,
      thirdbetactual: record.thirdbetactual,
      thirdbetexpectedcandle: record.thirdbetexpectedcandle,
      fourthbetAmount: record.fourthbetAmount ? parseFloat(record.fourthbetAmount) : null,
      fourthbetResult: record.fourthbetResult,
      fourthbetactual: record.fourthbetactual,
      fourthbetexpectedcandle: record.fourthbetexpectedcandle,
      fifthbetAmount: record.fifthbetAmount ? parseFloat(record.fifthbetAmount) : null,
      fifthbetResult: record.fifthbetResult,
      fifthbetactual: record.fifthbetactual,
      fifthbetexpectedcandle: record.fifthbetexpectedcandle,
      created_at: new Date(record.created_at)
    };
  }

  /**
   * Get a single bet record by its primary key.
   */
  async getRecordById(pattern: string, id: number): Promise<BetRecord | null> {
    const tableName = this.getTableName(pattern);
    
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [id]
    );
    
    const records = rows as any[];
    if (records.length === 0) return null;
    
    const record = records[0];
    return {
      id: record.id,
      sessionid: record.sessionid,
      sessionresult: record.sessionresult,
      firstbetAmount: record.firstbetAmount ? parseFloat(record.firstbetAmount) : null,
      firstbetResult: record.firstbetResult,
      firstbetactual: record.firstbetactual,
      firstbetexpectedcandle: record.firstbetexpectedcandle,
      secondbetAmount: record.secondbetAmount ? parseFloat(record.secondbetAmount) : null,
      secondbetResult: record.secondbetResult,
      secondbetactual: record.secondbetactual,
      secondbetexpectedcandle: record.secondbetexpectedcandle,
      thirdbetAmount: record.thirdbetAmount ? parseFloat(record.thirdbetAmount) : null,
      thirdbetResult: record.thirdbetResult,
      thirdbetactual: record.thirdbetactual,
      thirdbetexpectedcandle: record.thirdbetexpectedcandle,
      fourthbetAmount: record.fourthbetAmount ? parseFloat(record.fourthbetAmount) : null,
      fourthbetResult: record.fourthbetResult,
      fourthbetactual: record.fourthbetactual,
      fourthbetexpectedcandle: record.fourthbetexpectedcandle,
      fifthbetAmount: record.fifthbetAmount ? parseFloat(record.fifthbetAmount) : null,
      fifthbetResult: record.fifthbetResult,
      fifthbetactual: record.fifthbetactual,
      fifthbetexpectedcandle: record.fifthbetexpectedcandle,
      created_at: new Date(record.created_at)
    };
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
  ): Promise<BetRecord[]> {
    const tableName = this.getTableName(pattern);
    
    let query = `SELECT * FROM ${tableName} WHERE 1=1`;
    const params: any[] = [];
    
    // Apply filters
    if (options?.sessionid) {
      query += ` AND sessionid = ?`;
      params.push(options.sessionid);
    }
    
    if (options?.sessionresult) {
      query += ` AND sessionresult = ?`;
      params.push(options.sessionresult);
    }
    
    // Apply sorting
    if (options?.orderBy) {
      const direction = options.orderDirection === 'desc' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${options.orderBy} ${direction}`;
    } else {
      query += ` ORDER BY id DESC`;
    }
    
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
    
    return (rows as any[]).map(record => ({
      id: record.id,
      sessionid: record.sessionid,
      sessionresult: record.sessionresult,
      firstbetAmount: record.firstbetAmount ? parseFloat(record.firstbetAmount) : null,
      firstbetResult: record.firstbetResult,
      firstbetactual: record.firstbetactual,
      firstbetexpectedcandle: record.firstbetexpectedcandle,
      secondbetAmount: record.secondbetAmount ? parseFloat(record.secondbetAmount) : null,
      secondbetResult: record.secondbetResult,
      secondbetactual: record.secondbetactual,
      secondbetexpectedcandle: record.secondbetexpectedcandle,
      thirdbetAmount: record.thirdbetAmount ? parseFloat(record.thirdbetAmount) : null,
      thirdbetResult: record.thirdbetResult,
      thirdbetactual: record.thirdbetactual,
      thirdbetexpectedcandle: record.thirdbetexpectedcandle,
      fourthbetAmount: record.fourthbetAmount ? parseFloat(record.fourthbetAmount) : null,
      fourthbetResult: record.fourthbetResult,
      fourthbetactual: record.fourthbetactual,
      fourthbetexpectedcandle: record.fourthbetexpectedcandle,
      fifthbetAmount: record.fifthbetAmount ? parseFloat(record.fifthbetAmount) : null,
      fifthbetResult: record.fifthbetResult,
      fifthbetactual: record.fifthbetactual,
      fifthbetexpectedcandle: record.fifthbetexpectedcandle,
      created_at: new Date(record.created_at)
    }));
  }

  /**
   * Update a bet record
   */
  async updateRecord(pattern: string, id: number, updates: Partial<BetRecord>): Promise<BetRecord | null> {
    const tableName = this.getTableName(pattern);
    
    const fields: string[] = [];
    const values: any[] = [];
    
    // Build dynamic update query
    if (updates.sessionid !== undefined) { fields.push('sessionid = ?'); values.push(updates.sessionid); }
    if (updates.sessionresult !== undefined) { fields.push('sessionresult = ?'); values.push(updates.sessionresult); }
    if (updates.firstbetAmount !== undefined) { fields.push('firstbetAmount = ?'); values.push(updates.firstbetAmount); }
    if (updates.firstbetResult !== undefined) { fields.push('firstbetResult = ?'); values.push(updates.firstbetResult); }
    if (updates.firstbetactual !== undefined) { fields.push('firstbetactual = ?'); values.push(updates.firstbetactual); }
    if (updates.firstbetexpectedcandle !== undefined) { fields.push('firstbetexpectedcandle = ?'); values.push(updates.firstbetexpectedcandle); }
    if (updates.secondbetAmount !== undefined) { fields.push('secondbetAmount = ?'); values.push(updates.secondbetAmount); }
    if (updates.secondbetResult !== undefined) { fields.push('secondbetResult = ?'); values.push(updates.secondbetResult); }
    if (updates.secondbetactual !== undefined) { fields.push('secondbetactual = ?'); values.push(updates.secondbetactual); }
    if (updates.secondbetexpectedcandle !== undefined) { fields.push('secondbetexpectedcandle = ?'); values.push(updates.secondbetexpectedcandle); }
    if (updates.thirdbetAmount !== undefined) { fields.push('thirdbetAmount = ?'); values.push(updates.thirdbetAmount); }
    if (updates.thirdbetResult !== undefined) { fields.push('thirdbetResult = ?'); values.push(updates.thirdbetResult); }
    if (updates.thirdbetactual !== undefined) { fields.push('thirdbetactual = ?'); values.push(updates.thirdbetactual); }
    if (updates.thirdbetexpectedcandle !== undefined) { fields.push('thirdbetexpectedcandle = ?'); values.push(updates.thirdbetexpectedcandle); }
    if (updates.fourthbetAmount !== undefined) { fields.push('fourthbetAmount = ?'); values.push(updates.fourthbetAmount); }
    if (updates.fourthbetResult !== undefined) { fields.push('fourthbetResult = ?'); values.push(updates.fourthbetResult); }
    if (updates.fourthbetactual !== undefined) { fields.push('fourthbetactual = ?'); values.push(updates.fourthbetactual); }
    if (updates.fourthbetexpectedcandle !== undefined) { fields.push('fourthbetexpectedcandle = ?'); values.push(updates.fourthbetexpectedcandle); }
    if (updates.fifthbetAmount !== undefined) { fields.push('fifthbetAmount = ?'); values.push(updates.fifthbetAmount); }
    if (updates.fifthbetResult !== undefined) { fields.push('fifthbetResult = ?'); values.push(updates.fifthbetResult); }
    if (updates.fifthbetactual !== undefined) { fields.push('fifthbetactual = ?'); values.push(updates.fifthbetactual); }
    if (updates.fifthbetexpectedcandle !== undefined) { fields.push('fifthbetexpectedcandle = ?'); values.push(updates.fifthbetexpectedcandle); }
    
    if (fields.length === 0) {
      return this.getRecordById(pattern, id);
    }
    
    values.push(id);
    
    const updateSQL = `UPDATE ${tableName} SET ${fields.join(', ')} WHERE id = ?`;
    await this.pool.execute(updateSQL, values);
    
    return this.getRecordById(pattern, id);
  }

  /**
   * Update first bet
   */
  async updateFirstBet(pattern: string, id: number, data: {
    firstbetAmount?: number;
    firstbetResult?: string;
    firstbetactual?: string;
    firstbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update second bet
   */
  async updateSecondBet(pattern: string, id: number, data: {
    secondbetAmount?: number;
    secondbetResult?: string;
    secondbetactual?: string;
    secondbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update third bet
   */
  async updateThirdBet(pattern: string, id: number, data: {
    thirdbetAmount?: number;
    thirdbetResult?: string;
    thirdbetactual?: string;
    thirdbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update fourth bet
   */
  async updateFourthBet(pattern: string, id: number, data: {
    fourthbetAmount?: number;
    fourthbetResult?: string;
    fourthbetactual?: string;
    fourthbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update fifth bet
   */
  async updateFifthBet(pattern: string, id: number, data: {
    fifthbetAmount?: number;
    fifthbetResult?: string;
    fifthbetactual?: string;
    fifthbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update session result
   */
  async updateSessionResult(pattern: string, id: number, sessionresult: string): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, { sessionresult });
  }

  /**
   * Delete a bet record
   */
  async deleteRecord(pattern: string, id: number): Promise<boolean> {
    const tableName = this.getTableName(pattern);
    
    const [result] = await this.pool.execute(
      `DELETE FROM ${tableName} WHERE id = ?`,
      [id]
    );
    
    return (result as any).affectedRows > 0;
  }

  /**
   * Batch upsert multiple bet records
   */
  async upsertRecords(pattern: string, records: Partial<BetRecord>[]): Promise<number> {
    const tableName = this.getTableName(pattern);
    let upsertCount = 0;
    
    for (const record of records) {
      if (record.id) {
        // Check if record exists
        const existing = await this.getRecordById(pattern, record.id);
        
        if (existing) {
          // Update existing
          await this.updateRecord(pattern, record.id, record);
          upsertCount++;
        } else {
          // Insert with specific ID
          const insertSQL = `
            INSERT INTO ${tableName} (
              id, sessionid, sessionresult,
              firstbetAmount, firstbetResult, firstbetactual, firstbetexpectedcandle,
              secondbetAmount, secondbetResult, secondbetactual, secondbetexpectedcandle,
              thirdbetAmount, thirdbetResult, thirdbetactual, thirdbetexpectedcandle,
              fourthbetAmount, fourthbetResult, fourthbetactual, fourthbetexpectedcandle,
              fifthbetAmount, fifthbetResult, fifthbetactual, fifthbetexpectedcandle,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          `;
          
          await this.pool.execute(insertSQL, [
            record.id,
            record.sessionid || '',
            record.sessionresult || null,
            record.firstbetAmount || null,
            record.firstbetResult || null,
            record.firstbetactual || null,
            record.firstbetexpectedcandle || null,
            record.secondbetAmount || null,
            record.secondbetResult || null,
            record.secondbetactual || null,
            record.secondbetexpectedcandle || null,
            record.thirdbetAmount || null,
            record.thirdbetResult || null,
            record.thirdbetactual || null,
            record.thirdbetexpectedcandle || null,
            record.fourthbetAmount || null,
            record.fourthbetResult || null,
            record.fourthbetactual || null,
            record.fourthbetexpectedcandle || null,
            record.fifthbetAmount || null,
            record.fifthbetResult || null,
            record.fifthbetactual || null,
            record.fifthbetexpectedcandle || null
          ]);
          upsertCount++;
        }
      } else {
        // Insert new with auto-generated ID
        await this.createRecord(pattern, record);
        upsertCount++;
      }
    }
    
    return upsertCount;
  }

  /**
   * Seed with starting amount
   */
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

  /**
   * Seed the first way (0.1 starting amount)
   */
  async seedTheFirstWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.1, symbol);
  }

  /**
   * Seed the second way (0.2 starting amount)
   */
  async seedTheSecondWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.2, symbol);
  }

  /**
   * Seed the third way (0.4 starting amount)
   */
  async seedTheThirdWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.4, symbol);
  }

  /**
   * Get records by session ID across all patterns
   */
  async getRecordsBySessionId(sessionid: string): Promise<Record<string, BetRecord[]>> {
    const patterns = Object.values(CandlePattern);
    const result: Record<string, BetRecord[]> = {};
    
    for (const pattern of patterns) {
      const records = await this.getRecords(pattern, { sessionid });
      if (records.length > 0) {
        result[pattern] = records;
      }
    }
    
    return result;
  }

  /**
   * Get statistics for a session
   */
  async getSessionStats(sessionid: string): Promise<any> {
    const patterns = Object.values(CandlePattern);
    const stats = {
      sessionid,
      total_patterns: 0,
      completed_sessions: 0,
      total_profit_loss: 0,
      patterns_details: [] as any[]
    };
    
    for (const pattern of patterns) {
      const records = await this.getRecords(pattern, { sessionid });
      
      for (const record of records) {
        if (record.sessionresult) {
          stats.completed_sessions++;
          stats.total_profit_loss += parseFloat(record.sessionresult) || 0;
        }
        stats.total_patterns++;
        
        stats.patterns_details.push({
          pattern,
          sessionresult: record.sessionresult,
          firstbetResult: record.firstbetResult,
          secondbetResult: record.secondbetResult,
          thirdbetResult: record.thirdbetResult,
          fourthbetResult: record.fourthbetResult,
          fifthbetResult: record.fifthbetResult
        });
      }
    }
    
    return stats;
  }

  /**
   * Close database connection pool
   */
  async closeConnection(): Promise<void> {
    await this.pool.end();
    console.log('Database connection pool closed.');
  }
}