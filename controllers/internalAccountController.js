const { Account } = require('../models/Index');
const { getBalance, getAvailableBalance } = require('../utils/balance.utils');

const getAccountByUser = async (req, res) => {
  try {
    const { userId, currency } = req.query;

    if (!userId || !currency) {
      return res.status(400).json({ error: 'MISSING_PARAMS', message: 'userId and currency are required' });
    }

    const account = await Account.findOne({
      where: { userId: parseInt(userId), currency, status: 'active', type: 'user' }
    });

    if (!account) return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });

    const balance = await getBalance(account.id);

    return res.status(200).json({
      accountSN: account.sn,
      accountId: account.id,
      balance: balance.toFixed(4),
      currency: account.currency,
      status: account.status
    });
  } catch (err) {
    console.error('getAccountByUser error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

const getAvailableBalanceEndpoint = async (req, res) => {
  try {
    const account = await Account.findOne({ where: { sn: req.params.sn } });
    if (!account) return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });

    const balance = await getBalance(account.id);
    const available = await getAvailableBalance(account.id);
    const activeHolds = balance - available;

    return res.status(200).json({
      accountSN: account.sn,
      balance: balance.toFixed(4),
      activeHolds: activeHolds.toFixed(4),
      availableBalance: available.toFixed(4)
    });
  } catch (err) {
    console.error('getAvailableBalanceEndpoint error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

module.exports = { getAccountByUser, getAvailableBalanceEndpoint };
