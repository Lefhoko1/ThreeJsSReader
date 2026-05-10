import { Sequelize } from 'sequelize';

// Use the non-pooling URL from Vercel Supabase integration
const databaseUrl = process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  throw new Error('POSTGRES_URL_NON_POOLING environment variable is missing.');
}

// Append sslmode=verify-full to enforce proper SSL validation
const finalUrl = databaseUrl.includes('sslmode=')
  ? databaseUrl.replace(/sslmode=\w+/, 'sslmode=verify-full')
  : `${databaseUrl}&sslmode=verify-full`;

const sequelize = new Sequelize(finalUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

export default sequelize;