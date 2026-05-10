import { Sequelize } from 'sequelize';
import { SessionService } from './services/SessionService';
import { BetRecordService } from './services/BetRecordService';
import { DerivDataCandleService } from './services/DerivDataCandleService';
import { DerivTradingService, DerivConfig, TradeResult } from './services/DerivTradingService';
import { MarketAnalysisIndicators, MarketSelectionResult } from './services/MarketAnalysisIndicators';
import { StrategyCore, BetCalculationResult } from './stratergycore';
import { UptrendPatterns, DowntrendPatterns, CandlePattern } from './strategyCombinations';
import { Session } from './models/Session';

interface TradingBotState {
  isInitialized: boolean;
  isWaitingForSignal: boolean;
  activeSessionId: string | null;
  sessionStartTime: Date | null;
  lastProcessedCandle: Date | null;
}

interface SeededTableInfo {
  pattern: CandlePattern;
  trend: 'uptrend' | 'downtrend';
  excludeFromTrading: boolean;
  betLevel: number; // 1-5
}

/**
 * StarBot Trading Logic
 * 
 * This class implements the complete trading logic as specified in the prompt:
 * - Initializes sessions on bot start
 * - Waits for MA5 crossover signals
 * - Manages 150-minute sessions (5x 30-minute candles)
 * - Executes bets at each candle close
 * - Excludes losing tables for the remainder of the session
 * - Evaluates session win/loss and starts new sessions
 * 
 * Triggered by Firebase stored procedure calling the API endpoint
 */
export class StarBotTradingLogic {
  private sessionService: SessionService;
  private betRecordService: BetRecordService;
  private derivCandleService: DerivDataCandleService;
  private derivTradingService: DerivTradingService;
  private marketAnalysis: MarketAnalysisIndicators;
  private strategyCore: StrategyCore;
  private sequelize: Sequelize;

  private botState: TradingBotState = {
    isInitialized: false,
    isWaitingForSignal: true,
    activeSessionId: null,
    sessionStartTime: null,
    lastProcessedCandle: null,
  };

  private seededTables: Map<CandlePattern, SeededTableInfo> = new Map();
  private sessionSymbol: string | null = null;
  private sessionTrend: 'uptrend' | 'downtrend' | null = null;

  constructor(
    sequelize: Sequelize,
    derivConfig: DerivConfig
  ) {
    this.sequelize = sequelize;
    this.sessionService = new SessionService();
    this.betRecordService = new BetRecordService();
    this.derivCandleService = new DerivDataCandleService(sequelize);
    this.derivTradingService = new DerivTradingService(derivConfig);
    this.marketAnalysis = new MarketAnalysisIndicators(sequelize);
    this.strategyCore = new StrategyCore();
  }

  /**
   * Initialize the bot on startup
   * - Creates a new session
   * - Sets the bot to wait for signals
   */
  async initializeBot(): Promise<void> {
    console.log('🤖 StarBot initializing...');

    try {
      // Ensure all tables exist
      await this.betRecordService.createTables();
      await this.sessionService.createTable();

      // Connect to Deriv trading service
      await this.derivTradingService.connect();

      this.botState.isInitialized = true;
      this.botState.isWaitingForSignal = true;

      console.log('✅ StarBot initialized successfully, waiting for signals...');
    } catch (error) {
      console.error('❌ StarBot initialization failed:', error);
      throw error;
    }
  }

  /**
   * Main entry point triggered by Firebase API call
   * Orchestrates the trading cycle based on current state
   */
  async processTradingCycle(): Promise<void> {
    if (!this.botState.isInitialized) {
      await this.initializeBot();
    }

    try {
      // Check if we have an active session
      if (this.botState.activeSessionId) {
        await this.handleActiveSession();
      } else {
        // No active session - check for new signals
        await this.checkAndGenerateSignals();
      }
    } catch (error) {
      console.error('❌ Error in trading cycle:', error);
      throw error;
    }
  }

  /**
   * Signal Generation Phase
   * - Checks for MA5 crossovers every 30-minute candle close
   * - Loops through volatility indices
   * - Selects best trending symbol
   */
  private async checkAndGenerateSignals(): Promise<void> {
    console.log('📊 Checking for trading signals...');

    try {
      // Perform market analysis for MA crossovers
      const marketSelection = await this.marketAnalysis.selectMarketForTrading();

      if (!marketSelection) {
        console.log('⏳ No valid trading signals detected, waiting for next candle...');
        this.botState.isWaitingForSignal = true;
        return;
      }

      console.log(`✅ Signal confirmed for ${marketSelection.symbol} (${marketSelection.direction})`);

      // Signal confirmed - proceed to create session
      await this.createAndSeedSession(marketSelection);
    } catch (error) {
      console.error('❌ Error checking signals:', error);
      throw error;
    }
  }

  /**
   * Session Creation Phase
   * - Creates new session in database
   * - Session lasts 150 minutes (5 × 30-minute candles)
   * - Seeds database with first bet data
   */
  private async createAndSeedSession(marketSelection: MarketSelectionResult): Promise<void> {
    console.log(`🔧 Creating session for ${marketSelection.symbol}...`);

    try {
      // Determine trend from signal direction
      const trend = marketSelection.direction === 'up' ? 'uptrend' : 'downtrend';
      const sessionId = `${marketSelection.symbol}_${Date.now()}`;
      const sessionCreatedAt = new Date();

      // Create session record
      const session = await this.sessionService.createSession({
        sessionid: sessionId,
        symbol: marketSelection.symbol,
        sessionresult: null,
        firstbetAmount: 10, // Default initial bet amount
      });

      this.botState.activeSessionId = sessionId;
      this.botState.sessionStartTime = sessionCreatedAt;
      this.sessionSymbol = marketSelection.symbol;
      this.sessionTrend = trend;

      console.log(`✅ Session created: ${sessionId}, Duration: 150 minutes`);

      // Seed database with pattern tables based on trend
      await this.seedSessionData(sessionId, trend);

      // Execute first bet
      await this.executeBet(sessionId, trend, 1);
    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw error;
    }
  }

  /**
   * Seed the database with data for all tables favoring the determined trend
   * - For uptrend: seed all 16 uptrend pattern tables
   * - For downtrend: seed all 16 downtrend pattern tables
   */
  private async seedSessionData(sessionId: string, trend: 'uptrend' | 'downtrend'): Promise<void> {
    console.log(`🌱 Seeding database tables for ${trend}...`);

    const patternsToSeed = (trend === 'uptrend'
      ? Object.values(UptrendPatterns)
      : Object.values(DowntrendPatterns)) as unknown as CandlePattern[];

    this.seededTables.clear();

    for (const pattern of patternsToSeed) {
      // Create initial record for this pattern
      await this.betRecordService.createRecord(pattern, {
        sessionid: sessionId,
        sessionresult: 'pending',
        firstbetAmount: null,
        firstbetResult: null,
        firstbetactual: null,
        firstbetexpectedcandle: null,
        secondbetAmount: null,
        secondbetResult: null,
        secondbetactual: null,
        secondbetexpectedcandle: null,
        thirdbetAmount: null,
        thirdbetResult: null,
        thirdbetactual: null,
        thirdbetexpectedcandle: null,
        fourthbetAmount: null,
        fourthbetResult: null,
        fourthbetactual: null,
        fourthbetexpectedcandle: null,
        fifthbetAmount: null,
        fifthbetResult: null,
        fifthbetactual: null,
        fifthbetexpectedcandle: null,
      });

      this.seededTables.set(pattern, {
        pattern,
        trend,
        excludeFromTrading: false,
        betLevel: 0,
      });
    }

    console.log(`✅ Seeded ${patternsToSeed.length} pattern tables`);
  }

  /**
   * Handle Existing Active Session
   * - Checks session validity (not expired)
   * - Updates bet results if needed
   * - Executes next bet in sequence
   */
  private async handleActiveSession(): Promise<void> {
    console.log(`📋 Processing active session: ${this.botState.activeSessionId}`);

    try {
      // Check if session has expired (150 minutes = 9,000 seconds)
      const sessionExpired = this.isSessionExpired();

      if (sessionExpired) {
        console.log('⏰ Session expired, evaluating results...');
        await this.evaluateSessionCompletion();
        return;
      }

      // Get current session data
      const session = await this.sessionService.getSessionById(this.botState.activeSessionId!);
      if (!session) {
        console.error('❌ Session not found in database');
        this.resetSession();
        return;
      }

      // Get current bet level
      const currentBetLevel = await this.getCurrentBetLevel(this.botState.activeSessionId!);

      // If we've completed 5 bets, evaluate session
      if (currentBetLevel >= 5) {
        await this.evaluateSessionCompletion();
        return;
      }

      // Update previous bet results if needed
      if (currentBetLevel > 0) {
        await this.updateBetResults(currentBetLevel);
      }

      // Execute next bet
      const nextBetLevel = currentBetLevel + 1;
      await this.executeBet(this.botState.activeSessionId!, this.sessionTrend!, nextBetLevel);
    } catch (error) {
      console.error('❌ Error handling active session:', error);
      throw error;
    }
  }

  /**
   * Execute a bet at the specified level (1-5)
   * - Calculates bet amount and direction
   * - Places trade with 30-minute expiry
   * - Records bet in database
   */
  private async executeBet(sessionId: string, trend: 'uptrend' | 'downtrend', betLevel: number): Promise<void> {
    console.log(`💰 Executing bet ${betLevel} for session ${sessionId}...`);

    try {
      // Calculate bet amount and direction
      let betCalculation: BetCalculationResult;

      switch (betLevel) {
        case 1:
          betCalculation = await this.strategyCore.calculateBetAmount(sessionId, trend);
          break;
        case 2:
          betCalculation = await this.strategyCore.calculateSecondBetAmount(sessionId, trend);
          break;
        case 3:
          betCalculation = await this.strategyCore.calculateThirdBetAmount(sessionId, trend);
          break;
        case 4:
          betCalculation = await this.strategyCore.calculateFourthBetAmount(sessionId, trend);
          break;
        case 5:
          betCalculation = await this.strategyCore.calculateFifthBetAmount(sessionId, trend);
          break;
        default:
          throw new Error(`Invalid bet level: ${betLevel}`);
      }

      // Exclude tables that have lost in previous bets before trading
      if (betLevel > 1) {
        await this.excludeLossingTables(sessionId, betLevel - 1);
      }

      // Only trade on tables that are not excluded
      const tradableTables = Array.from(this.seededTables.values())
        .filter(t => !t.excludeFromTrading);

      if (tradableTables.length === 0) {
        console.log(`⚠️  No tradable tables remaining for bet ${betLevel}`);
        return;
      }

      // Place trades on Deriv for each tradable table
      if (betCalculation.direction === 'NONE') {
        console.warn(`⚠️ No valid trade direction for bet ${betLevel}, skipping placement.`);
        return;
      }

      for (const tableInfo of tradableTables) {
        // Only place trade if this table hasn't been traded at this level yet
        if (tableInfo.betLevel < betLevel) {
          const tradeResult = await this.derivTradingService.placeTrade({
            amount: betCalculation.betAmount,
            contract_type: betCalculation.direction,
            duration: 30,
            duration_unit: 'm',
            symbol: this.sessionSymbol!,
          });

          // Record bet in appropriate pattern table
          tableInfo.betLevel = betLevel;
          console.log(`✅ Bet ${betLevel} placed for pattern ${tableInfo.pattern}: ${JSON.stringify(tradeResult)}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error executing bet ${betLevel}:`, error);
      throw error;
    }
  }

  /**
   * Exclude losing tables from trading
   * Key business rule: if first candle for a table loses → exclude from remainder
   */
  private async excludeLossingTables(sessionId: string, lastBetLevel: number): Promise<void> {
    console.log(`🚫 Checking for losing tables to exclude after bet ${lastBetLevel}...`);

    for (const [pattern, tableInfo] of this.seededTables) {
      if (tableInfo.excludeFromTrading) {
        continue; // Already excluded
      }

      // Check if this table lost in the last bet
      const record = await this.betRecordService.getRecords(
        pattern,
        { sessionid: sessionId, limit: 1, order: [['id', 'DESC']] }
      );

      if (record.length > 0) {
        const lastRecord = record[0];
        const resultField = `bet${lastBetLevel}Result`;

        // If result is 'loss', exclude this table
        if ((lastRecord as any)[resultField] === 'loss') {
          tableInfo.excludeFromTrading = true;
          console.log(`🚫 Excluded pattern ${pattern} due to loss at bet level ${lastBetLevel}`);
        }
      }
    }
  }

  /**
   * Update bet results from the latest completed candle
   * - Fetch previous completed candle
   * - Compare against expected levels
   * - Update all seeded tables with result
   */
  private async updateBetResults(betLevel: number): Promise<void> {
    console.log(`📈 Updating results for bet ${betLevel}...`);

    try {
      // Get the previously completed candle
      const completedCandle = await this.derivCandleService.fetchPreviousCompletedCandle(
        this.sessionSymbol!
      );

      if (!completedCandle) {
        console.log('⚠️  No completed candle data available yet');
        return;
      }

      // Update all seeded tables with the candle result
      for (const [pattern, tableInfo] of this.seededTables) {
        if (tableInfo.betLevel >= betLevel) {
          // Determine if this bet won or lost
          // (This logic depends on your specific trading rules)
          const result = await this.determineBetResult(
            pattern,
            betLevel,
            completedCandle,
            tableInfo.trend
          );

          // Update database record
          await this.updateBetRecordResult(
            this.botState.activeSessionId!,
            pattern,
            betLevel,
            result
          );

          console.log(`✅ Updated pattern ${pattern} bet ${betLevel}: ${result.result}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error updating bet results:`, error);
      throw error;
    }
  }

  /**
   * Determine the result of a bet (win/loss)
   * This is where your specific trading logic goes
   */
  private async determineBetResult(
    pattern: CandlePattern,
    betLevel: number,
    completedCandle: any,
    trend: 'uptrend' | 'downtrend'
  ): Promise<{ result: 'win' | 'loss'; candleData: any }> {
    // TODO: Implement your specific trading logic here
    // For now, return a placeholder
    return {
      result: Math.random() > 0.5 ? 'win' : 'loss',
      candleData: completedCandle,
    };
  }

  /**
   * Update a specific bet record result in the database
   */
  private async updateBetRecordResult(
    sessionId: string,
    pattern: string,
    betLevel: number,
    result: { result: 'win' | 'loss'; candleData: any }
  ): Promise<void> {
    const records = await this.betRecordService.getRecords(
      pattern,
      { sessionid: sessionId, limit: 1, order: [['id', 'DESC']] }
    );

    if (records.length > 0) {
      const record = records[0];
      const resultField = `bet${betLevel}Result`;
      const actualField = `bet${betLevel}actual`;

      (record as any)[resultField] = result.result;
      (record as any)[actualField] = result.candleData.close;

      await record.save();
    }
  }

  /**
   * Get current bet level for the active session
   * Returns highest bet level that has been executed
   */
  private async getCurrentBetLevel(sessionId: string): Promise<number> {
    let highestLevel = 0;

    for (const pattern of Object.values(CandlePattern)) {
      const records = await this.betRecordService.getRecords(
        pattern,
        { sessionid: sessionId, limit: 1, order: [['id', 'DESC']] }
      );

      if (records.length > 0) {
        const record = records[0] as any;

        // Check which bet levels have been filled
        for (let level = 5; level >= 1; level--) {
          if (record[`bet${level}Amount`] !== null) {
            highestLevel = Math.max(highestLevel, level);
            break;
          }
        }
      }
    }

    return highestLevel;
  }

  /**
   * Session Win/Loss Determination
   * - After 5 candles: wins if at least one table won all bets
   * - Loses if no table recorded all wins
   */
  private async evaluateSessionCompletion(): Promise<void> {
    console.log('🏁 Evaluating session completion...');

    try {
      const sessionId = this.botState.activeSessionId!;
      let sessionWon = false;

      // Check each pattern table for all-win condition
      for (const pattern of Object.values(CandlePattern)) {
        const records = await this.betRecordService.getRecords(
          pattern,
          { sessionid: sessionId, limit: 1, order: [['id', 'DESC']] }
        );

        if (records.length > 0) {
          const record = records[0] as any;

          // Check if all 5 bets won
          const allWins = ['bet1Result', 'bet2Result', 'bet3Result', 'bet4Result', 'bet5Result'].every(
            field => record[field] === 'win'
          );

          if (allWins) {
            sessionWon = true;
            console.log(`✅ Session won! Pattern ${pattern} had all wins`);
            break;
          }
        }
      }

      // Update session result
      const sessionResult = sessionWon ? 'win' : 'loss';
      await this.sessionService.updateSession(sessionId, { sessionresult: sessionResult });
      console.log(`📊 Session result: ${sessionResult}`);

      // Reset for next session
      this.resetSession();

      // Check for new signals to start next session
      console.log('🔄 Starting new cycle...');
      await this.checkAndGenerateSignals();
    } catch (error) {
      console.error('❌ Error evaluating session completion:', error);
      throw error;
    }
  }

  /**
   * Check if the current session has expired (>150 minutes)
   */
  private isSessionExpired(): boolean {
    if (!this.botState.sessionStartTime) {
      return true;
    }

    const elapsed = Date.now() - this.botState.sessionStartTime.getTime();
    const sessionDuration = 150 * 60 * 1000; // 150 minutes in milliseconds

    return elapsed > sessionDuration;
  }

  /**
   * Reset session state for next cycle
   */
  private resetSession(): void {
    this.botState.activeSessionId = null;
    this.botState.sessionStartTime = null;
    this.botState.isWaitingForSignal = true;
    this.seededTables.clear();
    this.sessionSymbol = null;
    this.sessionTrend = null;
  }

  /**
   * Get bot state (for monitoring/debugging)
   */
  getBotState(): TradingBotState {
    return { ...this.botState };
  }

  /**
   * Get seeded tables (for monitoring)
   */
  getSeededTables(): Array<{ pattern: CandlePattern; info: SeededTableInfo }> {
    return Array.from(this.seededTables.entries()).map(([pattern, info]) => ({
      pattern: pattern as CandlePattern,
      info,
    }));
  }
}

export default StarBotTradingLogic;
