import { NextRequest, NextResponse } from 'next/server';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';
import { EmailService } from '../../lib/services/EmailService';

const candleService = new DerivDataCandleService();
const emailService = new EmailService();

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('📊 Fetching initial candle data...');
    const result = await candleService.fetchInitialCandles();
    
    // Send email notification
    await emailService.sendDataFetchCompleteEmail(result);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Candle data fetched successfully',
      totalInserted: result.totalInserted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error:', error);
    await emailService.sendErrorEmail(error as Error, 'Initial candle fetch');
    return NextResponse.json(
      { error: 'Failed to fetch candles', details: String(error) }, 
      { status: 500 }
    );
  }
}