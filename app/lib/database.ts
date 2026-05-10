import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(process.env.SUPABASE_DATABASE_URL!, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

export default sequelize;