import { SessionService } from '../app/lib/services/SessionService';
import { BetRecordService } from '../app/lib/services/BetRecordService';

async function initDB() {
  try {
    const sessionService = new SessionService();
    const betRecordService = new BetRecordService();

    await sessionService.createTable();
    await betRecordService.createTables();

    console.log('Database initialized successfully.');

  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDB();