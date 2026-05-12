import { createClient } from "@supabase/supabase-js";
import { ALL_VOLATILITY_SYMBOLS } from '../constants/volatilitySymbols';

// ─── Config ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GRANULARITY = 1800; // 30 minutes

export interface MarketSelectionResult {
  symbol: string;
  direction: 'up' | 'down';
  strength: number;
  crossoverType: 'bullish' | 'bearish';
  latestTimestamp: Date;
  ma5Value: number;
  ma10Value: number;
  prevMa5Value: number;
  prevMa10Value: number;
  atrValue: number;
  volumeConfirmation: boolean;
}

export class MarketAnalysisIndicators {
  private symbols = [...ALL_VOLATILITY_SYMBOLS];
  private supabase;
  
  // MT5 standard buffer sizes
  private readonly MAX_CANDLES = 500;
  private readonly MIN_CANDLES = 200;  // MT5 minimum for reliable MA
  private readonly MA_PERIOD_FAST = 5;
  private readonly MA_PERIOD_SLOW = 10;
  private readonly ATR_PERIOD = 14;
  private readonly MIN_CANDLES_FOR_ATR = 20;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  async selectMarketForTrading(): Promise<MarketSelectionResult | null> {
    const candidates: MarketSelectionResult[] = [];

    // Process symbols in parallel for efficiency
    const results = await Promise.all(
      this.symbols.map(symbol => this.analyzeSymbolMT5(symbol))
    );
    
    for (const result of results) {
      if (result) candidates.push(result);
    }

    if (candidates.length === 0) return null;

    // Select best by normalized strength (ATR-adjusted)
    return candidates.reduce((best, candidate) => 
      (candidate.strength / candidate.atrValue) > (best.strength / best.atrValue) 
        ? candidate : best
    );
  }

  private async analyzeSymbolMT5(symbol: string): Promise<MarketSelectionResult | null> {
    try {
      // Fetch MT5-standard buffer size (500 candles for accuracy)
      const candles = await this.getRecentCandles(symbol, this.MAX_CANDLES);
      
      // Strict MT5 requirement: minimum candles for reliable analysis
      if (candles.length < this.MIN_CANDLES) {
        console.warn(`${symbol}: Only ${candles.length} candles, need ${this.MIN_CANDLES}`);
        return null;
      }

      // Calculate full MA arrays (like MT5 indicator buffers)
      const ma5Buffer = this.calculateSMABuffer(candles, this.MA_PERIOD_FAST);
      const ma10Buffer = this.calculateSMABuffer(candles, this.MA_PERIOD_SLOW);
      const atrBuffer = this.calculateATRBuffer(candles, this.ATR_PERIOD);
      
      if (!ma5Buffer.length || !ma10Buffer.length || !atrBuffer.length) return null;

      // Get the last 3 completed candles for crossover detection (MT5 style)
      const lastIndex = candles.length - 1;
      const prevIndex = candles.length - 2;
      const prev2Index = candles.length - 3;
      
      const currentMA5 = ma5Buffer[lastIndex];
      const currentMA10 = ma10Buffer[lastIndex];
      const prevMA5 = ma5Buffer[prevIndex];
      const prevMA10 = ma10Buffer[prevIndex];
      const prev2MA5 = ma5Buffer[prev2Index];
      const prev2MA10 = ma10Buffer[prev2Index];

      // Validate all required values exist
      if ([currentMA5, currentMA10, prevMA5, prevMA10, prev2MA5, prev2MA10].includes(null)) {
        return null;
      }

      // MT5 Crossover Detection (strict: crossover confirmed on closed candle)
      // Bullish: MA5 was below MA10 for at least 2 candles, now above
      const wasBearishPrev = prevMA5! <= prevMA10!;
      const wasBearishPrev2 = prev2MA5! <= prev2MA10!;
      const isBullishNow = currentMA5! > currentMA10!;
      const bullishCrossover = wasBearishPrev && wasBearishPrev2 && isBullishNow;
      
      // Bearish: MA5 was above MA10 for at least 2 candles, now below
      const wasBullishPrev = prevMA5! >= prevMA10!;
      const wasBullishPrev2 = prev2MA5! >= prev2MA10!;
      const isBearishNow = currentMA5! < currentMA10!;
      const bearishCrossover = wasBullishPrev && wasBullishPrev2 && isBearishNow;

      // MT5 Trend Strength using multiple confirmations
      const ma5Slope = currentMA5! - prevMA5!;
      const ma10Slope = currentMA10! - prevMA10!;
      const priceMomentum = candles[lastIndex].close - candles[prevIndex].close;
      
      // ATR for normalization
      const atrValue = atrBuffer[lastIndex] || this.calculateATR(candles, this.ATR_PERIOD);
      
      // MT5 Volume Confirmation (if volume data available)
      let volumeConfirmation = false;
      if (candles[lastIndex].volume) {
        const avgVolume = candles.slice(-20).reduce((sum, c) => sum + (c.volume || 0), 0) / 20;
        volumeConfirmation = (candles[lastIndex].volume || 0) > avgVolume * 1.2;
      }

      // MT5 Strength Calculation (weighted multi-factor)
      const trendStrength = this.calculateMT5TrendStrength({
        ma5Slope,
        ma10Slope,
        priceMomentum,
        atrValue,
        ma5Deviation: Math.abs(currentMA5! - currentMA10!) / atrValue,
        volumeConfirmation,
        isBullish: bullishCrossover,
        isBearish: bearishCrossover
      });

      // Minimum strength threshold (MT5 standard: at least 0.3 ATR separation)
      const minStrength = 0.3;
      if (trendStrength < minStrength) return null;

      if (bullishCrossover && ma5Slope > 0) {
        return {
          symbol,
          direction: 'up',
          crossoverType: 'bullish',
          strength: trendStrength,
          latestTimestamp: candles[lastIndex].timestamp,
          ma5Value: currentMA5!,
          ma10Value: currentMA10!,
          prevMa5Value: prevMA5!,
          prevMa10Value: prevMA10!,
          atrValue,
          volumeConfirmation
        };
      }

      if (bearishCrossover && ma5Slope < 0) {
        return {
          symbol,
          direction: 'down',
          crossoverType: 'bearish',
          strength: trendStrength,
          latestTimestamp: candles[lastIndex].timestamp,
          ma5Value: currentMA5!,
          ma10Value: currentMA10!,
          prevMa5Value: prevMA5!,
          prevMa10Value: prevMA10!,
          atrValue,
          volumeConfirmation
        };
      }

      return null;
    } catch (error) {
      console.error(`MT5 Analysis failed for ${symbol}:`, error);
      return null;
    }
  }

  // Calculate full SMA buffer like MT5 indicator (from oldest to newest)
  private calculateSMABuffer(candles: Array<{ close: number }>, period: number): (number | null)[] {
    const buffer: (number | null)[] = new Array(candles.length).fill(null);
    let sum = 0;
    
    for (let i = 0; i < candles.length; i++) {
      sum += candles[i].close;
      
      if (i >= period - 1) {
        if (i >= period) {
          sum -= candles[i - period].close;
        }
        buffer[i] = sum / period;
      }
    }
    
    return buffer;
  }

  // Calculate ATR buffer like MT5
  private calculateATRBuffer(candles: Array<{ high: number; low: number; close: number }>, period: number): (number | null)[] {
    const trueRanges: number[] = [];
    const atrBuffer: (number | null)[] = new Array(candles.length).fill(null);
    
    // Calculate True Range for each candle
    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        trueRanges[i] = candles[i].high - candles[i].low;
      } else {
        const hl = candles[i].high - candles[i].low;
        const hc = Math.abs(candles[i].high - candles[i-1].close);
        const lc = Math.abs(candles[i].low - candles[i-1].close);
        trueRanges[i] = Math.max(hl, hc, lc);
      }
    }
    
    // Calculate ATR using Wilder's smoothing (MT5 standard)
    let sum = 0;
    for (let i = 0; i < candles.length; i++) {
      if (i < period) {
        sum += trueRanges[i];
        if (i === period - 1) {
          atrBuffer[i] = sum / period;
        }
      } else {
        // Wilder's smoothing: ATR = (Prior ATR * (period-1) + TR) / period
        const priorATR = atrBuffer[i-1]!;
        atrBuffer[i] = ((priorATR * (period - 1)) + trueRanges[i]) / period;
      }
    }
    
    return atrBuffer;
  }

  // MT5-style multi-factor trend strength calculation
  private calculateMT5TrendStrength(params: {
    ma5Slope: number;
    ma10Slope: number;
    priceMomentum: number;
    atrValue: number;
    ma5Deviation: number;
    volumeConfirmation: boolean;
    isBullish: boolean;
    isBearish: boolean;
  }): number {
    const {
      ma5Slope,
      ma10Slope,
      priceMomentum,
      atrValue,
      ma5Deviation,
      volumeConfirmation,
      isBullish,
      isBearish
    } = params;
    
    if (atrValue === 0) return 0;
    
    // Normalize each factor to [0, 1] range
    const slopeStrength = Math.min(Math.abs(ma5Slope) / atrValue, 1);
    const momentumStrength = Math.min(Math.abs(priceMomentum) / atrValue, 1);
    const deviationStrength = Math.min(ma5Deviation, 2) / 2;
    const volumeBonus = volumeConfirmation ? 0.2 : 0;
    
    // Weighted combination (MT5 standard weights)
    const weightedStrength = (
      slopeStrength * 0.35 +
      momentumStrength * 0.25 +
      deviationStrength * 0.30 +
      volumeBonus
    );
    
    // Direction multiplier ensures strength is positive for valid moves
    const directionValid = (isBullish && ma5Slope > 0 && priceMomentum > 0) ||
                          (isBearish && ma5Slope < 0 && priceMomentum < 0);
    
    return directionValid ? weightedStrength : weightedStrength * 0.5;
  }

  // Calculate single ATR value (fallback method)
  private calculateATR(candles: Array<{ high: number; low: number; close: number }>, period: number): number {
    if (candles.length < period + 1) return 0;
    
    let sum = 0;
    for (let i = candles.length - period; i < candles.length; i++) {
      if (i === 0) {
        sum += candles[i].high - candles[i].low;
      } else {
        const hl = candles[i].high - candles[i].low;
        const hc = Math.abs(candles[i].high - candles[i-1].close);
        const lc = Math.abs(candles[i].low - candles[i-1].close);
        sum += Math.max(hl, hc, lc);
      }
    }
    return sum / period;
  }

  private async getRecentCandles(symbol: string, limit: number): Promise<Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>> {
    const tableName = symbol.toLowerCase();
    
    // Fetch candles from Supabase
    const { data: candles, error } = await this.supabase
      .from(tableName)
      .select('datetime, open, high, low, close')
      .order('epoch', { ascending: true })  // ASC for proper buffer calculation
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to fetch candles for "${tableName}": ${error.message}`);
    }
    
    if (!candles || candles.length === 0) {
      return [];
    }
    
    // Map Supabase response to expected format
    return candles.map(candle => ({
      timestamp: new Date(candle.datetime),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: undefined // Volume not stored in your candle schema
    }));
  }

  /**
   * Get all symbols with their current trend status
   */
  async getAllMarketStatus(): Promise<Map<string, {
    trend: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    ma5: number;
    ma10: number;
    atr: number;
  }>> {
    const marketStatus = new Map();
    
    const results = await Promise.all(
      this.symbols.map(async (symbol) => {
        try {
          const analysis = await this.analyzeSymbolMT5(symbol);
          if (analysis) {
            return {
              symbol,
              status: {
                trend: analysis.crossoverType,
                strength: analysis.strength,
                ma5: analysis.ma5Value,
                ma10: analysis.ma10Value,
                atr: analysis.atrValue
              }
            };
          }
          return null;
        } catch (error) {
          console.error(`Failed to get status for ${symbol}:`, error);
          return null;
        }
      })
    );
    
    for (const result of results) {
      if (result) {
        marketStatus.set(result.symbol, result.status);
      }
    }
    
    return marketStatus;
  }

  /**
   * Get detailed analysis for a specific symbol
   */
  async getSymbolAnalysis(symbol: string): Promise<{
    current: MarketSelectionResult | null;
    historical: {
      ma5: (number | null)[];
      ma10: (number | null)[];
      atr: (number | null)[];
      crossoverPoints: Array<{ index: number; type: 'bullish' | 'bearish'; timestamp: Date }>;
    };
  } | null> {
    try {
      const candles = await this.getRecentCandles(symbol, this.MAX_CANDLES);
      
      if (candles.length < this.MIN_CANDLES) {
        return null;
      }
      
      const ma5Buffer = this.calculateSMABuffer(candles, this.MA_PERIOD_FAST);
      const ma10Buffer = this.calculateSMABuffer(candles, this.MA_PERIOD_SLOW);
      const atrBuffer = this.calculateATRBuffer(candles, this.ATR_PERIOD);
      
      // Find crossover points
      const crossoverPoints: Array<{ index: number; type: 'bullish' | 'bearish'; timestamp: Date }> = [];
      
      for (let i = 2; i < candles.length; i++) {
        const prevMA5 = ma5Buffer[i-1];
        const prevMA10 = ma10Buffer[i-1];
        const prev2MA5 = ma5Buffer[i-2];
        const prev2MA10 = ma10Buffer[i-2];
        const currentMA5 = ma5Buffer[i];
        const currentMA10 = ma10Buffer[i];
        
        if (prevMA5 !== null && prevMA10 !== null && prev2MA5 !== null && prev2MA10 !== null && currentMA5 !== null && currentMA10 !== null) {
          const wasBearishPrev = prevMA5 <= prevMA10;
          const wasBearishPrev2 = prev2MA5 <= prev2MA10;
          const isBullishNow = currentMA5 > currentMA10;
          const bullishCrossover = wasBearishPrev && wasBearishPrev2 && isBullishNow;
          
          const wasBullishPrev = prevMA5 >= prevMA10;
          const wasBullishPrev2 = prev2MA5 >= prev2MA10;
          const isBearishNow = currentMA5 < currentMA10;
          const bearishCrossover = wasBullishPrev && wasBullishPrev2 && isBearishNow;
          
          if (bullishCrossover) {
            crossoverPoints.push({
              index: i,
              type: 'bullish',
              timestamp: candles[i].timestamp
            });
          } else if (bearishCrossover) {
            crossoverPoints.push({
              index: i,
              type: 'bearish',
              timestamp: candles[i].timestamp
            });
          }
        }
      }
      
      // Get current analysis
      const current = await this.analyzeSymbolMT5(symbol);
      
      return {
        current,
        historical: {
          ma5: ma5Buffer,
          ma10: ma10Buffer,
          atr: atrBuffer,
          crossoverPoints
        }
      };
    } catch (error) {
      console.error(`Failed to get detailed analysis for ${symbol}:`, error);
      return null;
    }
  }
}