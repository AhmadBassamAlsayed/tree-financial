const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Account = sequelize.define('Account', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM('user', 'shop'),
    allowNull: false,
    field: 'type'
  },
  sn: {
    // 20-digit unique serial number across all wallets
    type: DataTypes.CHAR(20),
    allowNull: false,
    unique: true,
    field: 'sn'
  },
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'user_id'
  },
  shopId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'shop_id'
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'SYP',
    field: 'currency'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'frozen'),
    allowNull: false,
    defaultValue: 'active',
    field: 'status'
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
  tableName: 'accounts',
  timestamps: true,
  underscored: true
});

module.exports = Account;
