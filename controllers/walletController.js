const { sequelize } = require('../config/database');
const { Account, Transaction, LedgerEntry } = require('../models/Index');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { generateUniqueSN } = require('../utils/sn.utils');
const { getBalance, getBalances, canDebit } = require('../utils/balance.utils');
const { signFingerprint } = require('../utils/fingerprint.utils');
const { isShopOwner } = require('../utils/shopsClient');
const crypto = require('crypto');

const getShopWallets = async (req,res)=>{
  try {
    const shopId=req.params.shopId

    let authorized=false;
    try {
      authorized = await isShopOwner(shopId, req.userId);
    } catch {
      return errorResponse(res, 503, 'Could not verify shop ownership — shops service unavailable');
    }
    if (!authorized) return errorResponse(res, 403, 'Forbidden: you do not own this shop');
    
  
    const accounts = await Account.findAll({ where: { shopId, status: ['active', 'frozen'] } });
    if (!accounts.length) return errorResponse(res, 404, 'No wallets found');

    const balanceMap = await getBalances(accounts.map(a => a.id));
    const result = accounts.map(a => ({ ...a.toJSON(), balance: balanceMap.get(a.id) ?? 0 }));

    return successResponse(res, 200, 'Wallets fetched', result);
  } catch (err) {
    console.error('getWallet error:', err);
    return errorResponse(res, 500, 'Failed to fetch wallet', err);
  }
}

const getPersonalWallets = async (req,res)=>{
  try {
    const accounts = await Account.findAll({ where: { userId: req.userId, status: ['active', 'frozen'] } });
    if (!accounts.length) return errorResponse(res, 404, 'No wallets found');

    const balanceMap = await getBalances(accounts.map(a => a.id));
    const result = accounts.map(a => ({ ...a.toJSON(), balance: balanceMap.get(a.id) ?? 0 }));

    return successResponse(res, 200, 'Wallets fetched', result);
  } catch (err) {
    console.error('getWallet error:', err);
    return errorResponse(res, 500, 'Failed to fetch wallet', err);
  }  
}

// POST /api/wallets
const createWallet = async (req, res) => {
  try {
    const { type, userId, shopId, currency } = req.body;

    const whereClause = type === 'user'
      ? { type: 'user', userId, currency }
      : { type: 'shop', shopId, currency };

    const existing = await Account.findOne({ where: whereClause });
    if (existing) {
      const msg = existing.status === 'inactive'
        ? `A closed ${currency} wallet already exists. Contact support to reopen it.`
        : `You already have a ${existing.status} ${currency} wallet.`;
      return errorResponse(res, 409, msg);
    }

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

    // Ownership check: user wallet → must be the wallet owner
    //                  shop wallet  → must be the shop's owner (verified via shops service)
    let authorized = false;
    if (account.type === 'user') {
      authorized = req.userId === account.userId;
    } else {
      try {
        authorized = await isShopOwner(account.shopId, req.userId);
      } catch {
        return errorResponse(res, 503, 'Could not verify shop ownership — shops service unavailable');
      }
    }

    if (!authorized) return errorResponse(res, 403, 'Forbidden: you do not own this wallet');

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

module.exports = { createWallet, getWallet, deposit, withdraw,getShopWallets,getPersonalWallets };
