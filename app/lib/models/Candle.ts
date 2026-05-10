import { Sequelize, DataTypes, Model } from 'sequelize';

export interface CandleAttributes {
  id?: number;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  created_at?: Date;
}

export class Candle extends Model<CandleAttributes> implements CandleAttributes {
  declare id: number;
  declare timestamp: Date;
  declare open: number;
  declare high: number;
  declare low: number;
  declare close: number;
  declare volume: number;
  declare created_at: Date;
}

export function createCandleModel(sequelize: Sequelize, tableName: string) {
  Candle.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      open: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      high: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      low: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      close: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      volume: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: tableName, // Use exact table name provided
      timestamps: false,
      indexes: [
        {
          fields: ['timestamp'],
        },
      ],
    }
  );
  
  return Candle;
}