/**
 * Email Service - Send Professional Market Analysis Reports
 * Updated to work with Resend's test domain
 */

const fs = require("fs");
const path = require("path");

// Resend API configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_3dpftXV6_2fZihczWGsJvaostp6facTYM";
// Use Resend's test domain - only works with your email address
const FROM_EMAIL = "onboarding@resend.dev";  // Resend's default test domain
const TO_EMAIL = "bobaathebelefhoko@gmail.com";

// Color scheme (Blues & Adobe colors)
const COLORS = {
  primary: "#1E3A8A",
  secondary: "#2563EB",
  accent: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  dark: "#1F2937",
  light: "#F3F4F6",
  white: "#FFFFFF",
  gradient: "linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)"
};

function formatNumber(num, decimals = 2) {
  if (num === undefined || num === null) return "N/A";
  return parseFloat(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function generateAnalysisEmail(analysis) {
  const best = analysis.best;
  const ranked = analysis.ranked || [];
  const top3 = ranked.slice(0, 3);
  
  const signalColor = best?.crossover?.direction === "BULLISH" ? COLORS.success : COLORS.danger;
  const signalBg = best?.crossover?.direction === "BULLISH" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Market Analysis Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F9FAFB;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: ${COLORS.white};
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
    }
    .header {
      background: ${COLORS.gradient};
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: ${COLORS.white};
      margin: 0;
      font-size: 28px;
      font-weight: 800;
    }
    .header p {
      color: rgba(255,255,255,0.9);
      margin: 10px 0 0;
      font-size: 14px;
    }
    .content {
      padding: 40px 30px;
    }
    .signal-card {
      background: ${signalBg};
      border: 2px solid ${signalColor};
      border-radius: 20px;
      padding: 25px;
      margin-bottom: 35px;
      text-align: center;
    }
    .signal-label {
      color: ${signalColor};
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .signal-action {
      font-size: 32px;
      font-weight: 800;
      color: ${signalColor};
      margin: 10px 0;
    }
    .signal-price {
      font-size: 20px;
      font-weight: 600;
      color: ${COLORS.dark};
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 25px 0;
    }
    .metric {
      background: ${COLORS.light};
      padding: 15px;
      border-radius: 12px;
      text-align: left;
    }
    .metric-label {
      font-size: 11px;
      color: #6B7280;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 18px;
      font-weight: 700;
      color: ${COLORS.dark};
    }
    .rank-list {
      margin: 20px 0;
    }
    .rank-item {
      display: flex;
      align-items: center;
      padding: 15px;
      background: ${COLORS.light};
      border-radius: 12px;
      margin-bottom: 10px;
    }
    .rank-number {
      width: 35px;
      height: 35px;
      background: ${COLORS.primary};
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-right: 15px;
    }
    .rank-info {
      flex: 1;
    }
    .rank-symbol {
      font-weight: 700;
      color: ${COLORS.dark};
    }
    .rank-trend {
      font-size: 12px;
      color: #6B7280;
      margin-top: 3px;
    }
    .rank-strength {
      font-weight: 700;
      color: ${COLORS.primary};
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin: 30px 0 20px;
      color: ${COLORS.dark};
    }
    .footer {
      background: ${COLORS.light};
      padding: 30px;
      text-align: center;
    }
    .footer p {
      margin: 0;
      color: #6B7280;
      font-size: 12px;
    }
    .badge-bullish {
      background: ${COLORS.success};
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-bearish {
      background: ${COLORS.danger};
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-neutral {
      background: #9CA3AF;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Market Analysis Report</h1>
      <p>${analysis.timestamp}</p>
    </div>
    
    <div class="content">
      ${best ? `
      <div class="signal-card">
        <div class="signal-label">🚀 TOP RECOMMENDATION</div>
        <div class="signal-action">${best.symbol} - ${best.crossover?.direction === "BULLISH" ? "BUY (CALL)" : "SELL (PUT)"}</div>
        <div class="signal-price">Entry: $${formatNumber(best.trend?.currentPrice)}</div>
        
        <div class="metrics-grid">
          <div class="metric">
            <div class="metric-label">Trend Strength</div>
            <div class="metric-value">${best.trend?.strength?.toFixed(1)}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Momentum</div>
            <div class="metric-value">${best.trend?.recentMomentum || 0}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">MA5</div>
            <div class="metric-value">${formatNumber(best.trend?.currentMA5)}</div>
          </div>
          <div class="metric">
            <div class="metric-label">MA20</div>
            <div class="metric-value">${formatNumber(best.trend?.currentMA20)}</div>
          </div>
        </div>
        
        <div style="margin-top: 15px; font-size: 13px; color: #6B7280;">
          📈 Price vs MA20: ${best.trend?.priceVsMA20 || 0}% | 📊 MA5 Slope: ${best.trend?.ma5Slope || 0}%
        </div>
      </div>
      ` : '<p style="text-align: center;">No clear signals at this time</p>'}
      
      <div class="section-title">🏆 Top Trending Markets</div>
      <div class="rank-list">
        ${top3.length > 0 ? top3.map((item, idx) => `
          <div class="rank-item">
            <div class="rank-number">${idx + 1}</div>
            <div class="rank-info">
              <div class="rank-symbol">${item.symbol}</div>
              <div class="rank-trend">
                ${item.trendDirection === "BULLISH" ? '<span class="badge-bullish">BULLISH</span>' : 
                  item.trendDirection === "BEARISH" ? '<span class="badge-bearish">BEARISH</span>' : 
                  '<span class="badge-neutral">NEUTRAL</span>'}
              </div>
            </div>
            <div class="rank-strength">${item.trendStrength?.toFixed(1)}%</div>
          </div>
        `).join('') : '<p>No trending markets detected</p>'}
      </div>
      
      ${best?.crossover ? `
      <div class="section-title">📊 Trading Parameters</div>
      <div style="background: ${COLORS.light}; padding: 20px; border-radius: 16px;">
        <p style="margin: 0 0 10px;"><strong>✅ ${best.crossover.direction === "BULLISH" ? "BUY (CALL) Recommendation" : "SELL (PUT) Recommendation"}</strong></p>
        <p style="margin: 5px 0;">• Entry: Market price (${formatNumber(best.trend?.currentPrice)})</p>
        <p style="margin: 5px 0;">• Stop Loss: ${best.crossover.direction === "BULLISH" ? "Below MA20" : "Above MA20"} (${formatNumber(best.trend?.currentMA20)})</p>
        <p style="margin: 5px 0;">• Take Profit: ${best.crossover.direction === "BULLISH" ? "+2-3%" : "-2-3%"} from entry</p>
        <p style="margin: 10px 0 0; font-size: 13px; color: ${COLORS.primary};">⏱️ Recommended Duration: 30-60 minutes</p>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>Analysis based on MA5/MA20 crossover with trend confirmation</p>
      <p>Powered by Deriv API • Automated Trading Analysis System</p>
      <p style="margin-top: 10px; font-size: 10px;">This is an automated message from your trading bot</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendAnalysisEmail(analysisData) {
  // Dynamic import for ES module
  const { Resend } = await import('resend');
  
  const resend = new Resend(RESEND_API_KEY);
  
  const best = analysisData.best;
  const signal = best?.crossover?.direction === "BULLISH" ? "🚀 BUY Signal" : 
                  best?.crossover?.direction === "BEARISH" ? "📉 SELL Signal" : 
                  "Market Report";
  
  const subject = `🎯 Market Analysis - ${best?.symbol || "Multiple Symbols"} ${signal}`;
  const html = generateAnalysisEmail(analysisData);
  
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: subject,
      html: html,
    });
    
    if (error) {
      console.error("❌ Failed to send email:", error);
      return { success: false, error };
    }
    
    console.log(`✅ Email sent successfully! ID: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error("❌ Email sending error:", error);
    return { success: false, error };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  let resultsFile = null;
  
  for (const arg of args) {
    if (arg.startsWith("--results=")) {
      resultsFile = arg.split("=")[1];
    }
  }
  
  if (!resultsFile) {
    console.error("❌ Please provide results file: --results=./path/to/results.json");
    process.exit(1);
  }
  
  if (!fs.existsSync(resultsFile)) {
    console.error(`❌ Results file not found: ${resultsFile}`);
    process.exit(1);
  }
  
  const analysisData = JSON.parse(fs.readFileSync(resultsFile, "utf8"));
  await sendAnalysisEmail(analysisData);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { sendAnalysisEmail };