import { Session } from '../models/Session';

export class SessionService {
  /**
   * Create a new session record.
   */
  async createSession(data: { sessionid: string; symbol: string; sessionresult?: string | null; firstbetAmount: number }): Promise<Session> {
    return Session.create(data);
  }

  /**
   * Get a session by its sessionid.
   */
  async getSessionById(sessionid: string): Promise<Session | null> {
    return Session.findOne({ where: { sessionid } });
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
    const where: Record<string, unknown> = {};

    if (options?.symbol) {
      where.symbol = options.symbol;
    }
    if (options?.sessionresult) {
      where.sessionresult = options.sessionresult;
    }

    return Session.findAll({
      where,
      limit: options?.limit,
      offset: options?.offset,
      order: options?.order,
    });
  }

  /**
   * Update a session by sessionid.
   */
  async updateSession(sessionid: string, updates: Partial<{ symbol: string; sessionresult: string | null; firstbetAmount: number }>): Promise<Session | null> {
    const session = await Session.findOne({ where: { sessionid } });
    if (!session) {
      return null;
    }

    await session.update(updates);
    return session;
  }

  /**
   * Delete a session by sessionid.
   */
  async deleteSession(sessionid: string): Promise<boolean> {
    const deletedCount = await Session.destroy({ where: { sessionid } });
    return deletedCount > 0;
  }

  /**
   * Create the sessions table if it doesn't exist.
   */
  async createTable(): Promise<void> {
    await Session.sync({ alter: true });
    console.log('Sessions table created or updated.');
  }
}