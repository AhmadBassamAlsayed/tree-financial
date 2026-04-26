const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LedgerEntry = sequelize.define('LedgerEntry', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  transactionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'transaction_id'
  },
  accountId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'account_id'
  },
  amount: {
    type: DataTypes.DECIMAL(20, 4),
    allowNull: false,
    field: 'amount'
  },
  direction: {
    type: DataTypes.ENUM('CREDIT', 'DEBIT'),
    allowNull: false,
    field: 'direction'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
    field: 'status'
  },
  // Verifying this chain proves the balance history has not been tampered with
  fingerprint: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'fingerprint'
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
  tableName: 'ledger_entries',
  timestamps: true,
  underscored: true
});

module.exports = LedgerEntry;
