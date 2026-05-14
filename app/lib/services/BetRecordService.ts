import { CandlePattern, UptrendPatterns, DowntrendPatterns } from '../strategyCombinations';
import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Config ───────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'data', 'bet_records');

// Interface for bet record
interface BetRecord {
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
  created_at: string;
  updated_at: string;
}

export class BetRecordService {
  private dataDir: string;

  constructor() {
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
   * Get file path for a specific pattern
   */
  private getFilePath(pattern: string): string {
    return path.join(this.dataDir, `${pattern.toLowerCase()}.json`);
  }

  /**
   * Load records from JSON file for a pattern
   */
  private async loadRecords(pattern: string): Promise<BetRecord[]> {
    const filePath = this.getFilePath(pattern);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to load records for "${pattern}": ${error.message}`);
    }
  }

  /**
   * Save records to JSON file for a pattern
   */
  private async saveRecords(pattern: string, records: BetRecord[]): Promise<void> {
    const filePath = this.getFilePath(pattern);
    await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8');
  }

  /**
   * Get next ID for a pattern
   */
  private async getNextId(pattern: string): Promise<number> {
    const records = await this.loadRecords(pattern);
    if (records.length === 0) return 1;
    return Math.max(...records.map(r => r.id)) + 1;
  }

  /**
   * Ensure table exists for a specific pattern (creates JSON file if needed)
   */
  private async ensureTable(pattern: string): Promise<void> {
    const filePath = this.getFilePath(pattern);
    try {
      await fs.access(filePath);
    } catch {
      // Create empty array if file doesn't exist
      await this.saveRecords(pattern, []);
    }
  }

  /**
   * Create tables for all candle patterns.
   */
  async createTables(): Promise<void> {
    const patterns = Object.values(CandlePattern);
    for (const pattern of patterns) {
      await this.ensureTable(pattern);
    }
    console.log('Bet record JSON files created or verified.');
  }

  // ---------------------------------------------------------
  // CRUD operations
  // ---------------------------------------------------------

  /**
   * Create a new bet record in the specified pattern table.
   */
  async createRecord(pattern: string, data: Partial<BetRecord>): Promise<BetRecord> {
    const tableName = `bet_records_${pattern.toLowerCase()}`;
    await this.ensureTable(pattern);
    
    const records = await this.loadRecords(pattern);
    const now = new Date().toISOString();
    
    const newRecord: BetRecord = {
      id: await this.getNextId(pattern),
      sessionid: data.sessionid || '',
      sessionresult: data.sessionresult || null,
      firstbetAmount: data.firstbetAmount || null,
      firstbetResult: data.firstbetResult || null,
      firstbetactual: data.firstbetactual || null,
      firstbetexpectedcandle: data.firstbetexpectedcandle || null,
      secondbetAmount: data.secondbetAmount || null,
      secondbetResult: data.secondbetResult || null,
      secondbetactual: data.secondbetactual || null,
      secondbetexpectedcandle: data.secondbetexpectedcandle || null,
      thirdbetAmount: data.thirdbetAmount || null,
      thirdbetResult: data.thirdbetResult || null,
      thirdbetactual: data.thirdbetactual || null,
      thirdbetexpectedcandle: data.thirdbetexpectedcandle || null,
      fourthbetAmount: data.fourthbetAmount || null,
      fourthbetResult: data.fourthbetResult || null,
      fourthbetactual: data.fourthbetactual || null,
      fourthbetexpectedcandle: data.fourthbetexpectedcandle || null,
      fifthbetAmount: data.fifthbetAmount || null,
      fifthbetResult: data.fifthbetResult || null,
      fifthbetactual: data.fifthbetactual || null,
      fifthbetexpectedcandle: data.fifthbetexpectedcandle || null,
      created_at: now,
      updated_at: now,
    };
    
    records.push(newRecord);
    await this.saveRecords(pattern, records);
    
    return newRecord;
  }

  /**
   * Get a single bet record by its primary key.
   */
  async getRecordById(pattern: string, id: number): Promise<BetRecord | null> {
    await this.ensureTable(pattern);
    const records = await this.loadRecords(pattern);
    const record = records.find(r => r.id === id);
    return record || null;
  }

  /**
   * Get multiple bet records with optional filtering.
   *//**
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
  await this.ensureTable(pattern);
  let records = await this.loadRecords(pattern);
  
  // Apply filters
  if (options?.sessionid) {
    records = records.filter(r => r.sessionid === options.sessionid);
  }
  if (options?.sessionresult) {
    records = records.filter(r => r.sessionresult === options.sessionresult);
  }
  
  // Apply sorting
  if (options?.orderBy) {
    const orderDirection = options.orderDirection === 'desc' ? -1 : 1;
    records.sort((a, b) => {
      const aVal = a[options.orderBy as keyof BetRecord];
      const bVal = b[options.orderBy as keyof BetRecord];
      
      // Handle null/undefined values - push them to the end for asc, beginning for desc
      if (aVal === null || aVal === undefined) return orderDirection;
      if (bVal === null || bVal === undefined) return -orderDirection;
      
      // Compare non-null values
      if (aVal < bVal) return -orderDirection;
      if (aVal > bVal) return orderDirection;
      return 0;
    });
  }
  
  // Apply pagination
  if (options?.offset !== undefined) {
    const limit = options?.limit || 10;
    records = records.slice(options.offset, options.offset + limit);
  } else if (options?.limit) {
    records = records.slice(0, options.limit);
  }
  
  return records;
}
  async updateRecord(pattern: string, id: number, updates: Partial<BetRecord>): Promise<BetRecord | null> {
    await this.ensureTable(pattern);
    const records = await this.loadRecords(pattern);
    const index = records.findIndex(r => r.id === id);
    
    if (index === -1) return null;
    
    records[index] = {
      ...records[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    await this.saveRecords(pattern, records);
    return records[index];
  }

  // ---------------------------------------------------------
  // Specific bet updates
  // ---------------------------------------------------------

  async updateFirstBet(pattern: string, id: number, data: {
    firstbetAmount?: number;
    firstbetResult?: string;
    firstbetactual?: string;
    firstbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateSecondBet(pattern: string, id: number, data: {
    secondbetAmount?: number;
    secondbetResult?: string;
    secondbetactual?: string;
    secondbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateThirdBet(pattern: string, id: number, data: {
    thirdbetAmount?: number;
    thirdbetResult?: string;
    thirdbetactual?: string;
    thirdbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateFourthBet(pattern: string, id: number, data: {
    fourthbetAmount?: number;
    fourthbetResult?: string;
    fourthbetactual?: string;
    fourthbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateFifthBet(pattern: string, id: number, data: {
    fifthbetAmount?: number;
    fifthbetResult?: string;
    fifthbetactual?: string;
    fifthbetexpectedcandle?: string;
  }): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, data);
  }

  async updateSessionResult(pattern: string, id: number, sessionresult: string): Promise<BetRecord | null> {
    return this.updateRecord(pattern, id, { sessionresult });
  }

  // ---------------------------------------------------------
  // Delete
  // ---------------------------------------------------------

  async deleteRecord(pattern: string, id: number): Promise<boolean> {
    await this.ensureTable(pattern);
    const records = await this.loadRecords(pattern);
    const filteredRecords = records.filter(r => r.id !== id);
    
    if (filteredRecords.length === records.length) {
      return false;
    }
    
    await this.saveRecords(pattern, filteredRecords);
    return true;
  }

  // ---------------------------------------------------------
  // Batch operations (like the candle upsert pattern)
  // ---------------------------------------------------------

  /**
   * Batch upsert multiple bet records
   */
  async upsertRecords(pattern: string, records: Partial<BetRecord>[]): Promise<number> {
    await this.ensureTable(pattern);
    const existingRecords = await this.loadRecords(pattern);
    const now = new Date().toISOString();
    
    let upsertCount = 0;
    
    for (const record of records) {
      const index = existingRecords.findIndex(r => r.id === record.id);
      
      if (index !== -1) {
        // Update existing
        existingRecords[index] = {
          ...existingRecords[index],
          ...record,
          updated_at: now,
        };
        upsertCount++;
      } else if (record.id) {
        // Insert with specific ID
        const newRecord: BetRecord = {
          id: record.id,
          sessionid: record.sessionid || '',
          sessionresult: record.sessionresult || null,
          firstbetAmount: record.firstbetAmount || null,
          firstbetResult: record.firstbetResult || null,
          firstbetactual: record.firstbetactual || null,
          firstbetexpectedcandle: record.firstbetexpectedcandle || null,
          secondbetAmount: record.secondbetAmount || null,
          secondbetResult: record.secondbetResult || null,
          secondbetactual: record.secondbetactual || null,
          secondbetexpectedcandle: record.secondbetexpectedcandle || null,
          thirdbetAmount: record.thirdbetAmount || null,
          thirdbetResult: record.thirdbetResult || null,
          thirdbetactual: record.thirdbetactual || null,
          thirdbetexpectedcandle: record.thirdbetexpectedcandle || null,
          fourthbetAmount: record.fourthbetAmount || null,
          fourthbetResult: record.fourthbetResult || null,
          fourthbetactual: record.fourthbetactual || null,
          fourthbetexpectedcandle: record.fourthbetexpectedcandle || null,
          fifthbetAmount: record.fifthbetAmount || null,
          fifthbetResult: record.fifthbetResult || null,
          fifthbetactual: record.fifthbetactual || null,
          fifthbetexpectedcandle: record.fifthbetexpectedcandle || null,
          created_at: record.created_at || now,
          updated_at: now,
        };
        existingRecords.push(newRecord);
        upsertCount++;
      } else {
        // Insert new with auto-generated ID
        const newId = await this.getNextId(pattern);
        const newRecord: BetRecord = {
          id: newId,
          sessionid: record.sessionid || '',
          sessionresult: record.sessionresult || null,
          firstbetAmount: record.firstbetAmount || null,
          firstbetResult: record.firstbetResult || null,
          firstbetactual: record.firstbetactual || null,
          firstbetexpectedcandle: record.firstbetexpectedcandle || null,
          secondbetAmount: record.secondbetAmount || null,
          secondbetResult: record.secondbetResult || null,
          secondbetactual: record.secondbetactual || null,
          secondbetexpectedcandle: record.secondbetexpectedcandle || null,
          thirdbetAmount: record.thirdbetAmount || null,
          thirdbetResult: record.thirdbetResult || null,
          thirdbetactual: record.thirdbetactual || null,
          thirdbetexpectedcandle: record.thirdbetexpectedcandle || null,
          fourthbetAmount: record.fourthbetAmount || null,
          fourthbetResult: record.fourthbetResult || null,
          fourthbetactual: record.fourthbetactual || null,
          fourthbetexpectedcandle: record.fourthbetexpectedcandle || null,
          fifthbetAmount: record.fifthbetAmount || null,
          fifthbetResult: record.fifthbetResult || null,
          fifthbetactual: record.fifthbetactual || null,
          fifthbetexpectedcandle: record.fifthbetexpectedcandle || null,
          created_at: now,
          updated_at: now,
        };
        existingRecords.push(newRecord);
        upsertCount++;
      }
    }
    
    await this.saveRecords(pattern, existingRecords);
    return upsertCount;
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