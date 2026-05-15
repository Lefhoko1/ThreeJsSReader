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
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool(DB_CONFIG);
  }

  /**
   * Create sessions table if it doesn't exist
   */
  private async createTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sessionid VARCHAR(255) NOT NULL UNIQUE,
        symbol VARCHAR(50) NOT NULL,
        sessionresult VARCHAR(10) NULL,
        firstbetAmount DECIMAL(20, 8) NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_sessionid (sessionid),
        INDEX idx_symbol (symbol),
        INDEX idx_sessionresult (sessionresult),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await this.pool.execute(createTableSQL);
    console.log('Sessions table created or verified.');
  }

  /**
   * Ensure sessions table exists
   */
  private async ensureTable(): Promise<void> {
    await this.createTable();
  }

  /**
   * Create a new session record.
   */
  async createSession(data: { sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }): Promise<Session> {
    await this.ensureTable();
    
    const now = new Date();
    const insertSQL = `
      INSERT INTO ${this.TABLE_NAME} (sessionid, symbol, sessionresult, firstbetAmount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await this.pool.execute(insertSQL, [
      data.sessionid,
      data.symbol,
      data.sessionresult || null,
      data.firstbetAmount,
      now,
      now
    ]);
    
    // Fetch the created record
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${this.TABLE_NAME} WHERE id = ?`,
      [(result as any).insertId]
    );
    
    const session = (rows as any[])[0];
    return {
      id: session.id,
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult,
      firstbetAmount: parseFloat(session.firstbetAmount),
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at)
    };
  }

  /**
   * Get a session by its sessionid.
   */
  async getSessionById(sessionid: string): Promise<Session | null> {
    await this.ensureTable();
    
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${this.TABLE_NAME} WHERE sessionid = ?`,
      [sessionid]
    );
    
    const sessions = rows as any[];
    if (sessions.length === 0) return null;
    
    const session = sessions[0];
    return {
      id: session.id,
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult,
      firstbetAmount: parseFloat(session.firstbetAmount),
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at)
    };
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
    
    let query = `SELECT * FROM ${this.TABLE_NAME} WHERE 1=1`;
    const params: any[] = [];
    
    // Apply filters
    if (options?.symbol) {
      query += ` AND symbol = ?`;
      params.push(options.symbol);
    }
    if (options?.sessionresult) {
      query += ` AND sessionresult = ?`;
      params.push(options.sessionresult);
    }
    
    // Apply sorting
    if (options?.order && options.order.length > 0) {
      const [column, direction] = options.order[0];
      query += ` ORDER BY ${column} ${direction}`;
    } else {
      // Default order by created_at descending
      query += ` ORDER BY created_at DESC`;
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
    const sessions = rows as any[];
    
    return sessions.map(session => ({
      id: session.id,
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult,
      firstbetAmount: parseFloat(session.firstbetAmount),
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at)
    }));
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
    
    let query = `SELECT * FROM ${this.TABLE_NAME} WHERE symbol = ?`;
    const params: any[] = [symbol];
    
    // Filter by session result
    if (options?.sessionresult) {
      query += ` AND sessionresult = ?`;
      params.push(options.sessionresult);
    }
    
    // Sort by created_at descending
    query += ` ORDER BY created_at DESC`;
    
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
    const sessions = rows as any[];
    
    return sessions.map(session => ({
      id: session.id,
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult,
      firstbetAmount: parseFloat(session.firstbetAmount),
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at)
    }));
  }

  /**
   * Update a session by sessionid.
   */
  async updateSession(sessionid: string, updates: Partial<{ symbol: string; sessionresult: string | null; firstbetAmount: number }>): Promise<Session | null> {
    await this.ensureTable();
    
    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (updates.symbol !== undefined) {
      updateFields.push('symbol = ?');
      values.push(updates.symbol);
    }
    if (updates.sessionresult !== undefined) {
      updateFields.push('sessionresult = ?');
      values.push(updates.sessionresult);
    }
    if (updates.firstbetAmount !== undefined) {
      updateFields.push('firstbetAmount = ?');
      values.push(updates.firstbetAmount);
    }
    
    if (updateFields.length === 0) {
      return this.getSessionById(sessionid);
    }
    
    updateFields.push('updated_at = ?');
    values.push(new Date());
    values.push(sessionid);
    
    const updateSQL = `UPDATE ${this.TABLE_NAME} SET ${updateFields.join(', ')} WHERE sessionid = ?`;
    await this.pool.execute(updateSQL, values);
    
    return this.getSessionById(sessionid);
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
    
    const [result] = await this.pool.execute(
      `DELETE FROM ${this.TABLE_NAME} WHERE sessionid = ?`,
      [sessionid]
    );
    
    return (result as any).affectedRows > 0;
  }

  /**
   * Delete all sessions for a symbol
   */
  async deleteSessionsBySymbol(symbol: string): Promise<number> {
    await this.ensureTable();
    
    const [result] = await this.pool.execute(
      `DELETE FROM ${this.TABLE_NAME} WHERE symbol = ?`,
      [symbol]
    );
    
    return (result as any).affectedRows;
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
    
    let query = `SELECT 
      COUNT(*) as totalSessions,
      SUM(CASE WHEN sessionresult = 'win' THEN 1 ELSE 0 END) as successfulSessions,
      SUM(CASE WHEN sessionresult = 'loss' THEN 1 ELSE 0 END) as failedSessions,
      SUM(CASE WHEN sessionresult IS NULL THEN 1 ELSE 0 END) as pendingSessions,
      SUM(firstbetAmount) as totalFirstBetAmount,
      AVG(firstbetAmount) as averageFirstBetAmount
      FROM ${this.TABLE_NAME} WHERE 1=1`;
    
    const params: any[] = [];
    
    if (symbol) {
      query += ` AND symbol = ?`;
      params.push(symbol);
    }
    
    const [rows] = await this.pool.execute(query, params);
    const stats = (rows as any[])[0];
    
    const totalSessions = parseInt(stats.totalSessions) || 0;
    const successfulSessions = parseInt(stats.successfulSessions) || 0;
    
    return {
      totalSessions,
      successfulSessions: successfulSessions,
      failedSessions: parseInt(stats.failedSessions) || 0,
      pendingSessions: parseInt(stats.pendingSessions) || 0,
      winRate: totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0,
      totalFirstBetAmount: parseFloat(stats.totalFirstBetAmount) || 0,
      averageFirstBetAmount: parseFloat(stats.averageFirstBetAmount) || 0
    };
  }

  /**
   * Get recent sessions (last N days)
   */
  async getRecentSessions(days: number = 7, symbol?: string): Promise<Session[]> {
    await this.ensureTable();
    
    let query = `
      SELECT * FROM ${this.TABLE_NAME} 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const params: any[] = [days];
    
    if (symbol) {
      query += ` AND symbol = ?`;
      params.push(symbol);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const [rows] = await this.pool.execute(query, params);
    const sessions = rows as any[];
    
    return sessions.map(session => ({
      id: session.id,
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult,
      firstbetAmount: parseFloat(session.firstbetAmount),
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at)
    }));
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionid: string): Promise<boolean> {
    await this.ensureTable();
    
    const [rows] = await this.pool.execute(
      `SELECT COUNT(*) as count FROM ${this.TABLE_NAME} WHERE sessionid = ?`,
      [sessionid]
    );
    
    return (rows as any[])[0].count > 0;
  }

  /**
   * Batch create multiple sessions
   */
  async batchCreateSessions(sessions: Array<{ sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }>): Promise<Session[]> {
    await this.ensureTable();
    
    const now = new Date();
    const values: any[] = [];
    const placeholders: string[] = [];
    
    for (const session of sessions) {
      placeholders.push('(?, ?, ?, ?, ?, ?)');
      values.push(
        session.sessionid,
        session.symbol,
        session.sessionresult || null,
        session.firstbetAmount,
        now,
        now
      );
    }
    
    const insertSQL = `
      INSERT IGNORE INTO ${this.TABLE_NAME} (sessionid, symbol, sessionresult, firstbetAmount, created_at, updated_at)
      VALUES ${placeholders.join(', ')}
    `;
    
    await this.pool.execute(insertSQL, values);
    
    // Fetch all created sessions
    const sessionIds = sessions.map(s => s.sessionid);
    const placeholdersForSelect = sessionIds.map(() => '?').join(',');
    const [rows] = await this.pool.execute(
      `SELECT * FROM ${this.TABLE_NAME} WHERE sessionid IN (${placeholdersForSelect})`,
      sessionIds
    );
    
    const createdSessions = rows as any[];
    return createdSessions.map(session => ({
      id: session.id,
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult,
      firstbetAmount: parseFloat(session.firstbetAmount),
      created_at: new Date(session.created_at),
      updated_at: new Date(session.updated_at)
    }));
  }

  /**
   * Get all unique symbols from sessions
   */
  async getUniqueSymbols(): Promise<string[]> {
    await this.ensureTable();
    
    const [rows] = await this.pool.execute(
      `SELECT DISTINCT symbol FROM ${this.TABLE_NAME} ORDER BY symbol`
    );
    
    return (rows as any[]).map(row => row.symbol);
  }

  /**
   * Get session count by symbol
   */
  async getSessionCountBySymbol(): Promise<Map<string, number>> {
    await this.ensureTable();
    
    const [rows] = await this.pool.execute(
      `SELECT symbol, COUNT(*) as count FROM ${this.TABLE_NAME} GROUP BY symbol`
    );
    
    const countMap = new Map<string, number>();
    for (const row of rows as any[]) {
      countMap.set(row.symbol, row.count);
    }
    
    return countMap;
  }

  /**
   * Delete old sessions (older than specified date)
   */
  async deleteOldSessions(olderThan: Date): Promise<number> {
    await this.ensureTable();
    
    const [result] = await this.pool.execute(
      `DELETE FROM ${this.TABLE_NAME} WHERE created_at < ?`,
      [olderThan]
    );
    
    return (result as any).affectedRows;
  }

  /**
   * Export all sessions to a backup file (optional - keeps JSON export but not required for DB)
   */
  async exportToBackup(backupPath?: string): Promise<string> {
    // This method is kept for compatibility but now returns a message
    // since data is already in MySQL
    const exportFile = backupPath || `sessions_backup_${Date.now()}.json`;
    console.log(`Data is in MySQL database. To backup, use mysqldump. Export path requested: ${exportFile}`);
    return exportFile;
  }

  /**
   * Clear all sessions (use with caution)
   */
  async clearAllSessions(): Promise<void> {
    await this.ensureTable();
    await this.pool.execute(`DELETE FROM ${this.TABLE_NAME}`);
    console.log('All sessions cleared');
  }

  /**
   * Initialize the database table
   */
  async initialize(): Promise<void> {
    await this.ensureTable();
    console.log('Session service initialized');
  }

  /**
   * Close database connection pool
   */
  async closeConnection(): Promise<void> {
    await this.pool.end();
    console.log('Database connection closed');
  }
}