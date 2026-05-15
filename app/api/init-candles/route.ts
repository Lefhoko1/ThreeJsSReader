import { NextRequest, NextResponse } from 'next/server';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';
import { EmailService } from '../../lib/services/EmailService';

const candleService = new DerivDataCandleService();
const emailService = new EmailService();

export async function POST(request: NextRequest) {
  try {
    // Read the secret from the request header
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = 'a3f8c2e1b7d4e9f0c6a2b5d8e1f4a7c0b3d6e9f2a5b8c1d4e7f0a3b6c9d2e5';
    
    // Compare header value with expected secret
    if (cronSecret !== expectedSecret) {
      console.log(`Unauthorized attempt. Received: ${cronSecret}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // STEP 1: Create tables first (if they don't exist)
    console.log('📋 Creating database tables...');
    await candleService.createTables();
    console.log('✅ Tables created or verified');
    
    // STEP 2: Fetch initial candle data
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