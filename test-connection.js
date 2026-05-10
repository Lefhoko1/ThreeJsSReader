const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('postgresql://postgres:Lefhoko74700170.%3D%2B@db.ntnupiyjsqxfhkcysiwx.supabase.co:5432/postgres', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function test() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connection successful!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

test();