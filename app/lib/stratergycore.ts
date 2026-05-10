import { BetRecordService } from './services/BetRecordService';
import { DerivDataCandleService } from './services/DerivDataCandleService';
import sequelize from './database';
import { UptrendPatterns, DowntrendPatterns } from './strategyCombinations';

type TradeDirection = 'CALL' | 'PUT' | 'NONE';

export interface BetCalculationResult {
  betAmount: number;
  direction: TradeDirection;
}

export class StrategyCore {
  private betRecordService = new BetRecordService();
  private derivDataCandleService = new DerivDataCandleService(sequelize);

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
        const expected = String(record.get('firstbetexpectedcandle') ?? '').toLowerCase();
        const result = this.getFirstBetResult(actualCandleColor, expected);

        await this.betRecordService.updateFirstBet(pattern, Number(record.get('id')),
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
        const expected = String(record.get('secondbetexpectedcandle') ?? '').toLowerCase();
        const result = this.getSecondBetResult(actualCandleColor, expected);

        await this.betRecordService.updateSecondBet(pattern, Number(record.get('id')),
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
        const expected = String(record.get('thirdbetexpectedcandle') ?? '').toLowerCase();
        const result = this.getThirdBetResult(actualCandleColor, expected);

        await this.betRecordService.updateThirdBet(pattern, Number(record.get('id')),
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
        const expected = String(record.get('fourthbetexpectedcandle') ?? '').toLowerCase();
        const result = this.getFourthBetResult(actualCandleColor, expected);

        await this.betRecordService.updateFourthBet(pattern, Number(record.get('id')),
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
        const expected = String(record.get('fifthbetexpectedcandle') ?? '').toLowerCase();
        const result = this.getFifthBetResult(actualCandleColor, expected);

        await this.betRecordService.updateFifthBet(pattern, Number(record.get('id')),
          {
            fifthbetactual: actualCandleColor,
            fifthbetResult: result,
          }
        );
      }
    }
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

  private async calculateBetForLevel(sessionid: string, trend: 'uptrend' | 'downtrend', level: 'first' | 'second' | 'third' | 'fourth' | 'fifth'): Promise<BetCalculationResult> {
    const patterns = trend === 'uptrend' ? Object.values(UptrendPatterns) : Object.values(DowntrendPatterns);

    let greenTotal = 0;
    let redTotal = 0;

    for (const pattern of patterns) {
      const records = await this.betRecordService.getRecords(pattern, { sessionid });
      for (const record of records) {
        const expected = String(record.get(`${level}betexpectedcandle`) ?? '').toLowerCase();
        const amountValue = Number(record.get(`${level}betAmount`));
        const amount = Number.isFinite(amountValue) ? amountValue : 0;

        if (!amount || amount <= 0) {
          continue;
        }

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
}