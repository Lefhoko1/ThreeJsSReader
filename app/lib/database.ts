import { Sequelize } from 'sequelize';
import pg from 'pg';

const sequelize = new Sequelize(process.env.SUPABASE_DATABASE_URL!, {
  dialect: 'postgres',
  dialectModule: pg,
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

export default sequelize;
