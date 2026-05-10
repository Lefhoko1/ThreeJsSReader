import { DataTypes, Model, ModelStatic, Optional, Sequelize } from 'sequelize';

export interface BetRecordAttributes {
  id?: number;
  sessionid: string;
  sessionresult: string;
  firstbetAmount?: number;
  firstbetResult?: string;
  firstbetactual?: string;
  firstbetexpectedcandle?: string;
  secondbetAmount?: number;
  secondbetResult?: string;
  secondbetactual?: string;
  secondbetexpectedcandle?: string;
  thirdbetAmount?: number;
  thirdbetResult?: string;
  thirdbetactual?: string;
  thirdbetexpectedcandle?: string;
  fourthbetAmount?: number;
  fourthbetResult?: string;
  fourthbetactual?: string;
  fourthbetexpectedcandle?: string;
  fifthbetAmount?: number;
  fifthbetResult?: string;
  fifthbetactual?: string;
  fifthbetexpectedcandle?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BetRecordCreationAttributes = Optional<BetRecordAttributes, 'id' | 'createdAt' | 'updatedAt'>;

const betRecordFields = {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sessionid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sessionresult: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  firstbetAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  firstbetResult: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  firstbetactual: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  firstbetexpectedcandle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  secondbetAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  secondbetResult: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  secondbetactual: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  secondbetexpectedcandle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  thirdbetAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  thirdbetResult: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  thirdbetactual: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  thirdbetexpectedcandle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fourthbetAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  fourthbetResult: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fourthbetactual: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fourthbetexpectedcandle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fifthbetAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  fifthbetResult: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fifthbetactual: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fifthbetexpectedcandle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
};

export function createBetRecordModel(sequelize: Sequelize, tableName: string): ModelStatic<Model<BetRecordAttributes, BetRecordCreationAttributes>> {
  return sequelize.define<Model<BetRecordAttributes, BetRecordCreationAttributes>>(
    tableName,
    betRecordFields,
    {
      tableName,
      timestamps: true,
    }
  );
}
