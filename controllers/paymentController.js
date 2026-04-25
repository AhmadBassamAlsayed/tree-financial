const { sequelize } = require('../config/database');
const { Account, Transaction, LedgerEntry } = require('../models/Index');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { getBalance, canDebit } = require('../utils/balance.utils');
const { signFingerprint } = require('../utils/fingerprint.utils');
const crypto = require('crypto');

// POST /api/payments/split
const splitPayment = async (req, res) => {
  const { debits, credits, description, currency } = req.body;

  // --- Pre-flight: totals must balance ---
  const totalDebit  = debits.reduce((s, d) => s + parseFloat(d.amount), 0);
  const totalCredit = credits.reduce((s, c) => s + parseFloat(c.amount), 0);

  // Compare with a small epsilon to handle float arithmetic drift
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    return errorResponse(res, 400,
      `Debit total (${totalDebit}) must equal credit total (${totalCredit})`);
  }

  const t = await sequelize.transaction();
  try {
    // --- Gather all SNs and resolve accounts ---
    const allSNs = [...new Set([...debits.map(d => d.sn), ...credits.map(c => c.sn)])];

    const accounts = await Account.findAll({
      where: { sn: allSNs },
      lock: t.LOCK.UPDATE,
      // Lock in consistent SN order to prevent deadlocks
      order: [['sn', 'ASC']],
      transaction: t
    });

    const accountMap = Object.fromEntries(accounts.map(a => [a.sn, a]));

    // Validate all wallets exist and are active
    for (const sn of allSNs) {
      if (!accountMap[sn]) {
        await t.rollback();
        return errorResponse(res, 404, `Wallet not found: ${sn}`);
      }
      if (accountMap[sn].status !== 'active') {
        await t.rollback();
        return errorResponse(res, 400, `Wallet ${sn} is ${accountMap[sn].status}`);
      }
    }

    // --- Pre-check balances for all debit accounts (under lock) ---
    const balanceCache = {};
    for (const { sn, amount } of debits) {
      const account = accountMap[sn];
      // Accumulate same-wallet debits for multi-debit-same-wallet scenarios
      if (balanceCache[sn] === undefined) {
        balanceCache[sn] = await getBalance(account.id, t);
      }
      balanceCache[sn] -= parseFloat(amount);
      if (balanceCache[sn] < 0) {
        await t.rollback();
        const available = balanceCache[sn] + parseFloat(amount);
        return errorResponse(res, 400,
          `Insufficient balance in wallet ${sn}. Available: ${available}, required: ${amount}`);
      }
    }

    // Pre-compute credit new balances too
    const creditBalanceCache = {};
    for (const { sn, amount } of credits) {
      const account = accountMap[sn];
      if (creditBalanceCache[sn] === undefined) {
        // If a wallet appears in both debits and credits, start from post-debit balance
        creditBalanceCache[sn] = balanceCache[sn] !== undefined
          ? balanceCache[sn]
          : await getBalance(account.id, t);
      }
      creditBalanceCache[sn] += parseFloat(amount);
    }

    // --- Create the parent transaction record ---
    const txnType = debits.length === 1 && credits.length === 1 ? 'TRANSFER' : 'SPLIT_PAYMENT';

    const txn = await Transaction.create({
      referenceNumber: `TXN-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      type:        txnType,
      totalDebit,
      totalCredit,
      currency:    currency || accounts[0].currency,
      status:      'pending',
      description: description || null
    }, { transaction: t });

    // --- Write DEBIT entries ---
    // Track running balance per account during this transaction
    const runningBalance = {};

    for (const { sn, amount } of debits) {
      const account = accountMap[sn];
      const parsedAmount = parseFloat(amount);

      if (runningBalance[sn] === undefined) {
        // Start from actual DB balance (already fetched under lock)
        runningBalance[sn] = balanceCache[sn] + debits
          .filter(d => d.sn === sn)
          .reduce((s, d) => s + parseFloat(d.amount), 0);
      }

      const oldBalance = runningBalance[sn];
      const newBalance = oldBalance - parsedAmount;
      runningBalance[sn] = newBalance;

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
    }

    // --- Write CREDIT entries ---
    const creditRunning = {};

    for (const { sn, amount } of credits) {
      const account = accountMap[sn];
      const parsedAmount = parseFloat(amount);

      if (creditRunning[sn] === undefined) {
        creditRunning[sn] = creditBalanceCache[sn] - credits
          .filter(c => c.sn === sn)
          .reduce((s, c) => s + parseFloat(c.amount), 0);
      }

      const oldBalance = creditRunning[sn];
      const newBalance = oldBalance + parsedAmount;
      creditRunning[sn] = newBalance;

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
    }

    await txn.update({ status: 'completed' }, { transaction: t });
    await t.commit();

    return successResponse(res, 200, 'Payment processed', {
      transactionRef: txn.referenceNumber,
      type:           txnType,
      totalDebit,
      totalCredit,
      debitCount:     debits.length,
      creditCount:    credits.length
    });
  } catch (err) {
    await t.rollback();
    console.error('splitPayment error:', err);
    return errorResponse(res, 500, 'Payment failed', err);
  }
};

module.exports = { splitPayment };
