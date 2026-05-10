const { Sequelize, DataTypes, Model } = require('sequelize');
const pg = require('pg');

// Use the non-pooling URL but WITHOUT any sslmode parameter in the string itself
const databaseUrl = 'postgres://postgres.wbszfoogorgnaxdvezti:4AqL0waGDMydt6lm@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectModule: pg,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // This tells the driver to ignore self-signed certificate errors
    },
  },
  logging: false,
});

// Define a test model
class TestCandle extends Model {}
TestCandle.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  timestamp: { type: DataTypes.DATE, allowNull: false },
  open: { type: DataTypes.FLOAT, allowNull: false },
  close: { type: DataTypes.FLOAT, allowNull: false },
}, { 
  sequelize, 
  tableName: 'test_candles',
  timestamps: false,
  freezeTableName: true,
});

async function test() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    await TestCandle.sync({ force: true });
    console.log('✅ Table created: test_candles');
    
    // Insert a test record
    await TestCandle.create({
      timestamp: new Date(),
      open: 100.5,
      close: 101.2,
    });
    console.log('✅ Test record inserted');
    
    // Read it back
    const records = await TestCandle.findAll();
    console.log('✅ Records found:', records.length);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();