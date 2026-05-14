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

    console.log('🕯️ Updating latest candles...');
    await candleService.createTables();
    const result = await candleService.updateLatestCandles();
    
    // Send email notification if new candles were added
    if (result.totalAdded > 0) {
      await emailService.sendDataUpdateEmail(result);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Latest candles updated successfully',
      totalAdded: result.totalAdded,
      results: result.results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error:', error);
    await emailService.sendErrorEmail(error as Error, 'Candle update');
    return NextResponse.json(
      { error: 'Failed to update candles', details: String(error) }, 
      { status: 500 }
    );
  }
}