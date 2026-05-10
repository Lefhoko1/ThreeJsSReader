import { Model, ModelStatic } from 'sequelize';
import { createBetRecordModel, BetRecordAttributes, BetRecordCreationAttributes } from '../models/BetRecord';
import { CandlePattern, UptrendPatterns, DowntrendPatterns } from '../strategyCombinations';
import sequelize from '../database';

export class BetRecordService {
  private models: Map<string, ModelStatic<Model<BetRecordAttributes, BetRecordCreationAttributes>>> = new Map();

  /**
   * Get or create the model for a specific pattern table.
   */
  private getModelForPattern(pattern: string): ModelStatic<Model<BetRecordAttributes, BetRecordCreationAttributes>> {
    const tableName = pattern.toLowerCase();
    const existingModel = this.models.get(tableName);
    if (existingModel) {
      return existingModel;
    }

    const betModel = createBetRecordModel(sequelize, tableName);
    this.models.set(tableName, betModel);
    return betModel;
  }

  /**
   * Create tables for all candle patterns.
   */
  async createTables(): Promise<void> {
    const patterns = Object.values(CandlePattern);
    for (const pattern of patterns) {
      this.getModelForPattern(pattern);
    }

    await sequelize.sync({ alter: true });
    console.log('Bet record tables created or updated.');
  }

  // ---------------------------------------------------------
  // CRUD operations
  // ---------------------------------------------------------
  /**
   * Create a new bet record in the specified pattern table.
   */
  async createRecord(pattern: string, data: Record<string, unknown>): Promise<Model> {
    const model = this.getModelForPattern(pattern);
    return model.create(data as any);
  }

  /**
   * Get a single bet record by its primary key from the specified pattern table.
   */
  async getRecordById(pattern: string, id: number): Promise<Model | null> {
    const model = this.getModelForPattern(pattern);
    return model.findByPk(id);
  }

  /**
   * Get multiple bet records from the specified pattern table.
   * Supports optional filtering by session and basic pagination.
   */
  async getRecords(
    pattern: string,
    options?: {
      sessionid?: string;
      sessionresult?: string;
      limit?: number;
      offset?: number;
      order?: Array<[string, 'ASC' | 'DESC']>;
    }
  ): Promise<Model[]> {
    const model = this.getModelForPattern(pattern);
    const where: Record<string, unknown> = {};

    if (options?.sessionid) {
      where.sessionid = options.sessionid;
    }
    if (options?.sessionresult) {
      where.sessionresult = options.sessionresult;
    }

    return model.findAll({
      where,
      limit: options?.limit,
      offset: options?.offset,
      order: options?.order,
    });
  }

  /**
   * Update any fields on a bet record in the specified pattern table.
   */
  async updateRecord(pattern: string, id: number, updates: Record<string, unknown>): Promise<Model | null> {
    const model = this.getModelForPattern(pattern);
    const record = await model.findByPk(id);
    if (!record) {
      return null;
    }

    await record.update(updates as any);
    return record;
  }

  // ---------------------------------------------------------
  // Specific bet updates
  // ---------------------------------------------------------
  /**
   * Update only the first bet fields for a given record.
   */
  async updateFirstBet(pattern: string, id: number, data: {
    firstbetAmount?: number;
    firstbetResult?: string;
    firstbetactual?: string;
    firstbetexpectedcandle?: string;
  }): Promise<Model | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update only the second bet fields for a given record.
   */
  async updateSecondBet(pattern: string, id: number, data: {
    secondbetAmount?: number;
    secondbetResult?: string;
    secondbetactual?: string;
    secondbetexpectedcandle?: string;
  }): Promise<Model | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update only the third bet fields for a given record.
   */
  async updateThirdBet(pattern: string, id: number, data: {
    thirdbetAmount?: number;
    thirdbetResult?: string;
    thirdbetactual?: string;
    thirdbetexpectedcandle?: string;
  }): Promise<Model | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update only the fourth bet fields for a given record.
   */
  async updateFourthBet(pattern: string, id: number, data: {
    fourthbetAmount?: number;
    fourthbetResult?: string;
    fourthbetactual?: string;
    fourthbetexpectedcandle?: string;
  }): Promise<Model | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update only the fifth bet fields for a given record.
   */
  async updateFifthBet(pattern: string, id: number, data: {
    fifthbetAmount?: number;
    fifthbetResult?: string;
    fifthbetactual?: string;
    fifthbetexpectedcandle?: string;
  }): Promise<Model | null> {
    return this.updateRecord(pattern, id, data);
  }

  /**
   * Update the overall session result for a given record.
   */
  async updateSessionResult(pattern: string, id: number, sessionresult: string): Promise<Model | null> {
    return this.updateRecord(pattern, id, { sessionresult });
  }

  // ---------------------------------------------------------
  // Delete
  // ---------------------------------------------------------
  /**
   * Delete a bet record by primary key from the specified pattern table.
   */
  async deleteRecord(pattern: string, id: number): Promise<boolean> {
    const model = this.getModelForPattern(pattern);
    const deletedCount = await model.destroy({
      where: { id },
    });
    return deletedCount > 0;
  }

  // ---------------------------------------------------------
  // Seeding methods
  // ---------------------------------------------------------
  /**
   * Seed the database with initial bet records for uptrend or downtrend patterns.
   * Creates a new session and populates bet records for each pattern in the specified trend.
   */
  async seedTheFirstWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.1, symbol);
  }

  /**
   * Seed the database with bet records starting at 0.2, doubling each time.
   */
  async seedTheSecondWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.2, symbol);
  }

  /**
   * Seed the database with bet records starting at 0.4, doubling each time.
   */
  async seedTheThirdWay(trend: 'uptrend' | 'downtrend', symbol: string): Promise<string> {
    return this.seedWithStartingAmount(trend, 0.4, symbol);
  }

  private async seedWithStartingAmount(trend: 'uptrend' | 'downtrend', startingAmount: number, symbol: string): Promise<string> {
    // Generate unique session ID
    const sessionid = crypto.randomUUID();

    // Note: Session creation should be handled by SessionService
    // Here we just return the sessionid for the caller to create the session

    // Determine which patterns to seed
    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    // Bet amounts: starting amount, then double each time
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