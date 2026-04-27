const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountHold = sequelize.define('AccountHold', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  accountId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'account_id'
  },
  amount: {
    type: DataTypes.DECIMAL(20, 4),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'captured', 'released'),
    allowNull: false,
    defaultValue: 'active'
  },
  reference: {
    type: DataTypes.STRING(128),
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at'
  }
}, {
  tableName: 'account_holds',
  timestamps: true,
  underscored: true
});

module.exports = AccountHold;
