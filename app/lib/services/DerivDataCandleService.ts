import WebSocket from 'ws';
import { Sequelize } from 'sequelize';
import { createCandleModel } from '../models/Candle';
import { ALL_VOLATILITY_SYMBOLS } from '../constants/volatilitySymbols';

export class DerivDataCandleService {
  private symbols = [...ALL_VOLATILITY_SYMBOLS];
  private ws: WebSocket | null = null;
  private sequelize: Sequelize;
  private appId: string = 'YOUR_APP_ID'; // Replace with actual app ID

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
  }

  // Create tables for each symbol if they don't exist
  async createTables(): Promise<void> {
    for (const symbol of this.symbols) {
      const tableName = `${symbol.toLowerCase().replace('_', '')}_candles`;
      const model = createCandleModel(this.sequelize, tableName);
      await model.sync();
    }
  }

  // Fetch initial 1000 candles for a symbol by subscribing with count
  async fetchInitialCandles(symbol: string): Promise<void> {
    // Since subscription with count gives historical, we'll handle in connectAndSubscribe
    // This method can be used to ensure data is fetched
  }

  // Connect to Deriv WebSocket and subscribe to candles for all symbols with historical count
  async connectAndSubscribe(): Promise<void> {
    this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

    this.ws.on('open', () => {
      console.log('Connected to Deriv WebSocket for candle data');
      for (const symbol of this.symbols) {
        this.ws!.send(JSON.stringify({
          candles: symbol,
          subscribe: 1,
          granularity: 1800, // 30 minutes in seconds
          count: 1000, // Get last 1000 candles
        }));
      }
    });

    this.ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      if (message.msg_type === 'candles') {
        const candleData = message.candles;
        if (candleData && candleData.length > 0) {
          for (const candle of candleData) {
            if (candle.is_closed) { // Store only completed candles
              this.storeCandle(message.echo_req.candles, candle);
            }
          }
        }
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  }

  // Store a completed candle in the database
  private async storeCandle(symbol: string, candle: any): Promise<void> {
    const tableName = `${symbol.toLowerCase().replace('_', '')}_candles`;
    const model = createCandleModel(this.sequelize, tableName);
    await model.create({
      timestamp: new Date(candle.epoch * 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume || 0,
    });
    console.log(`Stored candle for ${symbol} at ${new Date(candle.epoch * 1000)}`);
  }

  // Fetch the most recently completed candle for a symbol from the database
  async fetchPreviousCompletedCandle(symbol: string): Promise<any | null> {
    const normalizedIncomingSymbol = symbol.toUpperCase();
    const supportedSymbol = this.symbols.find((s) => s.toUpperCase() === normalizedIncomingSymbol);

    if (!supportedSymbol) {
      throw new Error(`Symbol ${symbol} is not supported by DerivDataCandleService`);
    }

    const tableName = `${supportedSymbol.toLowerCase().replace(/_/g, '')}_candles`;
    const model = createCandleModel(this.sequelize, tableName);

    const candle = await model.findOne({
      order: [['timestamp', 'DESC']],
    });

    return candle ? candle.get({ plain: true }) : null;
  }

  // Method to update latest candles - can be called by API endpoint every 30 minutes
  async updateLatestCandles(): Promise<void> {
    // Since we're subscribing in real-time, this method can be used to ensure connection or fetch missed data
    // For now, it can trigger a reconnection or check for latest data
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectAndSubscribe();
    }
    // Optionally, fetch latest candle manually if needed
  }

  // Initialize the service: create tables and fetch initial data
  async initialize(): Promise<void> {
    await this.createTables();
    for (const symbol of this.symbols) {
      await this.fetchInitialCandles(symbol);
    }
    await this.connectAndSubscribe();
  }

  // Close the WebSocket connection
  closeConnection(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}