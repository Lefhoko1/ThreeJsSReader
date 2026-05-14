import * as fs from 'fs/promises';
import * as path from 'path';

// ─── Config ───────────────────────────────────────────────────────
// Data directory for storing sessions
const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

export interface Session {
  id: number;
  sessionid: string;
  symbol: string;
  sessionresult?: string | null;
  firstbetAmount: number;
  created_at: Date;
  updated_at: Date;
}

export interface SessionData {
  id: number;
  sessionid: string;
  symbol: string;
  sessionresult?: string | null;
  firstbetAmount: number;
  created_at: string;
  updated_at: string;
}

export class SessionService {
  private readonly TABLE_NAME = 'sessions';
  private dataDir: string;
  private filePath: string;

  constructor() {
    this.dataDir = DATA_DIR;
    this.filePath = path.join(this.dataDir, `${this.TABLE_NAME}.json`);
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
   * Ensure sessions file exists
   */
  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.filePath);
    } catch {
      // Create empty array if file doesn't exist
      await this.saveSessions([]);
    }
  }

  /**
   * Load sessions from JSON file
   */
  private async loadSessions(): Promise<Session[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const sessionsData: SessionData[] = JSON.parse(data);
      // Convert string dates back to Date objects
      return sessionsData.map(session => ({
        ...session,
        created_at: new Date(session.created_at),
        updated_at: new Date(session.updated_at)
      }));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to load sessions: ${error.message}`);
    }
  }

  /**
   * Save sessions to JSON file
   */
  private async saveSessions(sessions: Session[]): Promise<void> {
    const sessionsData: SessionData[] = sessions.map(session => ({
      ...session,
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString()
    }));
    await fs.writeFile(this.filePath, JSON.stringify(sessionsData, null, 2), 'utf-8');
  }

  /**
   * Get next ID for a session
   */
  private async getNextId(): Promise<number> {
    const sessions = await this.loadSessions();
    if (sessions.length === 0) return 1;
    return Math.max(...sessions.map(s => s.id)) + 1;
  }

  /**
   * Ensure sessions table exists (creates JSON file if needed)
   */
  private async ensureTable(): Promise<void> {
    await this.ensureFile();
  }

  /**
   * Create a new session record.
   */
  async createSession(data: { sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }): Promise<Session> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const now = new Date();
    
    const newSession: Session = {
      id: await this.getNextId(),
      sessionid: data.sessionid,
      symbol: data.symbol,
      sessionresult: data.sessionresult || null,
      firstbetAmount: data.firstbetAmount,
      created_at: now,
      updated_at: now
    };
    
    sessions.push(newSession);
    await this.saveSessions(sessions);
    
    return newSession;
  }

  /**
   * Get a session by its sessionid.
   */
  async getSessionById(sessionid: string): Promise<Session | null> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const session = sessions.find(s => s.sessionid === sessionid);
    
    return session || null;
  }

  /**
   * Get multiple sessions with optional filtering.
   */
  async getSessions(options?: {
    symbol?: string;
    sessionresult?: string;
    limit?: number;
    offset?: number;
    order?: Array<[string, 'ASC' | 'DESC']>;
  }): Promise<Session[]> {
    await this.ensureTable();
    
    let sessions = await this.loadSessions();
    
    // Apply filters
    if (options?.symbol) {
      sessions = sessions.filter(s => s.symbol === options.symbol);
    }
    if (options?.sessionresult) {
      sessions = sessions.filter(s => s.sessionresult === options.sessionresult);
    }
    
    // Apply sorting
    if (options?.order && options.order.length > 0) {
      const [column, direction] = options.order[0];
      const sortDirection = direction === 'DESC' ? -1 : 1;
      sessions.sort((a, b) => {
        const aVal = a[column as keyof Session];
        const bVal = b[column as keyof Session];
        
        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;
        
        if (aVal < bVal) return -sortDirection;
        if (aVal > bVal) return sortDirection;
        return 0;
      });
    } else {
      // Default order by created_at descending
      sessions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }
    
    // Apply pagination
    if (options?.offset !== undefined) {
      const limit = options?.limit || 10;
      sessions = sessions.slice(options.offset, options.offset + limit);
    } else if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }
    
    return sessions;
  }

  /**
   * Get sessions by symbol with pagination
   */
  async getSessionsBySymbol(symbol: string, options?: {
    limit?: number;
    offset?: number;
    sessionresult?: string;
  }): Promise<Session[]> {
    await this.ensureTable();
    
    let sessions = await this.loadSessions();
    
    // Filter by symbol
    sessions = sessions.filter(s => s.symbol === symbol);
    
    // Filter by session result
    if (options?.sessionresult) {
      sessions = sessions.filter(s => s.sessionresult === options.sessionresult);
    }
    
    // Sort by created_at descending
    sessions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    
    // Apply pagination
    if (options?.offset !== undefined) {
      const limit = options?.limit || 10;
      sessions = sessions.slice(options.offset, options.offset + limit);
    } else if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }
    
    return sessions;
  }

  /**
   * Update a session by sessionid.
   */
  async updateSession(sessionid: string, updates: Partial<{ symbol: string; sessionresult: string | null; firstbetAmount: number }>): Promise<Session | null> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const index = sessions.findIndex(s => s.sessionid === sessionid);
    
    if (index === -1) return null;
    
    sessions[index] = {
      ...sessions[index],
      ...updates,
      updated_at: new Date()
    };
    
    await this.saveSessions(sessions);
    return sessions[index];
  }

  /**
   * Update session result only
   */
  async updateSessionResult(sessionid: string, sessionresult: string): Promise<Session | null> {
    return this.updateSession(sessionid, { sessionresult });
  }

  /**
   * Delete a session by sessionid.
   */
  async deleteSession(sessionid: string): Promise<boolean> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const filteredSessions = sessions.filter(s => s.sessionid !== sessionid);
    
    if (filteredSessions.length === sessions.length) {
      return false;
    }
    
    await this.saveSessions(filteredSessions);
    return true;
  }

  /**
   * Delete all sessions for a symbol
   */
  async deleteSessionsBySymbol(symbol: string): Promise<number> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const initialCount = sessions.length;
    const filteredSessions = sessions.filter(s => s.symbol !== symbol);
    
    const deletedCount = initialCount - filteredSessions.length;
    await this.saveSessions(filteredSessions);
    
    return deletedCount;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(symbol?: string): Promise<{
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    pendingSessions: number;
    winRate: number;
    totalFirstBetAmount: number;
    averageFirstBetAmount: number;
  }> {
    await this.ensureTable();
    
    let sessions = await this.loadSessions();
    
    // Filter by symbol if provided
    if (symbol) {
      sessions = sessions.filter(s => s.symbol === symbol);
    }
    
    const totalSessions = sessions.length;
    const successfulSessions = sessions.filter(s => s.sessionresult === 'win').length;
    const failedSessions = sessions.filter(s => s.sessionresult === 'loss').length;
    const pendingSessions = sessions.filter(s => !s.sessionresult).length;
    
    const totalFirstBetAmount = sessions.reduce((sum, s) => sum + (s.firstbetAmount || 0), 0);
    
    return {
      totalSessions,
      successfulSessions,
      failedSessions,
      pendingSessions,
      winRate: totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0,
      totalFirstBetAmount,
      averageFirstBetAmount: totalSessions > 0 ? totalFirstBetAmount / totalSessions : 0
    };
  }

  /**
   * Get recent sessions (last N days)
   */
  async getRecentSessions(days: number = 7, symbol?: string): Promise<Session[]> {
    await this.ensureTable();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let sessions = await this.loadSessions();
    
    // Filter by date
    sessions = sessions.filter(s => s.created_at >= cutoffDate);
    
    // Filter by symbol if provided
    if (symbol) {
      sessions = sessions.filter(s => s.symbol === symbol);
    }
    
    // Sort by created_at descending
    sessions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    
    return sessions;
  }

  /**
   * Create the sessions table if it doesn't exist.
   */
  async createTable(): Promise<void> {
    await this.ensureTable();
    console.log('Sessions JSON file created or verified.');
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionid: string): Promise<boolean> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    return sessions.some(s => s.sessionid === sessionid);
  }

  /**
   * Batch create multiple sessions
   */
  async batchCreateSessions(sessions: Array<{ sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }>): Promise<Session[]> {
    await this.ensureTable();
    
    const existingSessions = await this.loadSessions();
    const now = new Date();
    const newSessions: Session[] = [];
    
    for (const sessionData of sessions) {
      const newId = await this.getNextId();
      const newSession: Session = {
        id: newId,
        sessionid: sessionData.sessionid,
        symbol: sessionData.symbol,
        sessionresult: sessionData.sessionresult || null,
        firstbetAmount: sessionData.firstbetAmount,
        created_at: now,
        updated_at: now
      };
      newSessions.push(newSession);
    }
    
    const allSessions = [...existingSessions, ...newSessions];
    await this.saveSessions(allSessions);
    
    return newSessions;
  }

  /**
   * Get all unique symbols from sessions
   */
  async getUniqueSymbols(): Promise<string[]> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const symbols = new Set(sessions.map(s => s.symbol));
    return Array.from(symbols);
  }

  /**
   * Get session count by symbol
   */
  async getSessionCountBySymbol(): Promise<Map<string, number>> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const countMap = new Map<string, number>();
    
    for (const session of sessions) {
      const count = countMap.get(session.symbol) || 0;
      countMap.set(session.symbol, count + 1);
    }
    
    return countMap;
  }

  /**
   * Delete old sessions (older than specified date)
   */
  async deleteOldSessions(olderThan: Date): Promise<number> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const initialCount = sessions.length;
    const filteredSessions = sessions.filter(s => s.created_at >= olderThan);
    
    const deletedCount = initialCount - filteredSessions.length;
    await this.saveSessions(filteredSessions);
    
    return deletedCount;
  }

  /**
   * Export all sessions to a backup file
   */
  async exportToBackup(backupPath?: string): Promise<string> {
    await this.ensureTable();
    
    const sessions = await this.loadSessions();
    const backupFilePath = backupPath || path.join(this.dataDir, `sessions_backup_${Date.now()}.json`);
    
    const sessionsData: SessionData[] = sessions.map(session => ({
      ...session,
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString()
    }));
    
    await fs.writeFile(backupFilePath, JSON.stringify(sessionsData, null, 2), 'utf-8');
    console.log(`Sessions exported to ${backupFilePath}`);
    
    return backupFilePath;
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAllSessions(): Promise<void> {
    await this.saveSessions([]);
    console.log('All sessions cleared');
  }
}