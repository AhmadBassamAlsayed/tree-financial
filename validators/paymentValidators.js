const { body } = require('express-validator');

const splitPaymentRules = [
  body('debits')
    .isArray({ min: 1 }).withMessage('debits must be a non-empty array'),
  body('debits.*.sn')
    .isLength({ min: 20, max: 20 }).withMessage('each debit SN must be exactly 20 digits')
    .isNumeric().withMessage('each debit SN must be numeric'),
  body('debits.*.amount')
    .isFloat({ gt: 0 }).withMessage('each debit amount must be a positive number'),

  body('credits')
    .isArray({ min: 1 }).withMessage('credits must be a non-empty array'),
  body('credits.*.sn')
    .isLength({ min: 20, max: 20 }).withMessage('each credit SN must be exactly 20 digits')
    .isNumeric().withMessage('each credit SN must be numeric'),
  body('credits.*.amount')
    .isFloat({ gt: 0 }).withMessage('each credit amount must be a positive number'),

  body('description')
    .optional()
    .isString().isLength({ max: 500 }).withMessage('description must be under 500 characters'),

  body('currency')
    .optional()
    .isString().isLength({ min: 2, max: 10 }).withMessage('currency must be 2–10 characters')
];

module.exports = { splitPaymentRules };
