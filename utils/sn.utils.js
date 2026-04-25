const crypto = require('crypto');
const { Account } = require('../models/Index');

/**
 * Generates a unique 20-digit serial number for a wallet.
 * Retries on the rare collision.
 * @returns {Promise<string>}
 */
const generateUniqueSN = async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const first = crypto.randomInt(1, 10).toString();
    let rest = '';
    for (let i = 0; i < 19; i++) rest += crypto.randomInt(0, 10).toString();
    const sn = first + rest;

    const existing = await Account.findOne({ where: { sn } });
    if (!existing) return sn;
  }
  throw new Error('Failed to generate a unique SN after 10 attempts');
};

module.exports = { generateUniqueSN };
