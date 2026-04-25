const { sequelize } = require('../config/database');
const { Account, Transaction, LedgerEntry } = require('../models/Index');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { generateUniqueSN } = require('../utils/sn.utils');
const { getBalance, canDebit } = require('../utils/balance.utils');
const { signFingerprint } = require('../utils/fingerprint.utils');
const crypto = require('crypto');

// POST /api/wallets
const createWallet = async (req, res) => {
  try {
    const { type, userId, shopId, currency } = req.body;

    const sn = await generateUniqueSN();

    const account = await Account.create({
      type,
      sn,
      userId:   type === 'user' ? userId : null,
      shopId:   type === 'shop' ? shopId : null,
      currency: currency || 'SYP',
      status:   'active'
    });

    return successResponse(res, 201, 'Wallet created', account);
  } catch (err) {
    console.error('createWallet error:', err);
    return errorResponse(res, 500, 'Failed to create wallet', err);
  }
};

// GET /api/wallets/:sn
const getWallet = async (req, res) => {
  try {
    const account = await Account.findOne({ where: { sn: req.params.sn } });
    if (!account) return errorResponse(res, 404, 'Wallet not found');

    const balance = await getBalance(account.id);

    return successResponse(res, 200, 'Wallet fetched', { ...account.toJSON(), balance });
  } catch (err) {
    console.error('getWallet error:', err);
    return errorResponse(res, 500, 'Failed to fetch wallet', err);
  }
};

// POST /api/wallets/:sn/deposit
const deposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { amount, description } = req.body;
    const parsedAmount = parseFloat(amount);

    const account = await Account.findOne({ where: { sn: req.params.sn }, transaction: t, lock: t.LOCK.UPDATE });
    if (!account)        { await t.rollback(); return errorResponse(res, 404, 'Wallet not found'); }
    if (account.status !== 'active') { await t.rollback(); return errorResponse(res, 400, `Wallet is ${account.status}`); }

    const oldBalance = await getBalance(account.id, t);
    const newBalance = oldBalance + parsedAmount;

    const txn = await Transaction.create({
      referenceNumber: `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      type:        'DEPOSIT',
      totalDebit:  0,
      totalCredit: parsedAmount,
      currency:    account.currency,
      status:      'pending',
      description: description || null
    }, { transaction: t });

    const entry = await LedgerEntry.create({
      transactionId: txn.id,
      accountId:     account.id,
      amount:        parsedAmount,
      direction:     'CREDIT',
      status:        'pending',
      fingerprint:   null
    }, { transaction: t });

    const fingerprint = signFingerprint({
      id:          entry.id,
      amount:      parsedAmount,
      direction:   'CREDIT',
      status:      'completed',
      old_balance: oldBalance,
      new_balance: newBalance
    });

    await entry.update({ status: 'completed', fingerprint }, { transaction: t });
    await txn.update({ status: 'completed' }, { transaction: t });

    await t.commit();

    return successResponse(res, 200, 'Deposit successful', {
      transactionRef: txn.referenceNumber,
      accountSN:      account.sn,
      amount:         parsedAmount,
      oldBalance,
      newBalance
    });
  } catch (err) {
    await t.rollback();
    console.error('deposit error:', err);
    return errorResponse(res, 500, 'Deposit failed', err);
  }
};

// POST /api/wallets/:sn/withdraw
const withdraw = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { amount, description } = req.body;
    const parsedAmount = parseFloat(amount);

    const account = await Account.findOne({ where: { sn: req.params.sn }, transaction: t, lock: t.LOCK.UPDATE });
    if (!account)        { await t.rollback(); return errorResponse(res, 404, 'Wallet not found'); }
    if (account.status !== 'active') { await t.rollback(); return errorResponse(res, 400, `Wallet is ${account.status}`); }

    const oldBalance = await getBalance(account.id, t);

    if (!(await canDebit(account.id, parsedAmount, t))) {
      await t.rollback();
      return errorResponse(res, 400, `Insufficient balance. Available: ${oldBalance}`);
    }

    const newBalance = oldBalance - parsedAmount;

    const txn = await Transaction.create({
      referenceNumber: `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      type:        'WITHDRAWAL',
      totalDebit:  parsedAmount,
      totalCredit: 0,
      currency:    account.currency,
      status:      'pending',
      description: description || null
    }, { transaction: t });

    const entry = await LedgerEntry.create({
      transactionId: txn.id,
      accountId:     account.id,
      amount:        parsedAmount,
      direction:     'DEBIT',
      status:        'pending',
      fingerprint:   null
    }, { transaction: t });

    const fingerprint = signFingerprint({
      id:          entry.id,
      amount:      parsedAmount,
      direction:   'DEBIT',
      status:      'completed',
      old_balance: oldBalance,
      new_balance: newBalance
    });

    await entry.update({ status: 'completed', fingerprint }, { transaction: t });
    await txn.update({ status: 'completed' }, { transaction: t });

    await t.commit();

    return successResponse(res, 200, 'Withdrawal successful', {
      transactionRef: txn.referenceNumber,
      accountSN:      account.sn,
      amount:         parsedAmount,
      oldBalance,
      newBalance
    });
  } catch (err) {
    await t.rollback();
    console.error('withdraw error:', err);
    return errorResponse(res, 500, 'Withdrawal failed', err);
  }
};

module.exports = { createWallet, getWallet, deposit, withdraw };
