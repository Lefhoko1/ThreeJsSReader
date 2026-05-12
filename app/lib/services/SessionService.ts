import { createClient } from "@supabase/supabase-js";

// ─── Config ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Session table schema
const SESSIONS_SCHEMA = `
  id                BIGSERIAL   PRIMARY KEY,
  sessionid         UUID        NOT NULL UNIQUE,
  symbol            TEXT        NOT NULL,
  sessionresult     TEXT,
  firstbetAmount    DECIMAL(10,2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
`;

export interface Session {
  id: number;
  sessionid: string;
  symbol: string;
  sessionresult?: string | null;
  firstbetAmount: number;
  created_at: Date;
  updated_at: Date;
}

export class SessionService {
  private supabase;
  private readonly TABLE_NAME = 'sessions';

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /**
   * Ensure sessions table exists (like ensureTable in your candle sync)
   */
  private async ensureTable(): Promise<void> {
    const { error } = await this.supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
          ${SESSIONS_SCHEMA}
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_sessionid ON ${this.TABLE_NAME} (sessionid);
        CREATE INDEX IF NOT EXISTS idx_sessions_symbol ON ${this.TABLE_NAME} (symbol);
        CREATE INDEX IF NOT EXISTS idx_sessions_sessionresult ON ${this.TABLE_NAME} (sessionresult);
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON ${this.TABLE_NAME} (created_at DESC);
      `,
    });
    
    if (error) throw new Error(`Table creation failed for "${this.TABLE_NAME}": ${error.message}`);
  }

  /**
   * Create a new session record.
   */
  async createSession(data: { sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }): Promise<Session> {
    await this.ensureTable();
    
    const { data: session, error } = await this.supabase
      .from(this.TABLE_NAME)
      .insert({
        sessionid: data.sessionid,
        symbol: data.symbol,
        sessionresult: data.sessionresult || null,
        firstbetAmount: data.firstbetAmount,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();
    
    if (error) throw new Error(`Create session failed: ${error.message}`);
    return session;
  }

  /**
   * Get a session by its sessionid.
   */
  async getSessionById(sessionid: string): Promise<Session | null> {
    await this.ensureTable();
    
    const { data: session, error } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('sessionid', sessionid)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return session;
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
    
    let query = this.supabase.from(this.TABLE_NAME).select('*');
    
    if (options?.symbol) {
      query = query.eq('symbol', options.symbol);
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
    if (options?.order && options.order.length > 0) {
      const [column, direction] = options.order[0];
      query = query.order(column, { ascending: direction === 'ASC' });
    } else {
      // Default order by created_at descending
      query = query.order('created_at', { ascending: false });
    }
    
    const { data: sessions, error } = await query;
    if (error) throw new Error(`Get sessions failed: ${error.message}`);
    return sessions || [];
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
    
    let query = this.supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('symbol', symbol);
    
    if (options?.sessionresult) {
      query = query.eq('sessionresult', options.sessionresult);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    const { data: sessions, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Get sessions by symbol failed: ${error.message}`);
    return sessions || [];
  }

  /**
   * Update a session by sessionid.
   */
  async updateSession(sessionid: string, updates: Partial<{ symbol: string; sessionresult: string | null; firstbetAmount: number }>): Promise<Session | null> {
    await this.ensureTable();
    
    const { data: session, error } = await this.supabase
      .from(this.TABLE_NAME)
      .update({
        ...updates,
        updated_at: new Date()
      })
      .eq('sessionid', sessionid)
      .select()
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return session;
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
    
    const { error, count } = await this.supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('sessionid', sessionid);
    
    if (error) throw new Error(`Delete session failed: ${error.message}`);
    return (count || 0) > 0;
  }

  /**
   * Delete all sessions for a symbol
   */
  async deleteSessionsBySymbol(symbol: string): Promise<number> {
    await this.ensureTable();
    
    const { error, count } = await this.supabase
      .from(this.TABLE_NAME)
      .delete()
      .eq('symbol', symbol);
    
    if (error) throw new Error(`Delete sessions by symbol failed: ${error.message}`);
    return count || 0;
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
    
    let query = this.supabase.from(this.TABLE_NAME).select('*');
    if (symbol) {
      query = query.eq('symbol', symbol);
    }
    
    const { data: sessions, error } = await query;
    if (error) throw new Error(`Get session stats failed: ${error.message}`);
    
    const totalSessions = sessions?.length || 0;
    const successfulSessions = sessions?.filter(s => s.sessionresult === 'win').length || 0;
    const failedSessions = sessions?.filter(s => s.sessionresult === 'loss').length || 0;
    const pendingSessions = sessions?.filter(s => !s.sessionresult).length || 0;
    
    const totalFirstBetAmount = sessions?.reduce((sum, s) => sum + (s.firstbetAmount || 0), 0) || 0;
    
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
    
    let query = this.supabase
      .from(this.TABLE_NAME)
      .select('*')
      .gte('created_at', cutoffDate.toISOString());
    
    if (symbol) {
      query = query.eq('symbol', symbol);
    }
    
    const { data: sessions, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(`Get recent sessions failed: ${error.message}`);
    return sessions || [];
  }

  /**
   * Create the sessions table if it doesn't exist.
   */
  async createTable(): Promise<void> {
    await this.ensureTable();
    console.log('Sessions table created or updated.');
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionid: string): Promise<boolean> {
    await this.ensureTable();
    
    const { count, error } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('sessionid', sessionid);
    
    if (error) throw new Error(`Check session exists failed: ${error.message}`);
    return (count || 0) > 0;
  }

  /**
   * Batch create multiple sessions
   */
  async batchCreateSessions(sessions: Array<{ sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }>): Promise<Session[]> {
    await this.ensureTable();
    
    const sessionsWithTimestamps = sessions.map(session => ({
      sessionid: session.sessionid,
      symbol: session.symbol,
      sessionresult: session.sessionresult || null,
      firstbetAmount: session.firstbetAmount,
      created_at: new Date(),
      updated_at: new Date()
    }));
    
    const { data: createdSessions, error } = await this.supabase
      .from(this.TABLE_NAME)
      .insert(sessionsWithTimestamps)
      .select();
    
    if (error) throw new Error(`Batch create sessions failed: ${error.message}`);
    return createdSessions || [];
  }
}