import { NextRequest, NextResponse } from 'next/server';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';

const service = new DerivDataCandleService();

export async function POST(request: NextRequest) {
  try {
    // Add authentication check
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    await service.initialize();
    return NextResponse.json({ message: 'Candle data initialized successfully' });
  } catch (error) {
    console.error('Error initializing candle data:', error);
    return NextResponse.json({ error: 'Failed to initialize candle data' }, { status: 500 });
  }
}