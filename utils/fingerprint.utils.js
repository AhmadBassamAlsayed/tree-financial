const jwt = require('jsonwebtoken');

const secret = () => {
  if (!process.env.FINGERPRINT_SECRET) throw new Error('FINGERPRINT_SECRET is not set');
  return process.env.FINGERPRINT_SECRET;
};

/**
 * Signs a fingerprint token for a ledger entry.
 * @param {{ id: number, amount: number, direction: string, status: string, old_balance: number, new_balance: number }} payload
 * @returns {string} signed JWT
 */
const signFingerprint = (payload) => {
  return jwt.sign(payload, secret(), { algorithm: 'HS256' });
};

/**
 * Verifies and decodes a fingerprint token.
 * Throws if the token is invalid or tampered with.
 * @param {string} token
 * @returns {{ id: number, amount: number, direction: string, status: string, old_balance: number, new_balance: number }}
 */
const verifyFingerprint = (token) => {
  return jwt.verify(token, secret(), { algorithms: ['HS256'] });
};

module.exports = { signFingerprint, verifyFingerprint };
