import { NextRequest } from 'next/server';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';
import sequelize from '../../lib/database';
import {  NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕯️ Updating latest candles...');
    const service = new DerivDataCandleService(sequelize);
    await service.createTables(); // Ensure tables exist
    await service.updateLatestCandles();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Latest candles updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: 'Failed to update candles', details: String(error) }, 
      { status: 500 }
    );
  }
}