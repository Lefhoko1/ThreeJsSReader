import { NextRequest, NextResponse } from 'next/server';
import { StarBotTradingLogic } from '../../lib/tradinglogic';
import { DerivTradingService } from '../../lib/services/DerivTradingService';
import { EmailService } from '../../lib/services/EmailService';

const emailService = new EmailService();
const derivConfig = {
  appId: parseInt(process.env.DERIV_APP_ID || '1089', 10),
  token: process.env.DERIV_TOKEN || '',
  wsUrl: 'wss://ws.binaryws.com/websockets/v3'
};
const tradingBot = new StarBotTradingLogic(derivConfig);
const derivTradingService = new DerivTradingService(derivConfig);

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = 'a3f8c2e1b7d4e9f0c6a2b5d8e1f4a7c0b3d6e9f2a5b8c1d4e7f0a3b6c9d2e5';
    
    if (cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🤖 Processing trading cycle...');
    await tradingBot.processTradingCycle();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Trading cycle processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error:', error);
    await emailService.sendErrorEmail(error as Error, 'Trading cycle');
    return NextResponse.json(
      { error: 'Failed to process trading cycle', details: String(error) }, 
      { status: 500 }
    );
  }
}