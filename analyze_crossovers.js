/**
 * Volatility Indices Analysis - MA Crossover & Trend Detection
 * 
 * Analyzes all volatility index CSV files to find:
 * - MA5/MA20 crossovers (Golden Cross = bullish, Death Cross = bearish)
 * - Ranks symbols by trend strength
 * - Identifies best trending market with crossover confirmation
 *
 * Usage:
 *   node analyze_crossovers.js
 */

const fs = require("fs");
const path = require("path");

// Configuration
const DATA_DIR = path.join(__dirname, "data");
const MA_SHORT = 5;  // Fast moving average period
const MA_LONG = 20;   // Slow moving average period
const MIN_CANDLES = 50; // Minimum candles needed for analysis

// Symbol configuration with display names
const SYMBOLS = [
  { file: "v10_30min_candles.csv", name: "R_10", display: "Volatility 10 Index" },
  { file: "v25_30min_candles.csv", name: "R_25", display: "Volatility 25 Index" },
  { file: "v50_30min_candles.csv", name: "R_50", display: "Volatility 50 Index" },
  { file: "v75_30min_candles.csv", name: "R_75", display: "Volatility 75 Index" },
  { file: "v100_30min_candles.csv", name: "R_100", display: "Volatility 100 Index" },
  { file: "v10_1hz_30min_candles.csv", name: "1HZ10V", display: "Volatility 10 Index (1s)" },
  { file: "v25_1hz_30min_candles.csv", name: "1HZ25V", display: "Volatility 25 Index (1s)" },
  { file: "v50_1hz_30min_candles.csv", name: "1HZ50V", display: "Volatility 50 Index (1s)" },
  { file: "v75_1hz_30min_candles.csv", name: "1HZ75V", display: "Volatility 75 Index (1s)" },
  { file: "v100_1hz_30min_candles.csv", name: "1HZ100V", display: "Volatility 100 Index (1s)" }
];

// Helper: Parse CSV to array of objects
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",");
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length >= headers.length && values[0]) {
      const row = {};
      headers.forEach((header, idx) => {
        let value = values[idx];
        if (header === "epoch" || header === "open" || header === "high" || 
            header === "low" || header === "close") {
          value = parseFloat(value);
        }
        row[header] = value;
      });
      if (!isNaN(row.epoch) && !isNaN(row.close)) {
        data.push(row);
      }
    }
  }
  
  // Sort by epoch (oldest first for calculations)
  return data.sort((a, b) => a.epoch - b.epoch);
}

// Calculate Simple Moving Average (returns array aligned with original data)
function calculateSMA(prices, period) {
  const sma = new Array(prices.length).fill(null);
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma[i] = sum / period;
  }
  return sma;
}

// Detect crossovers between two MAs
function detectCrossovers(ma5, ma20, prices, dates) {
  const crossovers = [];
  
  // Start from where both MAs have valid values
  for (let i = MA_LONG; i < ma5.length; i++) {
    // Skip if either MA value is null
    if (ma5[i] === null || ma5[i-1] === null || ma20[i] === null || ma20[i-1] === null) {
      continue;
    }
    
    const prevMA5 = ma5[i-1];
    const currMA5 = ma5[i];
    const prevMA20 = ma20[i-1];
    const currMA20 = ma20[i];
    
    // Golden Cross: MA5 crosses ABOVE MA20
    if (prevMA5 <= prevMA20 && currMA5 > currMA20) {
      crossovers.push({
        type: "GOLDEN_CROSS",
        direction: "BULLISH",
        index: i,
        date: dates[i],
        price: prices[i],
        ma5: currMA5,
        ma20: currMA20,
        signal: "BUY"
      });
    }
    // Death Cross: MA5 crosses BELOW MA20
    else if (prevMA5 >= prevMA20 && currMA5 < currMA20) {
      crossovers.push({
        type: "DEATH_CROSS",
        direction: "BEARISH",
        index: i,
        date: dates[i],
        price: prices[i],
        ma5: currMA5,
        ma20: currMA20,
        signal: "SELL"
      });
    }
  }
  
  return crossovers;
}

// Calculate trend strength metrics
function calculateTrendStrength(prices, ma5, ma20, dates) {
  if (prices.length < 10) {
    return { strength: 0, direction: "NEUTRAL", score: 0 };
  }
  
  const lastIndex = prices.length - 1;
  const currentPrice = prices[lastIndex];
  const currentMA5 = ma5[lastIndex] !== null ? ma5[lastIndex] : prices[lastIndex];
  const currentMA20 = ma20[lastIndex] !== null ? ma20[lastIndex] : prices[lastIndex];
  
  // Price vs MAs
  const priceVsMA5 = ((currentPrice - currentMA5) / currentMA5) * 100;
  const priceVsMA20 = ((currentPrice - currentMA20) / currentMA20) * 100;
  
  // MA slope (momentum) - use last 5 valid values
  let ma5Slope = 0;
  let ma20Slope = 0;
  
  // Find last 5 valid MA5 values
  const validMA5 = [];
  for (let i = lastIndex; i >= 0 && validMA5.length < 6; i--) {
    if (ma5[i] !== null) validMA5.unshift(ma5[i]);
  }
  if (validMA5.length >= 5) {
    ma5Slope = ((validMA5[validMA5.length - 1] - validMA5[0]) / validMA5[0]) * 100;
  }
  
  // Find last 5 valid MA20 values
  const validMA20 = [];
  for (let i = lastIndex; i >= 0 && validMA20.length < 6; i--) {
    if (ma20[i] !== null) validMA20.unshift(ma20[i]);
  }
  if (validMA20.length >= 5) {
    ma20Slope = ((validMA20[validMA20.length - 1] - validMA20[0]) / validMA20[0]) * 100;
  }
  
  // Recent price momentum (last 10 candles)
  let recentMomentum = 0;
  if (prices.length > 10) {
    recentMomentum = ((prices[lastIndex] - prices[lastIndex - 10]) / prices[lastIndex - 10]) * 100;
  }
  
  // Trend direction
  let direction = "NEUTRAL";
  if (currentMA5 > currentMA20 && ma5Slope > 0 && recentMomentum > 0) {
    direction = "BULLISH";
  } else if (currentMA5 < currentMA20 && ma5Slope < 0 && recentMomentum < 0) {
    direction = "BEARISH";
  } else if (currentMA5 > currentMA20) {
    direction = "WEAK_BULLISH";
  } else if (currentMA5 < currentMA20) {
    direction = "WEAK_BEARISH";
  }
  
  // Calculate overall trend strength score (0-100)
  let strengthScore = 0;
  const absPriceVsMA20 = Math.abs(priceVsMA20);
  const absMa5Slope = Math.abs(ma5Slope);
  const absMomentum = Math.abs(recentMomentum);
  
  if (direction === "BULLISH") {
    strengthScore = Math.min(100, absPriceVsMA20 * 2 + absMa5Slope * 3 + absMomentum * 5);
  } else if (direction === "BEARISH") {
    strengthScore = Math.min(100, absPriceVsMA20 * 2 + absMa5Slope * 3 + absMomentum * 5);
  } else if (direction === "WEAK_BULLISH") {
    strengthScore = Math.min(70, absPriceVsMA20 * 1.5 + absMa5Slope * 2);
  } else if (direction === "WEAK_BEARISH") {
    strengthScore = Math.min(70, absPriceVsMA20 * 1.5 + absMa5Slope * 2);
  }
  
  return {
    strength: strengthScore,
    direction: direction,
    priceVsMA5: priceVsMA5.toFixed(2),
    priceVsMA20: priceVsMA20.toFixed(2),
    ma5Slope: ma5Slope.toFixed(2),
    ma20Slope: ma20Slope.toFixed(2),
    recentMomentum: recentMomentum.toFixed(2),
    currentPrice: currentPrice,
    currentMA5: currentMA5,
    currentMA20: currentMA20
  };
}

// Main analysis function
function analyzeSymbol(symbolConfig) {
  const filePath = path.join(DATA_DIR, symbolConfig.file);
  
  if (!fs.existsSync(filePath)) {
    return { ...symbolConfig, error: "File not found", hasCrossover: false };
  }
  
  const data = parseCSV(filePath);
  
  if (data.length < MIN_CANDLES) {
    return { 
      ...symbolConfig, 
      error: `Insufficient data: ${data.length} candles (need ${MIN_CANDLES})`,
      hasCrossover: false 
    };
  }
  
  // Extract prices and dates
  const prices = data.map(d => d.close);
  const dates = data.map(d => d.datetime);
  
  // Calculate MAs (aligned arrays with nulls for early indices)
  const ma5 = calculateSMA(prices, MA_SHORT);
  const ma20 = calculateSMA(prices, MA_LONG);
  
  // Detect crossovers
  const crossovers = detectCrossovers(ma5, ma20, prices, dates);
  
  // Get trend strength
  const trend = calculateTrendStrength(prices, ma5, ma20, dates);
  
  // Get latest crossover (if any)
  const latestCrossover = crossovers.length > 0 ? crossovers[crossovers.length - 1] : null;
  
  // Determine if crossover aligns with trend
  let crossoverValid = false;
  if (latestCrossover) {
    if (latestCrossover.direction === "BULLISH" && trend.direction === "BULLISH") {
      crossoverValid = true;
    } else if (latestCrossover.direction === "BEARISH" && trend.direction === "BEARISH") {
      crossoverValid = true;
    }
  }
  
  return {
    symbol: symbolConfig.name,
    display: symbolConfig.display,
    file: symbolConfig.file,
    error: null,
    hasCrossover: crossovers.length > 0,
    crossoverValid: crossoverValid,
    latestCrossover: latestCrossover,
    allCrossovers: crossovers,
    trend: trend,
    dataPoints: data.length,
    latestPrice: prices[prices.length - 1],
    latestDate: dates[dates.length - 1]
  };
}

// Print separator line
function printLine(char = "=", len = 80) {
  console.log(char.repeat(len));
}

// Main execution
function main() {
  printLine("=");
  console.log("📊 VOLATILITY INDICES ANALYSIS - MA CROSSOVER & TREND DETECTION");
  printLine("=");
  console.log(`⏰ Analysis Time: ${new Date().toISOString()}`);
  console.log(`📈 Settings: MA${MA_SHORT} / MA${MA_LONG} | Min Candles: ${MIN_CANDLES}`);
  printLine("=");
  
  // Analyze all symbols
  const results = [];
  for (const symbol of SYMBOLS) {
    const result = analyzeSymbol(symbol);
    results.push(result);
    
    // Print individual result
    if (result.error) {
      console.log(`\n❌ ${result.display}: ${result.error}`);
    } else {
      const crossoverIcon = result.hasCrossover ? "🟢" : "⚪";
      const validIcon = result.crossoverValid ? "✅" : "❌";
      console.log(`\n${crossoverIcon} ${result.display} (${result.symbol})`);
      console.log(`   📅 Latest Data: ${result.latestDate}`);
      console.log(`   💰 Price: ${result.latestPrice.toFixed(2)}`);
      console.log(`   📊 Trend: ${result.trend.direction} (Strength: ${result.trend.strength.toFixed(1)}%)`);
      console.log(`   📈 MA5: ${result.trend.currentMA5.toFixed(2)} | MA20: ${result.trend.currentMA20.toFixed(2)}`);
      console.log(`   📉 Momentum: ${result.trend.recentMomentum}% | MA5 Slope: ${result.trend.ma5Slope}%`);
      
      if (result.hasCrossover) {
        const cross = result.latestCrossover;
        console.log(`   🔄 LAST CROSSOVER: ${cross.type} at ${cross.date} (${cross.direction})`);
        console.log(`   🎯 Crossover-Trend Alignment: ${validIcon}`);
      }
    }
  }
  
  // FILTER: Symbols with crossover aligned to trend
  printLine("=");
  console.log("🎯 SYMBOLS WITH VALID CROSSOVER (Trend-Aligned)");
  printLine("=");
  
  const validSymbols = results.filter(r => !r.error && r.crossoverValid);
  
  if (validSymbols.length === 0) {
    console.log("\n❌ No symbols with valid trend-aligned crossover found.");
    console.log("\n💡 Tip: Check symbols that recently had a crossover but trend hasn't confirmed yet.");
    
    // Show symbols with crossover but not aligned
    const crossoverOnly = results.filter(r => !r.error && r.hasCrossover && !r.crossoverValid);
    if (crossoverOnly.length > 0) {
      console.log("\n📌 Symbols with crossover but trend not yet confirmed:");
      crossoverOnly.forEach(s => {
        console.log(`   - ${s.display}: ${s.latestCrossover.type} at ${s.latestCrossover.date} (Wait for trend confirmation)`);
      });
    }
    return;
  }
  
  // RANK by trend strength (highest first)
  const ranked = [...validSymbols].sort((a, b) => b.trend.strength - a.trend.strength);
  
  console.log("\n🏆 RANKED BY TREND STRENGTH (Best First):");
  printLine("-");
  
  ranked.forEach((symbol, idx) => {
    const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "  ";
    console.log(`\n${rankIcon} #${idx + 1}: ${symbol.display}`);
    console.log(`   ├─ Trend Direction: ${symbol.trend.direction}`);
    console.log(`   ├─ Trend Strength: ${symbol.trend.strength.toFixed(1)}%`);
    console.log(`   ├─ Current Price: ${symbol.latestPrice.toFixed(2)}`);
    console.log(`   ├─ MA5: ${symbol.trend.currentMA5.toFixed(2)} | MA20: ${symbol.trend.currentMA20.toFixed(2)}`);
    console.log(`   ├─ Price vs MA20: ${symbol.trend.priceVsMA20}%`);
    console.log(`   ├─ Momentum (10-bar): ${symbol.trend.recentMomentum}%`);
    console.log(`   ├─ Last Crossover: ${symbol.latestCrossover.type} at ${symbol.latestCrossover.date}`);
    console.log(`   └─ Signal: ${symbol.latestCrossover.signal}`);
  });
  
  // BEST TRENDING MARKET
  printLine("=");
  console.log("🎯 BEST TRENDING MARKET (RECOMMENDED)");
  printLine("=");
  
  const best = ranked[0];
  console.log(`\n🔥 TOP PICK: ${best.display} (${best.symbol})`);
  console.log(`\n📊 Analysis Summary:`);
  console.log(`   • Trend Direction: ${best.trend.direction}`);
  console.log(`   • Trend Strength: ${best.trend.strength.toFixed(1)}%`);
  console.log(`   • Latest Price: ${best.latestPrice.toFixed(2)}`);
  console.log(`   • MA5: ${best.trend.currentMA5.toFixed(2)}`);
  console.log(`   • MA20: ${best.trend.currentMA20.toFixed(2)}`);
  console.log(`   • Price vs MA20: ${best.trend.priceVsMA20}%`);
  console.log(`   • 10-bar Momentum: ${best.trend.recentMomentum}%`);
  console.log(`   • MA5 Slope: ${best.trend.ma5Slope}%`);
  
  console.log(`\n🎯 Trading Signal:`);
  if (best.latestCrossover.direction === "BULLISH") {
    console.log(`   ✅ ACTION: BUY (CALL Option)`);
    console.log(`   📈 Entry: Market price (${best.latestPrice.toFixed(2)})`);
    console.log(`   🛑 Stop Loss: Below MA20 (${best.trend.currentMA20.toFixed(2)})`);
    console.log(`   🎯 Take Profit: Next resistance or 2-3% above entry`);
  } else {
    console.log(`   ✅ ACTION: SELL (PUT Option)`);
    console.log(`   📉 Entry: Market price (${best.latestPrice.toFixed(2)})`);
    console.log(`   🛑 Stop Loss: Above MA20 (${best.trend.currentMA20.toFixed(2)})`);
    console.log(`   🎯 Take Profit: Next support or 2-3% below entry`);
  }
  
  console.log(`\n📅 Last Crossover: ${best.latestCrossover.date}`);
  console.log(`⏰ Analysis Time: ${new Date().toISOString()}`);
  
  // Export results to JSON for further processing
  const outputFile = path.join(DATA_DIR, "analysis_results.json");
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    settings: { ma_short: MA_SHORT, ma_long: MA_LONG, min_candles: MIN_CANDLES },
    best: {
      symbol: best.symbol,
      display: best.display,
      trend: best.trend,
      crossover: best.latestCrossover
    },
    ranked: ranked.map(r => ({
      symbol: r.symbol,
      display: r.display,
      trendDirection: r.trend.direction,
      trendStrength: r.trend.strength,
      latestCrossover: r.latestCrossover
    })),
    allResults: results
  }, null, 2));
  
  console.log(`\n💾 Detailed results saved to: ${outputFile}`);
}

// Run the analysis
main();