/**
 * Deriv API - Volatility 100 Index (30-min candles)
 * Fetches 1000 candles history and saves to CSV
 *
 * Requirements:
 *   npm install ws
 *
 * Usage:
 *   node fetch_v100_candles.js
 */

const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// ─── Config ─────────────────────────────────────────────────────────────────
const DERIV_APP_ID = 1089; // Public demo app_id (replace with your own for production)
const SYMBOL = "R_100"; // Volatility 100 Index
const GRANULARITY = 1800; // 30 minutes in seconds
const COUNT = 1000; // Number of candles to fetch
const OUTPUT_FILE = path.join(__dirname, "v100_30min_candles.csv");
const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
// ────────────────────────────────────────────────────────────────────────────

function formatDate(epoch) {
  return new Date(epoch * 1000).toISOString().replace("T", " ").replace("Z", "");
}

function saveToCSV(candles) {
  const header = "datetime,epoch,open,high,low,close\n";
  const rows = candles
    .map(
      (c) =>
        `${formatDate(c.epoch)},${c.epoch},${c.open},${c.high},${c.low},${c.close}`
    )
    .join("\n");

  fs.writeFileSync(OUTPUT_FILE, header + rows, "utf8");
  console.log(`\n✅ Saved ${candles.length} candles to: ${OUTPUT_FILE}`);
}

function fetchCandles() {
  console.log(`🔌 Connecting to Deriv WebSocket API...`);
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log(`✅ Connected. Requesting ${COUNT} x 30-min candles for ${SYMBOL}...`);

    const request = {
      ticks_history: SYMBOL,
      style: "candles",
      granularity: GRANULARITY,
      count: COUNT,
      end: "latest",
      adjust_start_time: 1,
    };

    ws.send(JSON.stringify(request));
  });

  ws.on("message", (data) => {
    let response;
    try {
      response = JSON.parse(data);
    } catch (err) {
      console.error("❌ Failed to parse response:", err.message);
      ws.close();
      return;
    }

    // Handle API errors
    if (response.error) {
      console.error("❌ Deriv API error:", response.error.message);
      ws.close();
      process.exit(1);
    }

    // Handle candles response
    if (response.msg_type === "candles") {
      const candles = response.candles;
      console.log(`📊 Received ${candles.length} candles`);

      if (!candles || candles.length === 0) {
        console.error("❌ No candles returned.");
        ws.close();
        return;
      }

      // Preview first and last candle
      const first = candles[0];
      const last = candles[candles.length - 1];
      console.log(`📅 From : ${formatDate(first.epoch)}`);
      console.log(`📅 To   : ${formatDate(last.epoch)}`);

      saveToCSV(candles);
      ws.close();
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
    process.exit(1);
  });

  ws.on("close", () => {
    console.log("🔌 Connection closed.");
  });
}

fetchCandles();