import { Sequelize } from 'sequelize';
import sqlite3 from 'sqlite3';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  dialectModule: sqlite3,
  logging: console.log, // for development
});

export default sequelize;