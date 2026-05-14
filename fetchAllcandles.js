/**
 * Deriv API - All Volatility Indices (30-min candles)
 * Fetches 1000 candles for each symbol and saves to separate CSV files
 *
 * Requirements:
 *   npm install ws
 *
 * Usage:
 *   node fetch_all_volatility_candles.js
 */

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// ─── Config ─────────────────────────────────────────────────────────────────
const DERIV_APP_ID = 1089;
const GRANULARITY = 1800; // 30 minutes in seconds
const COUNT = 1000; // Number of candles to fetch per symbol
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

// All Volatility Indices
const SYMBOLS = [
  { name: "R_10", file: "v10_30min_candles.csv", display: "Volatility 10 Index" },
  { name: "R_25", file: "v25_30min_candles.csv", display: "Volatility 25 Index" },
  { name: "R_50", file: "v50_30min_candles.csv", display: "Volatility 50 Index" },
  { name: "R_75", file: "v75_30min_candles.csv", display: "Volatility 75 Index" },
  { name: "R_100", file: "v100_30min_candles.csv", display: "Volatility 100 Index" },
  { name: "1HZ10V", file: "v10_1hz_30min_candles.csv", display: "Volatility 10 Index (1s)" },
  { name: "1HZ25V", file: "v25_1hz_30min_candles.csv", display: "Volatility 25 Index (1s)" },
  { name: "1HZ50V", file: "v50_1hz_30min_candles.csv", display: "Volatility 50 Index (1s)" },
  { name: "1HZ75V", file: "v75_1hz_30min_candles.csv", display: "Volatility 75 Index (1s)" },
  { name: "1HZ100V", file: "v100_1hz_30min_candles.csv", display: "Volatility 100 Index (1s)" }
];

// Create data directory if it doesn't exist
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

function formatDate(epoch) {
  return new Date(epoch * 1000).toISOString().replace("T", " ").replace("Z", "");
}

function saveToCSV(symbol, candles, filename) {
  const filePath = path.join(DATA_DIR, filename);
  const header = "datetime,epoch,open,high,low,close\n";
  
  // Sort candles by epoch (oldest first)
  const sorted = [...candles].sort((a, b) => a.epoch - b.epoch);
  
  const rows = sorted.map((c) =>
    `${formatDate(c.epoch)},${c.epoch},${c.open},${c.high},${c.low},${c.close}`
  ).join("\n");

  fs.writeFileSync(filePath, header + rows, "utf8");
  console.log(`   💾 Saved to: ${filePath}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCandles(symbolConfig) {
  return new Promise((resolve, reject) => {
    console.log(`\n📊 Fetching ${symbolConfig.display} (${symbolConfig.name})...`);
    
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout fetching ${symbolConfig.name}`));
    }, 30000);

    ws.on("open", () => {
      console.log(`   🔌 Connected, requesting ${COUNT} candles...`);
      
      const request = {
        ticks_history: symbolConfig.name,
        style: "candles",
        granularity: GRANULARITY,
        count: COUNT,
        end: "latest"
      };
      
      ws.send(JSON.stringify(request));
    });

    ws.on("message", (data) => {
      let response;
      try {
        response = JSON.parse(data);
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`Failed to parse response: ${err.message}`));
        return;
      }

      // Handle API errors
      if (response.error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`API error: ${response.error.message}`));
        return;
      }

      // Handle candles response
      if (response.msg_type === "candles") {
        clearTimeout(timeout);
        
        const candles = response.candles;
        console.log(`   📈 Received ${candles.length} candles`);
        
        if (!candles || candles.length === 0) {
          ws.close();
          reject(new Error("No candles returned"));
          return;
        }

        // Preview first and last candle
        const first = candles[candles.length - 1]; // Oldest
        const last = candles[0]; // Newest
        console.log(`   📅 From : ${formatDate(first.epoch)}`);
        console.log(`   📅 To   : ${formatDate(last.epoch)}`);
        
        // Calculate age of latest candle
        const now = Math.floor(Date.now() / 1000);
        const hoursAgo = (now - last.epoch) / 3600;
        console.log(`   ⏰ Latest candle is ${hoursAgo.toFixed(1)} hours old`);
        
        saveToCSV(symbolConfig.name, candles, symbolConfig.file);
        ws.close();
        resolve(candles);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${err.message}`));
    });

    ws.on("close", () => {
      console.log(`   🔌 Connection closed for ${symbolConfig.name}`);
    });
  });
}

async function fetchAllCandles() {
  console.log(`🚀 Starting to fetch all Volatility Indices...`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`\n${"=".repeat(60)}`);
  
  const results = [];
  
  for (const symbol of SYMBOLS) {
    try {
      await fetchCandles(symbol);
      results.push({ symbol: symbol.name, success: true });
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.push({ symbol: symbol.name, success: false, error: error.message });
    }
    
    // Wait 1 second between requests to be polite to the API
    if (SYMBOLS.indexOf(symbol) < SYMBOLS.length - 1) {
      console.log(`   ⏳ Waiting 1 second before next request...`);
      await sleep(1000);
    }
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 SUMMARY:`);
  const successCount = results.filter(r => r.success).length;
  console.log(`   ✅ Successful: ${successCount}/${SYMBOLS.length}`);
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`   ❌ Failed: ${failed.map(f => f.symbol).join(", ")}`);
  }
  console.log(`⏰ Finished at: ${new Date().toISOString()}`);
}

// Run the script
fetchAllCandles().catch(console.error);