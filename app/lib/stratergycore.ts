import { BetRecordService } from './services/BetRecordService';
import { DerivDataCandleService } from './services/DerivDataCandleService';
import { UptrendPatterns, DowntrendPatterns } from './strategyCombinations';

type TradeDirection = 'CALL' | 'PUT' | 'NONE';

export interface BetCalculationResult {
  betAmount: number;
  direction: TradeDirection;
}

export class StrategyCore {
  private betRecordService: BetRecordService;
  private derivDataCandleService: DerivDataCandleService;

  constructor() {
    this.betRecordService = new BetRecordService();
    this.derivDataCandleService = new DerivDataCandleService();
  }

  /**
   * Calculate the first bet amount and direction for a seeded session.
   * Uses the session ID and trend to scan all seeded pattern tables and compare
   * first-bet expected green vs red bet amounts.
   */
  async calculateBetAmount(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<BetCalculationResult> {
    return this.calculateBetForLevel(sessionid, trend, 'first');
  }

  /**
   * Calculate the second bet amount and direction for a seeded session.
   */
  async calculateSecondBetAmount(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<BetCalculationResult> {
    return this.calculateBetForLevel(sessionid, trend, 'second');
  }

  /**
   * Calculate the third bet amount and direction for a seeded session.
   */
  async calculateThirdBetAmount(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<BetCalculationResult> {
    return this.calculateBetForLevel(sessionid, trend, 'third');
  }

  /**
   * Calculate the fourth bet amount and direction for a seeded session.
   */
  async calculateFourthBetAmount(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<BetCalculationResult> {
    return this.calculateBetForLevel(sessionid, trend, 'fourth');
  }

  /**
   * Calculate the fifth bet amount and direction for a seeded session.
   */
  async calculateFifthBetAmount(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<BetCalculationResult> {
    return this.calculateBetForLevel(sessionid, trend, 'fifth');
  }

  async updateFirstBetResults(
    sessionid: string,
    trend: 'uptrend' | 'downtrend',
    symbol: string,
    lastCandle: { open: number; close: number; epoch?: number }
  ): Promise<void> {
    const actualCandleColorFromPayload = this.getCandleColor(lastCandle);
    const previousCandle = await this.derivDataCandleService.fetchPreviousCompletedCandle(symbol);
    const actualCandleColor = previousCandle
      ? this.getCandleColor({
          open: Number(previousCandle.open),
          close: Number(previousCandle.close),
        })
      : actualCandleColorFromPayload;

    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record.firstbetexpectedcandle ?? '').toLowerCase();
        const result = this.getFirstBetResult(actualCandleColor, expected);

        await this.betRecordService.updateFirstBet(pattern, Number(record.id),
          {
            firstbetactual: actualCandleColor,
            firstbetResult: result,
          }
        );
      }
    }
  }

  async updateSecondBetResults(
    sessionid: string,
    trend: 'uptrend' | 'downtrend',
    symbol: string,
    lastCandle: { open: number; close: number; epoch?: number }
  ): Promise<void> {
    const actualCandleColorFromPayload = this.getCandleColor(lastCandle);
    const previousCandle = await this.derivDataCandleService.fetchPreviousCompletedCandle(symbol);
    const actualCandleColor = previousCandle
      ? this.getCandleColor({
          open: Number(previousCandle.open),
          close: Number(previousCandle.close),
        })
      : actualCandleColorFromPayload;

    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record.secondbetexpectedcandle ?? '').toLowerCase();
        const result = this.getSecondBetResult(actualCandleColor, expected);

        await this.betRecordService.updateSecondBet(pattern, Number(record.id),
          {
            secondbetactual: actualCandleColor,
            secondbetResult: result,
          }
        );
      }
    }
  }

  async updateThirdBetResults(
    sessionid: string,
    trend: 'uptrend' | 'downtrend',
    symbol: string,
    lastCandle: { open: number; close: number; epoch?: number }
  ): Promise<void> {
    const actualCandleColorFromPayload = this.getCandleColor(lastCandle);
    const previousCandle = await this.derivDataCandleService.fetchPreviousCompletedCandle(symbol);
    const actualCandleColor = previousCandle
      ? this.getCandleColor({
          open: Number(previousCandle.open),
          close: Number(previousCandle.close),
        })
      : actualCandleColorFromPayload;

    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record.thirdbetexpectedcandle ?? '').toLowerCase();
        const result = this.getThirdBetResult(actualCandleColor, expected);

        await this.betRecordService.updateThirdBet(pattern, Number(record.id),
          {
            thirdbetactual: actualCandleColor,
            thirdbetResult: result,
          }
        );
      }
    }
  }

  async updateFourthBetResults(
    sessionid: string,
    trend: 'uptrend' | 'downtrend',
    symbol: string,
    lastCandle: { open: number; close: number; epoch?: number }
  ): Promise<void> {
    const actualCandleColorFromPayload = this.getCandleColor(lastCandle);
    const previousCandle = await this.derivDataCandleService.fetchPreviousCompletedCandle(symbol);
    const actualCandleColor = previousCandle
      ? this.getCandleColor({
          open: Number(previousCandle.open),
          close: Number(previousCandle.close),
        })
      : actualCandleColorFromPayload;

    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record.fourthbetexpectedcandle ?? '').toLowerCase();
        const result = this.getFourthBetResult(actualCandleColor, expected);

        await this.betRecordService.updateFourthBet(pattern, Number(record.id),
          {
            fourthbetactual: actualCandleColor,
            fourthbetResult: result,
          }
        );
      }
    }
  }

  async updateFifthBetResults(
    sessionid: string,
    trend: 'uptrend' | 'downtrend',
    symbol: string,
    lastCandle: { open: number; close: number; epoch?: number }
  ): Promise<void> {
    const actualCandleColorFromPayload = this.getCandleColor(lastCandle);
    const previousCandle = await this.derivDataCandleService.fetchPreviousCompletedCandle(symbol);
    const actualCandleColor = previousCandle
      ? this.getCandleColor({
          open: Number(previousCandle.open),
          close: Number(previousCandle.close),
        })
      : actualCandleColorFromPayload;

    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record.fifthbetexpectedcandle ?? '').toLowerCase();
        const result = this.getFifthBetResult(actualCandleColor, expected);

        await this.betRecordService.updateFifthBet(pattern, Number(record.id),
          {
            fifthbetactual: actualCandleColor,
            fifthbetResult: result,
          }
        );
      }
    }
  }

  /**
   * Update session result based on all bet results for a session
   */
  async updateSessionResult(
    sessionid: string,
    trend: 'uptrend' | 'downtrend'
  ): Promise<'win' | 'loss' | 'pending'> {
    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);
    
    let totalWins = 0;
    let totalLosses = 0;
    let totalPending = 0;

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        // Check each bet level
        const betLevels = ['first', 'second', 'third', 'fourth', 'fifth'] as const;
        for (const level of betLevels) {
          const result = record[`${level}betResult`];
          if (result === 'won') {
            totalWins++;
          } else if (result === 'lost') {
            totalLosses++;
          } else if (!result) {
            totalPending++;
          }
        }
      }
    }

    // Determine session result
    let sessionResult: 'win' | 'loss' | 'pending' = 'pending';
    
    if (totalPending === 0) {
      // If any bet was won, session is win (following martingale logic where one win covers all)
      if (totalWins > 0) {
        sessionResult = 'win';
      } else if (totalLosses > 0) {
        sessionResult = 'loss';
      }
    }

    // Update all records with session result
    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        await this.betRecordService.updateSessionResult(pattern, Number(record.id), sessionResult);
      }
    }

    return sessionResult;
  }

  private getCandleColor(candle: { open: number; close: number }): 'green' | 'red' | 'doji' {
    if (candle.close > candle.open) {
      return 'green';
    }
    if (candle.close < candle.open) {
      return 'red';
    }
    return 'doji';
  }

  private getFirstBetResult(actual: string, expected: string): 'won' | 'lost' {
    if ((actual === 'green' && expected === 'green') || (actual === 'red' && expected === 'red')) {
      return 'won';
    }
    return 'lost';
  }

  private getSecondBetResult(actual: string, expected: string): 'won' | 'lost' {
    if ((actual === 'green' && expected === 'green') || (actual === 'red' && expected === 'red')) {
      return 'won';
    }
    return 'lost';
  }

  private getThirdBetResult(actual: string, expected: string): 'won' | 'lost' {
    if ((actual === 'green' && expected === 'green') || (actual === 'red' && expected === 'red')) {
      return 'won';
    }
    return 'lost';
  }

  private getFourthBetResult(actual: string, expected: string): 'won' | 'lost' {
    if ((actual === 'green' && expected === 'green') || (actual === 'red' && expected === 'red')) {
      return 'won';
    }
    return 'lost';
  }

  private getFifthBetResult(actual: string, expected: string): 'won' | 'lost' {
    if ((actual === 'green' && expected === 'green') || (actual === 'red' && expected === 'red')) {
      return 'won';
    }
    return 'lost';
  }

  private async calculateBetForLevel(
    sessionid: string, 
    trend: 'uptrend' | 'downtrend', 
    level: 'first' | 'second' | 'third' | 'fourth' | 'fifth'
  ): Promise<BetCalculationResult> {
    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    let greenTotal = 0;
    let redTotal = 0;

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record[`${level}betexpectedcandle`] ?? '').toLowerCase();
        const amountValue = Number(record[`${level}betAmount`]);
        const amount = Number.isFinite(amountValue) ? amountValue : 0;

        if (!amount || amount <= 0) {
          continue;
        }

        // Handle different expected value formats (g/green or r/red)
        if (expected === 'g' || expected === 'green') {
          greenTotal += amount;
        } else if (expected === 'r' || expected === 'red') {
          redTotal += amount;
        }
      }
    }

    const betAmount = Math.abs(greenTotal - redTotal);
    let direction: TradeDirection = 'NONE';

    if (greenTotal > redTotal) {
      direction = 'CALL';
    } else if (redTotal > greenTotal) {
      direction = 'PUT';
    }

    return { betAmount, direction };
  }

  /**
   * Get detailed bet statistics for a session
   */
  async getSessionStatistics(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<{
    totalBets: number;
    wonBets: number;
    lostBets: number;
    pendingBets: number;
    winRate: number;
    totalAmount: number;
    wonAmount: number;
    lostAmount: number;
    byLevel: {
      first: { won: number; lost: number; pending: number; amount: number };
      second: { won: number; lost: number; pending: number; amount: number };
      third: { won: number; lost: number; pending: number; amount: number };
      fourth: { won: number; lost: number; pending: number; amount: number };
      fifth: { won: number; lost: number; pending: number; amount: number };
    };
  }> {
    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);
    
    const stats = {
      totalBets: 0,
      wonBets: 0,
      lostBets: 0,
      pendingBets: 0,
      winRate: 0,
      totalAmount: 0,
      wonAmount: 0,
      lostAmount: 0,
      byLevel: {
        first: { won: 0, lost: 0, pending: 0, amount: 0 },
        second: { won: 0, lost: 0, pending: 0, amount: 0 },
        third: { won: 0, lost: 0, pending: 0, amount: 0 },
        fourth: { won: 0, lost: 0, pending: 0, amount: 0 },
        fifth: { won: 0, lost: 0, pending: 0, amount: 0 }
      }
    };

    const betLevels = ['first', 'second', 'third', 'fourth', 'fifth'] as const;

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        for (const level of betLevels) {
          const result = record[`${level}betResult`];
          const amount = Number(record[`${level}betAmount`]) || 0;
          
          if (amount > 0) {
            stats.totalAmount += amount;
            stats.byLevel[level].amount += amount;
          }
          
          if (result === 'won') {
            stats.wonBets++;
            stats.wonAmount += amount;
            stats.byLevel[level].won++;
          } else if (result === 'lost') {
            stats.lostBets++;
            stats.lostAmount += amount;
            stats.byLevel[level].lost++;
          } else if (!result) {
            stats.pendingBets++;
            stats.byLevel[level].pending++;
          }
        }
      }
    }

    stats.totalBets = stats.wonBets + stats.lostBets + stats.pendingBets;
    stats.winRate = stats.totalBets > 0 ? (stats.wonBets / (stats.wonBets + stats.lostBets)) * 100 : 0;

    return stats;
  }

  /**
   * Reset all bets for a session (clear results but keep amounts)
   */
  async resetSession(sessionid: string, trend: 'uptrend' | 'downtrend'): Promise<void> {
    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);
    const betLevels = ['first', 'second', 'third', 'fourth', 'fifth'] as const;

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const updates: any = {
          sessionresult: null
        };
        
        for (const level of betLevels) {
          updates[`${level}betResult`] = null;
          updates[`${level}betactual`] = null;
        }
        
        await this.betRecordService.updateRecord(pattern, Number(record.id), updates);
      }
    }
  }

  /**
   * Get overall strategy performance across all sessions
   *//**
 * Get overall strategy performance across all sessions
 */
async getOverallPerformance(trend: 'uptrend' | 'downtrend'): Promise<{
  totalSessions: number;
  winningSessions: number;
  losingSessions: number;
  pendingSessions: number;
  winRate: number;
  totalBets: number;
  totalProfit: number;
  averageProfitPerSession: number;
}> {
  const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);
  const sessionResults = new Map<string, string>();
  
  // Collect all session results
  for (const pattern of patterns) {
    const records = await this.betRecordService.getRecords(pattern, {});
    for (const record of records) {
      if (record.sessionresult && !sessionResults.has(record.sessionid)) {
        sessionResults.set(record.sessionid, record.sessionresult);
      }
    }
  }
  
  const sessions = Array.from(sessionResults.entries());
  const totalSessions = sessions.length;
  
  if (totalSessions === 0) {
    return {
      totalSessions: 0,
      winningSessions: 0,
      losingSessions: 0,
      pendingSessions: 0,
      winRate: 0,
      totalBets: 0,
      totalProfit: 0,
      averageProfitPerSession: 0
    };
  }
  
  const winningSessions = sessions.filter(([_, result]) => result === 'win').length;
  const losingSessions = sessions.filter(([_, result]) => result === 'loss').length;
  const pendingSessions = sessions.filter(([_, result]) => result === 'pending').length;
  
  // Calculate total profit/loss and total bets
  let totalProfit = 0;
  let totalBets = 0;
  
  for (const [sessionid] of sessions) {
    try {
      const stats = await this.getSessionStatistics(sessionid, trend);
      totalProfit += stats.wonAmount - stats.lostAmount;
      totalBets += stats.totalBets;
    } catch (error) {
      console.error(`Failed to get statistics for session ${sessionid}:`, error);
    }
  }
  
  return {
    totalSessions,
    winningSessions,
    losingSessions,
    pendingSessions,
    winRate: (winningSessions / totalSessions) * 100,
    totalBets,
    totalProfit,
    averageProfitPerSession: totalProfit / totalSessions
  };
}}