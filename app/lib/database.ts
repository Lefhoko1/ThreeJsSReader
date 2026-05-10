import { Sequelize } from 'sequelize';
import pg from 'pg';

// Remove sslmode from the URL to avoid conflicts
const databaseUrl = (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '').split('?')[0];

if (!databaseUrl) {
  throw new Error('Database URL not found. Please set POSTGRES_URL_NON_POOLING or POSTGRES_URL');
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectModule: pg,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Required for local development
    },
  },
  logging: false,
});

export default sequelize;
