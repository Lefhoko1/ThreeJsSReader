import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export class StrategyCombination extends Model {
  public id!: number;
  public pattern!: string;
  public description?: string;
}

StrategyCombination.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    pattern: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'strategy_combinations',
  }
);