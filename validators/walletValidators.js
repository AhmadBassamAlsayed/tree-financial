const { body, param } = require('express-validator');

const createWalletRules = [
  body('type')
    .isIn(['user', 'shop'])
    .withMessage('type must be "user" or "shop"'),
  body('userId')
    .if(body('type').equals('user'))
    .notEmpty().withMessage('userId is required for user wallets')
    .isInt({ min: 1 }).withMessage('userId must be a positive integer'),
  body('shopId')
    .if(body('type').equals('shop'))
    .notEmpty().withMessage('shopId is required for shop wallets')
    .isInt({ min: 1 }).withMessage('shopId must be a positive integer'),
  body('currency')
    .optional()
    .isString().isLength({ min: 2, max: 10 }).withMessage('currency must be 2–10 characters')
];

const depositWithdrawRules = [
  param('sn')
    .isLength({ min: 20, max: 20 }).withMessage('SN must be exactly 20 digits')
    .isNumeric().withMessage('SN must be numeric'),
  body('amount')
    .isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
  body('description')
    .optional()
    .isString().isLength({ max: 500 }).withMessage('description must be under 500 characters')
];

module.exports = { createWalletRules, depositWithdrawRules };
