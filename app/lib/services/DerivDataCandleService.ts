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

  // Create tables for each symbol using the symbol name as table name
  async createTables(): Promise<void> {
    console.log('📊 Creating tables for symbols:', this.symbols);
    for (const symbol of this.symbols) {
      // Use symbol directly as table name (e.g., "R_10", "R_25", "BOOM1000")
      const tableName = symbol;
      const model = createCandleModel(this.sequelize, tableName);
      await model.sync();
      console.log(`✅ Table ${tableName} created/verified`);
    }
  }

  // Connect to Deriv WebSocket and subscribe to candles for all symbols
  async connectAndSubscribe(): Promise<void> {
    console.log(`🔌 Connecting to Deriv WebSocket with appId: ${this.appId}`);
    this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

    this.ws.on('open', () => {
      console.log('✅ Connected to Deriv WebSocket for candle data');
      for (const symbol of this.symbols) {
        const request = {
          candles: symbol,
          subscribe: 1,
          granularity: 1800, // 30 minutes in seconds
          count: 1000,
        };
        this.ws!.send(JSON.stringify(request));
        console.log(`📡 Subscribed to ${symbol} candles`);
      }
    });

    this.ws.on('message', async (data: Buffer) => {
      const message = JSON.parse(data.toString());
      if (message.msg_type === 'candles') {
        const candleData = message.candles;
        if (candleData && candleData.length > 0) {
          const symbol = message.echo_req.candles;
          console.log(`📊 Received ${candleData.length} candles for ${symbol}`);
          for (const candle of candleData) {
            if (candle.is_closed) {
              await this.storeCandle(symbol, candle);
            }
          }
        }
      }
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });
  }

  // Store a completed candle in the database using symbol as table name
  private async storeCandle(symbol: string, candle: any): Promise<void> {
    try {
      // Use symbol directly as table name
      const tableName = symbol;
      const model = createCandleModel(this.sequelize, tableName);
      await model.create({
        timestamp: new Date(candle.epoch * 1000),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      });
      console.log(`💾 Stored candle for ${symbol} at ${new Date(candle.epoch * 1000)}`);
    } catch (error) {
      console.error(`❌ Error storing candle for ${symbol}:`, error);
    }
  }

  // Fetch the most recently completed candle for a symbol
  async fetchPreviousCompletedCandle(symbol: string): Promise<any | null> {
    const normalizedIncomingSymbol = symbol.toUpperCase();
    const supportedSymbol = this.symbols.find((s) => s.toUpperCase() === normalizedIncomingSymbol);

    if (!supportedSymbol) {
      throw new Error(`Symbol ${symbol} is not supported by DerivDataCandleService`);
    }

    // Use symbol directly as table name
    const tableName = supportedSymbol;
    const model = createCandleModel(this.sequelize, tableName);

    const candle = await model.findOne({
      order: [['timestamp', 'DESC']],
    });

    return candle ? candle.get({ plain: true }) : null;
  }

  // Method to update latest candles
  async updateLatestCandles(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectAndSubscribe();
    }
  }

  // Initialize the service: create tables and connect
  async initialize(): Promise<void> {
    console.log('🚀 Initializing DerivDataCandleService...');
    await this.createTables();
    await this.connectAndSubscribe();
  }

  // Close the WebSocket connection
  closeConnection(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}