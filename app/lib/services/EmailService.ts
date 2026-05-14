import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_3dpftXV6_2fZihczWGsJvaostp6facTYM";
const FROM_EMAIL = "onboarding@resend.dev";
const TO_EMAIL = "bobaathebelefhoko@gmail.com";

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

export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(RESEND_API_KEY);
  }

  /**
   * Send email when initial candle data fetch is complete
   */
  async sendDataFetchCompleteEmail(results: { totalInserted: number; results: any[] }): Promise<void> {
    const successCount = results.results.filter(r => r.status === "ok").length;
    const failedCount = results.results.filter(r => r.status !== "ok").length;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Candle Data Fetch Complete</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${COLORS.gradient}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .content { padding: 40px 30px; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { background: ${COLORS.light}; padding: 20px; border-radius: 16px; text-align: center; }
          .stat-value { font-size: 32px; font-weight: 800; color: ${COLORS.primary}; }
          .stat-label { font-size: 12px; color: #6B7280; margin-top: 5px; }
          .success-badge { background: ${COLORS.success}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
          .failed-badge { background: ${COLORS.danger}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Candle Data Fetch Complete</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Initial 1000 candles loaded</p>
          </div>
          <div class="content">
            <div class="stats">
              <div class="stat-card">
                <div class="stat-value">${results.totalInserted.toLocaleString()}</div>
                <div class="stat-label">Total Candles Inserted</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${successCount}</div>
                <div class="stat-label">✅ Successful Symbols</div>
              </div>
            </div>
            ${failedCount > 0 ? `
              <div style="background: rgba(239,68,68,0.1); padding: 15px; border-radius: 12px; margin-top: 20px;">
                <strong style="color: ${COLORS.danger};">❌ Failed Symbols:</strong><br>
                ${results.results.filter(r => r.status !== "ok").map(r => r.symbol).join(", ")}
              </div>
            ` : ''}
            <p style="margin-top: 20px; color: ${COLORS.dark};">All candle data has been successfully stored in JSON files.</p>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail("✅ Candle Data Fetch Complete", html);
  }

  /**
   * Send email when incremental candle update is complete
   */
  async sendDataUpdateEmail(result: { totalAdded: number; results: any[] }): Promise<void> {
    const addedSymbols = result.results.filter(r => r.added);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Candle Data Update</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${COLORS.gradient}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .content { padding: 40px 30px; }
          .update-card { background: ${COLORS.success}10; border: 2px solid ${COLORS.success}; border-radius: 16px; padding: 20px; margin: 20px 0; text-align: center; }
          .update-number { font-size: 48px; font-weight: 800; color: ${COLORS.success}; }
          .symbol-list { margin-top: 20px; }
          .symbol-item { padding: 10px; border-bottom: 1px solid ${COLORS.light}; display: flex; justify-content: space-between; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Candle Data Updated</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Incremental update completed</p>
          </div>
          <div class="content">
            <div class="update-card">
              <div class="update-number">+${result.totalAdded}</div>
              <div>New Candles Added</div>
            </div>
            ${addedSymbols.length > 0 ? `
              <div class="symbol-list">
                <strong>📊 New candles added for:</strong>
                ${addedSymbols.map(s => `
                  <div class="symbol-item">
                    <span>${s.symbol}</span>
                    <span>${s.date} (epoch: ${s.epoch})</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p style="text-align: center;">No new candles available at this time</p>'}
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(`🔄 Candle Update: +${result.totalAdded} new candles`, html);
  }

  /**
   * Send email when a trade is placed
   */
  async sendTradePlacedEmail(sessionId: string, betLevel: number, amount: number, direction: string, symbol: string): Promise<void> {
    const directionColor = direction === 'CALL' ? COLORS.success : COLORS.danger;
    const directionBg = direction === 'CALL' ? `${COLORS.success}10` : `${COLORS.danger}10`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Trade Placed</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${COLORS.gradient}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .trade-card { background: ${directionBg}; border-left: 4px solid ${directionColor}; padding: 20px; margin: 20px 0; border-radius: 12px; }
          .trade-detail { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Trade Placed</h1>
          </div>
          <div class="content" style="padding: 40px 30px;">
            <div class="trade-card">
              <div class="trade-detail">
                <strong>Symbol:</strong> <span>${symbol}</span>
              </div>
              <div class="trade-detail">
                <strong>Direction:</strong> <span style="color: ${directionColor}; font-weight: bold;">${direction}</span>
              </div>
              <div class="trade-detail">
                <strong>Amount:</strong> <span>$${amount}</span>
              </div>
              <div class="trade-detail">
                <strong>Bet Level:</strong> <span>${betLevel}/5</span>
              </div>
              <div class="trade-detail">
                <strong>Expiry:</strong> <span>30 minutes</span>
              </div>
              <div class="trade-detail">
                <strong>Session ID:</strong> <span style="font-size: 11px;">${sessionId.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(`💰 Trade Placed: ${symbol} ${direction} $${amount}`, html);
  }

  /**
   * Send email with trade result
   */
  async sendBetResultEmail(sessionId: string, betLevel: number, result: 'win' | 'loss', symbol: string): Promise<void> {
    const resultColor = result === 'win' ? COLORS.success : COLORS.danger;
    const resultBg = result === 'win' ? `${COLORS.success}10` : `${COLORS.danger}10`;
    const emoji = result === 'win' ? '🎉' : '❌';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bet Result - ${result.toUpperCase()}</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${result === 'win' ? COLORS.success : COLORS.danger}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .result-card { background: ${resultBg}; border: 2px solid ${resultColor}; border-radius: 16px; padding: 30px; margin: 20px 0; text-align: center; }
          .result-text { font-size: 48px; font-weight: 800; color: ${resultColor}; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${emoji} Bet ${betLevel} ${result.toUpperCase()}</h1>
          </div>
          <div class="content" style="padding: 40px 30px;">
            <div class="result-card">
              <div class="result-text">${result.toUpperCase()}</div>
              <p style="margin-top: 20px;"><strong>${symbol}</strong> - Level ${betLevel}/5</p>
              <p style="font-size: 12px; color: #6B7280;">Session: ${sessionId.substring(0, 8)}...</p>
            </div>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(`${emoji} Bet ${betLevel} Result: ${result.toUpperCase()}`, html);
  }

  /**
   * Send email when session completes
   */
  async sendSessionResultEmail(sessionId: string, result: 'win' | 'loss', symbol: string): Promise<void> {
    const resultColor = result === 'win' ? COLORS.success : COLORS.danger;
    const emoji = result === 'win' ? '🏆' : '📉';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Session Complete - ${result.toUpperCase()}</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${resultColor}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .result-card { text-align: center; padding: 30px; }
          .result-text { font-size: 48px; font-weight: 800; color: ${resultColor}; margin: 20px 0; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${emoji} Session Complete</h1>
          </div>
          <div class="content" style="padding: 40px 30px;">
            <div class="result-card">
              <div class="result-text">${result.toUpperCase()}</div>
              <p><strong>${symbol}</strong> - 5-bet session completed</p>
              <p style="font-size: 12px; color: #6B7280;">Session ID: ${sessionId.substring(0, 8)}...</p>
              <p style="margin-top: 20px;">${result === 'win' ? '🎉 At least one pattern achieved all wins!' : '😔 No pattern achieved all wins.'}</p>
            </div>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(`${emoji} Session ${result.toUpperCase()} - ${symbol}`, html);
  }

  /**
   * Send email for errors
   */
  async sendErrorEmail(error: Error, context: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Error Alert</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${COLORS.danger}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .error-card { background: ${COLORS.danger}10; border-left: 4px solid ${COLORS.danger}; padding: 20px; margin: 20px 0; border-radius: 12px; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Error Occurred</h1>
          </div>
          <div class="content" style="padding: 40px 30px;">
            <div class="error-card">
              <p><strong>Context:</strong> ${context}</p>
              <p><strong>Error:</strong> ${error.message}</p>
              <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: ${COLORS.primary};">View Stack Trace</summary>
                <pre style="margin-top: 10px; font-size: 11px; overflow-x: auto;">${error.stack}</pre>
              </details>
            </div>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(`⚠️ Error: ${context}`, html);
  }

  /**
   * Send bot start email
   */
  async sendBotStartEmail(): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bot Started</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${COLORS.gradient}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🤖 StarBot Started</h1>
          </div>
          <div class="content" style="padding: 40px 30px; text-align: center;">
            <p>The StarBot trading system has been initialized and is now active.</p>
            <p style="margin-top: 20px;">Monitoring markets for MA5/MA10 crossovers...</p>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail("🤖 StarBot Started", html);
  }

  /**
   * Send email when a new session starts
   */
  async sendSessionStartEmail(sessionId: string, symbol: string, trend: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>New Session Started</title>
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #F9FAFB; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
          .header { background: ${COLORS.gradient}; padding: 40px 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 800; }
          .session-card { background: ${COLORS.light}; padding: 20px; border-radius: 16px; margin: 20px 0; }
          .footer { background: ${COLORS.light}; padding: 30px; text-align: center; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 New Session Started</h1>
          </div>
          <div class="content" style="padding: 40px 30px;">
            <div class="session-card">
              <p><strong>Symbol:</strong> ${symbol}</p>
              <p><strong>Trend:</strong> ${trend}</p>
              <p><strong>Duration:</strong> 150 minutes (5 x 30-minute candles)</p>
              <p style="font-size: 11px;"><strong>Session ID:</strong> ${sessionId.substring(0, 8)}...</p>
            </div>
          </div>
          <div class="footer">
            <p>⏰ ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(`📊 New Session: ${symbol} ${trend}`, html);
  }

  /**
   * Generic email sender
   */
  private async sendEmail(subject: string, html: string): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: subject,
        html: html,
      });
      
      if (error) {
        console.error("❌ Failed to send email:", error);
      } else {
        console.log(`✅ Email sent: ${subject} (ID: ${data?.id})`);
      }
    } catch (error) {
      console.error("❌ Email sending error:", error);
    }
  }
}