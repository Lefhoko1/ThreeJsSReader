import { NextRequest } from 'next/server';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';
import sequelize from '../../lib/database';

const service = new DerivDataCandleService(sequelize);

export async function POST(request: NextRequest) {
  try {
    await service.updateLatestCandles();
    return Response.json({ message: 'Latest candles updated successfully' });
  } catch (error) {
    console.error('Error updating candles:', error);
    return Response.json({ error: 'Failed to update candles' }, { status: 500 });
  }
}