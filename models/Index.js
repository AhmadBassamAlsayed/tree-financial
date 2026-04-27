const Account = require('./Account.model');
const Transaction = require('./Transaction.model');
const LedgerEntry = require('./LedgerEntry.model');
const AccountHold = require('./AccountHold.model');

// Transaction → LedgerEntries
Transaction.hasMany(LedgerEntry, { foreignKey: 'transactionId', as: 'entries' });
LedgerEntry.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'transaction' });

// Account → LedgerEntries
Account.hasMany(LedgerEntry, { foreignKey: 'accountId', as: 'entries' });
LedgerEntry.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

// Account → AccountHolds
Account.hasMany(AccountHold, { foreignKey: 'accountId', as: 'holds' });
AccountHold.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

module.exports = { Account, Transaction, LedgerEntry, AccountHold };
