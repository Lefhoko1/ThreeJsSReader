import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface SessionAttributes {
  id?: number;
  sessionid: string;
  symbol: string;
  sessionresult?: string | null;
  firstbetAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Session extends Model<SessionAttributes> {}

Session.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    symbol: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sessionresult: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstbetAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sessions',
    timestamps: true,
  }
);