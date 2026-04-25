const { verifyFingerprint } = require('./fingerprint.utils');

/**
 * Returns the current balance of an account by reading the latest completed
 * ledger entry's fingerprint. Pass a Sequelize transaction for FOR UPDATE locking.
 * @param {number} accountId
 * @param {import('sequelize').Transaction|null} t
 * @returns {Promise<number>}
 */
const getBalance = async (accountId, t = null) => {
  // Defer model import to avoid circular dependency at module load time
  const { LedgerEntry } = require('../models/Index');

  const latest = await LedgerEntry.findOne({
    where: { accountId, status: 'completed' },
    order: [['createdAt', 'DESC']],
    ...(t && { lock: t.LOCK.UPDATE, transaction: t })
  });

  if (!latest || !latest.fingerprint) return 0;

  const payload = verifyFingerprint(latest.fingerprint);
  return payload.new_balance;
};

/**
 * Checks whether an account has enough balance to cover `amount`.
 * @param {number} accountId
 * @param {number} amount
 * @param {import('sequelize').Transaction|null} t
 * @returns {Promise<boolean>}
 */
const canDebit = async (accountId, amount, t = null) => {
  const balance = await getBalance(accountId, t);
  return balance >= amount;
};

module.exports = { getBalance, canDebit };
