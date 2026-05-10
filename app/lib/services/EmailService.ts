import { Resend } from 'resend';

export class EmailService {
  private resend: Resend;
  private recipientEmail: string = 'lefhokobobaathebe1@gmail.com';

  constructor() {
    this.resend = new Resend('re_GTUa564A_8WKfXGEcp4MgVMn331B6qyLD');
  }

  async sendBotStartEmail(): Promise<void> {
    const html = `
      <div style="font-family: 'Roboto', sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #1976D2; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🤖 StarBot Started</h1>
          </div>
          <div style="padding: 20px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              The StarBot trading system has been initialized and is now active.
            </p>
            <p style="color: #666; font-size: 14px;">
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail('StarBot Started', html);
  }

  async sendSessionStartEmail(sessionId: string, symbol: string, trend: string): Promise<void> {
    const html = `
      <div style="font-family: 'Roboto', sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #1976D2; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">📊 New Trading Session Started</h1>
          </div>
          <div style="padding: 20px;">
            <div style="background-color: #E3F2FD; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
              <strong>Session ID:</strong> ${sessionId}<br>
              <strong>Symbol:</strong> ${symbol}<br>
              <strong>Trend:</strong> ${trend}<br>
              <strong>Duration:</strong> 150 minutes (5 x 30-minute candles)
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              A new trading session has begun. The bot will execute 5 bets over the next 150 minutes.
            </p>
            <p style="color: #666; font-size: 14px;">
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail('New Trading Session Started', html);
  }

  async sendTradePlacedEmail(sessionId: string, betLevel: number, amount: number, direction: string, symbol: string): Promise<void> {
    const html = `
      <div style="font-family: 'Roboto', sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #1976D2; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🚀 Trade Placed</h1>
          </div>
          <div style="padding: 20px;">
            <div style="background-color: #E8F5E8; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
              <strong>Session ID:</strong> ${sessionId}<br>
              <strong>Bet Level:</strong> ${betLevel}<br>
              <strong>Amount:</strong> $${amount}<br>
              <strong>Direction:</strong> ${direction}<br>
              <strong>Symbol:</strong> ${symbol}<br>
              <strong>Expiry:</strong> 30 minutes
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              A trade has been placed on the Deriv platform.
            </p>
            <p style="color: #666; font-size: 14px;">
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail('Trade Placed', html);
  }

  async sendBetResultEmail(sessionId: string, betLevel: number, result: 'win' | 'loss', symbol: string): Promise<void> {
    const resultColor = result === 'win' ? '#4CAF50' : '#F44336';
    const resultBg = result === 'win' ? '#E8F5E8' : '#FFEBEE';

    const html = `
      <div style="font-family: 'Roboto', sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #1976D2; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">📈 Bet Result</h1>
          </div>
          <div style="padding: 20px;">
            <div style="background-color: ${resultBg}; padding: 15px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid ${resultColor};">
              <strong>Session ID:</strong> ${sessionId}<br>
              <strong>Bet Level:</strong> ${betLevel}<br>
              <strong>Symbol:</strong> ${symbol}<br>
              <strong>Result:</strong> <span style="color: ${resultColor}; font-weight: bold;">${result.toUpperCase()}</span>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Bet ${betLevel} has completed with a ${result}.
            </p>
            <p style="color: #666; font-size: 14px;">
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail(`Bet ${betLevel} Result: ${result.toUpperCase()}`, html);
  }

  async sendSessionResultEmail(sessionId: string, result: 'win' | 'loss', symbol: string): Promise<void> {
    const resultColor = result === 'win' ? '#4CAF50' : '#F44336';
    const resultBg = result === 'win' ? '#E8F5E8' : '#FFEBEE';

    const html = `
      <div style="font-family: 'Roboto', sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #1976D2; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🏁 Session Completed</h1>
          </div>
          <div style="padding: 20px;">
            <div style="background-color: ${resultBg}; padding: 15px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid ${resultColor};">
              <strong>Session ID:</strong> ${sessionId}<br>
              <strong>Symbol:</strong> ${symbol}<br>
              <strong>Final Result:</strong> <span style="color: ${resultColor}; font-weight: bold; font-size: 18px;">${result.toUpperCase()}</span>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              The trading session has completed. ${result === 'win' ? 'At least one pattern achieved all wins!' : 'No pattern achieved all wins.'}
            </p>
            <p style="color: #666; font-size: 14px;">
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail(`Session Completed: ${result.toUpperCase()}`, html);
  }

  async sendErrorEmail(error: Error, context: string): Promise<void> {
    const html = `
      <div style="font-family: 'Roboto', sans-serif; background-color: #f5f5f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: #F44336; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">❌ Error Occurred</h1>
          </div>
          <div style="padding: 20px;">
            <div style="background-color: #FFEBEE; padding: 15px; border-radius: 4px; margin-bottom: 15px; border-left: 4px solid #F44336;">
              <strong>Context:</strong> ${context}<br>
              <strong>Error:</strong> ${error.message}<br>
              <strong>Stack:</strong> <pre style="white-space: pre-wrap; font-size: 12px;">${error.stack}</pre>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              An error has occurred in the StarBot system. Please check the logs for more details.
            </p>
            <p style="color: #666; font-size: 14px;">
              Timestamp: ${new Date().toISOString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await this.sendEmail('StarBot Error', html);
  }

  private async sendEmail(subject: string, html: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: 'StarBot <onboarding@resend.dev>', // Replace with your verified domain
        to: this.recipientEmail,
        subject,
        html,
      });
      console.log(`📧 Email sent: ${subject}`);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      // Don't throw here to avoid breaking the bot
    }
  }
}