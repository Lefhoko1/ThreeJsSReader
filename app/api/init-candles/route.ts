import { NextRequest } from 'next/server';
import { DerivDataCandleService } from '../../lib/services/DerivDataCandleService';
import sequelize from '../../lib/database';

const service = new DerivDataCandleService(sequelize);

export async function POST(request: NextRequest) {
  try {
    await service.initialize();
    return Response.json({ message: 'Candle data initialized successfully' });
  } catch (error) {
    console.error('Error initializing candle data:', error);
    return Response.json({ error: 'Failed to initialize candle data' }, { status: 500 });
  }
}