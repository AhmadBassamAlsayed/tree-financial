const { verifyFingerprint } = require('./fingerprint.utils');
const { Op, literal } = require('sequelize');

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

const getBalances = async (accountIds, t = null) => {
  const { LedgerEntry } = require('../models/Index');

  if (!accountIds.length) return new Map();

  const safeIds = accountIds.map(id => parseInt(id)).join(',');

  const entries = await LedgerEntry.findAll({
    where: {
      accountId: { [Op.in]: accountIds },
      status: 'completed',
      id: {
        [Op.in]: literal(
          `(SELECT MAX(id) FROM ledger_entries WHERE status='completed' AND account_id IN (${safeIds}) GROUP BY account_id)`
        )
      }
    },
    ...(t && { lock: t.LOCK.UPDATE, transaction: t })
  });

  const balanceMap = new Map(accountIds.map(id => [id, 0]));
  for (const entry of entries) {
    if (entry.fingerprint) {
      const payload = verifyFingerprint(entry.fingerprint);
      balanceMap.set(entry.accountId, payload.new_balance);
    }
  }
  return balanceMap;
};

/**
 * Returns the spendable balance = total balance - sum of all active holds.
 * @param {number} accountId
 * @param {import('sequelize').Transaction|null} t
 * @returns {Promise<number>}
 */
const getAvailableBalance = async (accountId, t = null) => {
  const { AccountHold } = require('../models/Index');
  const { fn, col } = require('sequelize');

  const [balance, holdsResult] = await Promise.all([
    getBalance(accountId, t),
    AccountHold.findOne({
      where: { accountId, status: 'active' },
      attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
      ...(t && { transaction: t })
    })
  ]);

  const activeHolds = parseFloat(holdsResult?.dataValues?.total || 0);
  return balance - activeHolds;
};

module.exports = { getBalance, getBalances, canDebit, getAvailableBalance };
