import { Sequelize } from 'sequelize';
import pg from 'pg';

const databaseUrl = process.env.POSTGRES_URL_NON_POOLING || 'postgres://postgres.wbszfoogorgnaxdvezti:4AqL0waGDMydt6lm@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectModule: pg,
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

export default sequelize;