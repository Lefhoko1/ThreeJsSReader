/**
 * Deriv API - Update Volatility Indices with Latest Candle Only
 * Fetches only the most recent completed 30-minute candle and appends to CSV
 * 
 * This is an incremental update - only adds new candles, never overwrites existing data
 *
 * Requirements:
 *   npm install ws
 *
 * Usage:
 *   node update_latest_candle.js
 */

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// ─── Config ─────────────────────────────────────────────────────────────────
const DERIV_APP_ID = 1089;
const GRANULARITY = 1800; // 30 minutes in seconds
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

// Get the latest epoch from existing CSV file
function getLatestEpochFromCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  
  if (lines.length <= 1) {
    return null;
  }
  
  // Last line (excluding header) contains the latest candle if sorted by epoch
  const lastLine = lines[lines.length - 1];
  const values = lastLine.split(",");
  
  if (values.length >= 2) {
    const epoch = parseInt(values[1]);
    return isNaN(epoch) ? null : epoch;
  }
  
  return null;
}

// Append new candle to CSV file
function appendToCSV(filePath, candle) {
  const fileExists = fs.existsSync(filePath);
  const row = `${formatDate(candle.epoch)},${candle.epoch},${candle.open},${candle.high},${candle.low},${candle.close}\n`;
  
  if (!fileExists) {
    // Create new file with header
    const header = "datetime,epoch,open,high,low,close\n";
    fs.writeFileSync(filePath, header + row, "utf8");
    console.log(`   📁 Created new file: ${filePath}`);
  } else {
    // Append to existing file
    fs.appendFileSync(filePath, row, "utf8");
    console.log(`   ➕ Appended candle to: ${filePath}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate the last completed candle epoch (30-minute boundary)
function getLastCompletedCandleEpoch() {
  const now = Math.floor(Date.now() / 1000);
  // Current 30-minute candle open time
  const currentCandleOpen = now - (now % GRANULARITY);
  // Last completed candle closed at currentCandleOpen
  return currentCandleOpen - GRANULARITY;
}

async function fetchLatestCandle(symbolConfig) {
  return new Promise((resolve, reject) => {
    console.log(`\n📊 Checking ${symbolConfig.display} (${symbolConfig.name})...`);
    
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout fetching ${symbolConfig.name}`));
    }, 30000);

    ws.on("open", () => {
      // Request only the last 2 candles to get the most recent completed one
      const request = {
        ticks_history: symbolConfig.name,
        style: "candles",
        granularity: GRANULARITY,
        count: 2,  // Only fetch last 2 candles
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

      if (response.error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`API error: ${response.error.message}`));
        return;
      }

      if (response.msg_type === "candles") {
        clearTimeout(timeout);
        
        const candles = response.candles;
        console.log(`   📈 Received ${candles.length} candles`);
        
        if (!candles || candles.length === 0) {
          ws.close();
          reject(new Error("No candles returned"));
          return;
        }
        
        // Determine the last completed candle
        // candles[0] is newest, candles[1] is previous (if exists)
        const now = Math.floor(Date.now() / 1000);
        const lastCompletedEpoch = getLastCompletedCandleEpoch();
        
        let latestCandle = null;
        
        // Check which candle is the last completed one
        if (candles[0].epoch <= lastCompletedEpoch) {
          latestCandle = candles[0];
        } else if (candles.length > 1 && candles[1].epoch <= lastCompletedEpoch) {
          latestCandle = candles[1];
        }
        
        if (!latestCandle) {
          console.log(`   ⚠️ No completed candle found yet (waiting for current candle to close)`);
          ws.close();
          resolve(null);
          return;
        }
        
        const candleDate = new Date(latestCandle.epoch * 1000);
        const hoursAgo = (now - latestCandle.epoch) / 3600;
        
        console.log(`   🕯️ Latest completed candle: ${formatDate(latestCandle.epoch)}`);
        console.log(`   ⏰ Age: ${hoursAgo.toFixed(1)} hours old`);
        console.log(`   📊 OHLC: O=${latestCandle.open} H=${latestCandle.high} L=${latestCandle.low} C=${latestCandle.close}`);
        
        ws.close();
        resolve(latestCandle);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${err.message}`));
    });
  });
}

async function updateAllSymbols() {
  console.log(`🚀 Starting incremental update - fetching latest completed candles only...`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  
  const lastCompletedEpoch = getLastCompletedCandleEpoch();
  const lastCompletedTime = new Date(lastCompletedEpoch * 1000).toISOString();
  console.log(`\n🎯 Target: Last completed candle at ${lastCompletedTime}`);
  console.log(`\n${"=".repeat(60)}`);
  
  const results = [];
  let totalAdded = 0;
  
  for (const symbol of SYMBOLS) {
    const filePath = path.join(DATA_DIR, symbol.file);
    
    try {
      // Get the latest epoch already in CSV
      const latestEpochInFile = getLatestEpochFromCSV(filePath);
      
      // Fetch the latest completed candle from Deriv
      const latestCandle = await fetchLatestCandle(symbol);
      
      if (!latestCandle) {
        console.log(`   ⏳ No new candle available yet`);
        results.push({ 
          symbol: symbol.name, 
          success: true, 
          added: false, 
          reason: "No new candle available" 
        });
        continue;
      }
      
      // Check if we already have this candle
      if (latestEpochInFile && latestCandle.epoch <= latestEpochInFile) {
        console.log(`   ✅ Already have latest candle (epoch: ${latestCandle.epoch})`);
        results.push({ 
          symbol: symbol.name, 
          success: true, 
          added: false, 
          reason: "Already exists",
          epoch: latestCandle.epoch
        });
      } else {
        // New candle - append to CSV
        appendToCSV(filePath, latestCandle);
        totalAdded++;
        results.push({ 
          symbol: symbol.name, 
          success: true, 
          added: true, 
          epoch: latestCandle.epoch,
          date: formatDate(latestCandle.epoch)
        });
        console.log(`   ✅ Added new candle!`);
      }
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.push({ symbol: symbol.name, success: false, error: error.message });
    }
    
    // Wait 1 second between requests
    if (SYMBOLS.indexOf(symbol) < SYMBOLS.length - 1) {
      console.log(`   ⏳ Waiting 1 second before next request...`);
      await sleep(1000);
    }
  }
  
  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 UPDATE SUMMARY:`);
  console.log(`   ✅ Successful: ${results.filter(r => r.success).length}/${SYMBOLS.length}`);
  console.log(`   ➕ New candles added: ${totalAdded}`);
  
  if (totalAdded > 0) {
    console.log(`\n   New candles added for:`);
    results.filter(r => r.added).forEach(r => {
      console.log(`      - ${r.symbol}: ${r.date} (epoch: ${r.epoch})`);
    });
  }
  
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n   ❌ Failed: ${failed.map(f => f.symbol).join(", ")}`);
  }
  
  console.log(`⏰ Finished at: ${new Date().toISOString()}`);
  
  // Return stats for potential scheduling
  return { totalAdded, results };
}

// Run the update
updateAllSymbols().catch(console.error);