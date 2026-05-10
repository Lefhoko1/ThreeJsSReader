import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export class Strategy extends Model {
  public id!: number;
  public name!: string;
  public description?: string;
}

Strategy.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'strategies',
  }
);