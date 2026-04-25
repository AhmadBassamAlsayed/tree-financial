const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  referenceNumber: {
    // Unique human-readable reference, e.g. TXN-1714000000000-a3f2
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    field: 'reference_number'
  },
  type: {
    type: DataTypes.ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'SPLIT_PAYMENT'),
    allowNull: false,
    field: 'type'
  },
  totalDebit: {
    type: DataTypes.DECIMAL(20, 4),
    allowNull: false,
    defaultValue: 0,
    field: 'total_debit'
  },
  totalCredit: {
    type: DataTypes.DECIMAL(20, 4),
    allowNull: false,
    defaultValue: 0,
    field: 'total_credit'
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'SYP',
    field: 'currency'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
    field: 'status'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'description'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'updated_at'
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true
});

module.exports = Transaction;
