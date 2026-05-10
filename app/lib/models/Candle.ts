import { Sequelize, DataTypes } from 'sequelize';

export interface CandleAttributes {
  id: number;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export function createCandleModel(sequelize: Sequelize, tableName: string) {
  return sequelize.define(tableName, {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    open: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    high: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    low: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    close: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    volume: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    timestamps: false, // Disable automatic timestamps since we have custom timestamp
  });
}