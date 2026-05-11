import WebSocket from 'ws';
import { Sequelize } from 'sequelize';
import { createCandleModel } from '../models/Candle';
import { ALL_VOLATILITY_SYMBOLS } from '../constants/volatilitySymbols';

export class DerivDataCandleService {
  private symbols = [...ALL_VOLATILITY_SYMBOLS];
  private ws: WebSocket | null = null;
  private sequelize: Sequelize;
  private appId: string;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.appId = process.env.DERIV_APP_ID || '1089';
  }

  async createTables(): Promise<void> {
    console.log('📊 Creating tables for symbols:', this.symbols);
    for (const symbol of this.symbols) {
      const tableName = symbol;
      const model = createCandleModel(this.sequelize, tableName);
      await model.sync();
      console.log(`✅ Table ${tableName} created/verified`);
    }
  }

  async hasData(symbol: string): Promise<boolean> {
    const tableName = symbol;
    const model = createCandleModel(this.sequelize, tableName);
    const count = await model.count();
    return count > 0;
  }

  async fetchInitialCandles(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔄 Fetching initial 1000 candles for all symbols...');
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);
      
      let symbolsProcessed = 0;
      const totalSymbols = this.symbols.length;

      ws.on('open', () => {
        console.log('✅ Connected to Deriv');
        for (const symbol of this.symbols) {
          const request = {
            ticks_history: symbol,
            adjust_start_time: 1,
            count: 1000,
            end: 'latest',
            granularity: 1800,
            style: 'candles'
          };
          ws.send(JSON.stringify(request));
          console.log(`📡 Requested 1000 candles for ${symbol}`);
        }
      });

      ws.on('message', async (data: Buffer) => {
        const message = JSON.parse(data.toString());
        
        if (message.msg_type === 'history') {
          const symbol = message.echo_req.ticks_history;
          const candles = message.candles || [];
          
          console.log(`📊 Received ${candles.length} candles for ${symbol}`);
          
          for (const candle of candles) {
            await this.storeCandle(symbol, candle);
          }
          
          symbolsProcessed++;
          console.log(`✅ Processed ${symbolsProcessed}/${totalSymbols} symbols`);
          
          if (symbolsProcessed === totalSymbols) {
            ws.close();
            resolve();
          }
        }
        
        if (message.error) {
          console.error('❌ Deriv error:', message.error);
          reject(new Error(message.error.message));
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });

      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout fetching initial candles'));
      }, 30000);
    });
  }

  async fetchLatestCandle(symbol: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);
      
      ws.on('open', () => {
        const request = {
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 1,
          end: 'latest',
          granularity: 1800,
          style: 'candles'
        };
        ws.send(JSON.stringify(request));
        console.log(`📡 Requesting latest candle for ${symbol}`);
      });

      ws.on('message', async (data: Buffer) => {
        const message = JSON.parse(data.toString());
        
        if (message.msg_type === 'history') {
          const candles = message.candles || [];
          
          if (candles.length > 0) {
            const latestCandle = candles[candles.length - 1];
            await this.storeCandle(symbol, latestCandle);
            console.log(`✅ Stored latest candle for ${symbol}`);
          }
          
          ws.close();
          resolve();
        }
        
        if (message.error) {
          console.error('❌ Deriv error:', message.error);
          reject(new Error(message.error.message));
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${symbol}:`, error);
        reject(error);
      });

      setTimeout(() => {
        ws.close();
        reject(new Error(`Timeout fetching latest candle for ${symbol}`));
      }, 10000);
    });
  }

  async updateLatestCandles(): Promise<void> {
    console.log('🔄 Updating latest candles for all symbols...');
    
    for (const symbol of this.symbols) {
      try {
        await this.fetchLatestCandle(symbol);
      } catch (error) {
        console.error(`❌ Failed to update ${symbol}:`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('✅ All symbols updated with latest candles');
  }

  async fetchPreviousCompletedCandle(symbol: string): Promise<any | null> {
    try {
      const tableName = symbol;
      const model = createCandleModel(this.sequelize, tableName);
      
      const candle = await model.findOne({
        order: [['timestamp', 'DESC']],
      });
      
      return candle ? candle.get({ plain: true }) : null;
    } catch (error) {
      console.error(`❌ Error fetching previous candle for ${symbol}:`, error);
      return null;
    }
  }

  private async storeCandle(symbol: string, candle: any): Promise<void> {
    try {
      const tableName = symbol;
      const model = createCandleModel(this.sequelize, tableName);
      
      const existing = await model.findOne({
        where: { timestamp: new Date(candle.epoch * 1000) }
      });
      
      if (!existing) {
        await model.create({
          timestamp: new Date(candle.epoch * 1000),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
        });
        console.log(`💾 Stored new candle for ${symbol} at ${new Date(candle.epoch * 1000)}`);
      } else {
        console.log(`⚠️ Candle for ${symbol} at ${new Date(candle.epoch * 1000)} already exists, skipping`);
      }
    } catch (error) {
      console.error(`❌ Error storing candle for ${symbol}:`, error);
    }
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing DerivDataCandleService...');
    await this.createTables();
    
    const firstSymbol = this.symbols[0];
    const hasExistingData = await this.hasData(firstSymbol);
    
    if (!hasExistingData) {
      console.log('📊 No existing data found, fetching initial 1000 candles...');
      await this.fetchInitialCandles();
    } else {
      console.log('🔄 Existing data found, updating only latest candles...');
      await this.updateLatestCandles();
    }
    
    console.log('✅ Candle service completed successfully!');
  }

  closeConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('Connection closed');
  }
}