const { sequelize } = require('../config/database');
const { Account, AccountHold, Transaction, LedgerEntry } = require('../models/Index');
const { getBalance, getAvailableBalance } = require('../utils/balance.utils');
const { signFingerprint } = require('../utils/fingerprint.utils');
const crypto = require('crypto');

const createHold = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { accountSN, amount, reference } = req.body;
    const parsedAmount = parseFloat(amount);

    const account = await Account.findOne({
      where: { sn: accountSN, status: 'active' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!account) {
      await t.rollback();
      return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
    }

    const available = await getAvailableBalance(account.id, t);
    if (available < parsedAmount) {
      await t.rollback();
      return res.status(400).json({
        error: 'INSUFFICIENT_BALANCE',
        message: `Available balance is less than hold amount`
      });
    }

    const hold = await AccountHold.create({
      accountId: account.id,
      amount: parsedAmount,
      status: 'active',
      reference: reference || 'pending-checkout'
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ holdId: hold.id });
  } catch (err) {
    await t.rollback();
    console.error('createHold error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

const captureHold = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { holdId } = req.params;
    const { shopAccountSN } = req.body;

    const hold = await AccountHold.findByPk(holdId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!hold) {
      await t.rollback();
      return res.status(404).json({ error: 'HOLD_NOT_FOUND' });
    }
    if (hold.status !== 'active') {
      await t.rollback();
      return res.status(400).json({ error: 'HOLD_NOT_ACTIVE', message: 'Hold is already captured or released' });
    }

    const shopAccount = await Account.findOne({
      where: { sn: shopAccountSN, status: 'active' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!shopAccount) {
      await t.rollback();
      return res.status(404).json({ error: 'SHOP_ACCOUNT_NOT_FOUND' });
    }

    const customerAccount = await Account.findByPk(hold.accountId, { transaction: t, lock: t.LOCK.UPDATE });
    const amount = parseFloat(hold.amount);

    const customerOldBalance = await getBalance(customerAccount.id, t);
    const customerNewBalance = customerOldBalance - amount;

    const shopOldBalance = await getBalance(shopAccount.id, t);
    const shopNewBalance = shopOldBalance + amount;

    const txn = await Transaction.create({
      referenceNumber: `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      type: 'TRANSFER',
      totalDebit: amount,
      totalCredit: amount,
      currency: customerAccount.currency,
      status: 'pending',
      description: `Hold capture for hold #${hold.id}`
    }, { transaction: t });

    const debitEntry = await LedgerEntry.create({
      transactionId: txn.id,
      accountId: customerAccount.id,
      amount,
      direction: 'DEBIT',
      status: 'pending',
      fingerprint: null
    }, { transaction: t });

    const debitFingerprint = signFingerprint({
      id: debitEntry.id,
      amount,
      direction: 'DEBIT',
      status: 'completed',
      old_balance: customerOldBalance,
      new_balance: customerNewBalance
    });
    await debitEntry.update({ status: 'completed', fingerprint: debitFingerprint }, { transaction: t });

    const creditEntry = await LedgerEntry.create({
      transactionId: txn.id,
      accountId: shopAccount.id,
      amount,
      direction: 'CREDIT',
      status: 'pending',
      fingerprint: null
    }, { transaction: t });

    const creditFingerprint = signFingerprint({
      id: creditEntry.id,
      amount,
      direction: 'CREDIT',
      status: 'completed',
      old_balance: shopOldBalance,
      new_balance: shopNewBalance
    });
    await creditEntry.update({ status: 'completed', fingerprint: creditFingerprint }, { transaction: t });

    await txn.update({ status: 'completed' }, { transaction: t });
    await hold.update({ status: 'captured' }, { transaction: t });

    await t.commit();
    return res.status(200).json({ holdId: hold.id, status: 'captured' });
  } catch (err) {
    await t.rollback();
    console.error('captureHold error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

const releaseHold = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { holdId } = req.params;

    const hold = await AccountHold.findByPk(holdId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!hold) {
      await t.rollback();
      return res.status(404).json({ error: 'HOLD_NOT_FOUND' });
    }
    if (hold.status !== 'active') {
      await t.rollback();
      return res.status(400).json({ error: 'HOLD_NOT_ACTIVE', message: 'Hold is already captured or released' });
    }

    await hold.update({ status: 'released' }, { transaction: t });
    await t.commit();
    return res.status(200).json({ holdId: hold.id, status: 'released' });
  } catch (err) {
    await t.rollback();
    console.error('releaseHold error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

const getHold = async (req, res) => {
  try {
    const hold = await AccountHold.findByPk(req.params.holdId);
    if (!hold) return res.status(404).json({ error: 'HOLD_NOT_FOUND' });
    return res.status(200).json({
      id: hold.id,
      accountId: hold.accountId,
      amount: hold.amount,
      status: hold.status,
      reference: hold.reference,
      createdAt: hold.createdAt
    });
  } catch (err) {
    console.error('getHold error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

const updateHoldReference = async (req, res) => {
  try {
    const { holdId } = req.params;
    const { reference } = req.body;

    const hold = await AccountHold.findByPk(holdId);
    if (!hold) return res.status(404).json({ error: 'HOLD_NOT_FOUND' });
    if (hold.status !== 'active') return res.status(400).json({ error: 'HOLD_NOT_ACTIVE' });

    await hold.update({ reference });
    return res.status(200).json({ holdId: hold.id, reference: hold.reference });
  } catch (err) {
    console.error('updateHoldReference error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

// Atomically checks balance and creates all holds in one transaction.
// Body: { userId, currency, holds: [{ amount, reference }] }
// Returns: { accountSN, holdIds: [...] } in same order as input holds array.
const createHoldsBatch = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { userId, currency, holds } = req.body;
    if (!userId || !currency || !Array.isArray(holds) || holds.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'userId, currency, and a non-empty holds array are required' });
    }

    const account = await Account.findOne({
      where: { userId: parseInt(userId), currency, status: 'active', type: 'user' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!account) {
      await t.rollback();
      return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
    }

    const totalAmount = holds.reduce((sum, h) => sum + parseFloat(h.amount), 0);
    const available = await getAvailableBalance(account.id, t);
    if (available < totalAmount) {
      await t.rollback();
      return res.status(400).json({ error: 'INSUFFICIENT_BALANCE', message: 'Available balance is less than total hold amount' });
    }

    const created = [];
    for (const h of holds) {
      const hold = await AccountHold.create({
        accountId: account.id,
        amount: parseFloat(h.amount),
        status: 'active',
        reference: h.reference || 'pending-checkout'
      }, { transaction: t });
      created.push(hold.id);
    }

    await t.commit();
    return res.status(201).json({ accountSN: account.sn, holdIds: created });
  } catch (err) {
    await t.rollback();
    console.error('createHoldsBatch error:', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

module.exports = { createHold, captureHold, releaseHold, getHold, updateHoldReference, createHoldsBatch };
