const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYMBOLS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'];

async function fetchCandlesFromDeriv(symbol, count = 1) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout fetching ${symbol}`));
    }, 30000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: count,
        end: 'latest',
        granularity: 1800,
        style: 'candles'
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data);
      
      if (message.msg_type === 'history') {
        clearTimeout(timeout);
        ws.close();
        resolve(message.candles || []);
      }
      
      if (message.error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(message.error.message));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function storeCandles(symbol, candles) {
  if (!candles || candles.length === 0) return 0;
  
  let stored = 0;
  
  for (const candle of candles) {
    const timestamp = new Date(candle.epoch * 1000).toISOString();
    
    const { data: existing } = await supabase
      .from(symbol)
      .select('id')
      .eq('timestamp', timestamp)
      .single();
    
    if (!existing) {
      const { error } = await supabase
        .from(symbol)
        .insert({
          timestamp: timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0
        });
      
      if (!error) stored++;
    }
  }
  
  return stored;
}

async function main() {
  const mode = process.env.MODE || 'update';
  const count = mode === 'initial' ? 1000 : 1;
  
  console.log(`🚀 Starting: ${mode} mode, ${count} candle(s) per symbol`);
  
  for (const symbol of SYMBOLS) {
    try {
      console.log(`📡 Fetching ${count} candle(s) for ${symbol}...`);
      const candles = await fetchCandlesFromDeriv(symbol, count);
      const stored = await storeCandles(symbol, candles);
      console.log(`✅ ${symbol}: fetched ${candles.length}, stored ${stored} new`);
    } catch (error) {
      console.error(`❌ ${symbol}: ${error.message}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('🎉 Complete!');
}

main().catch(console.error);
