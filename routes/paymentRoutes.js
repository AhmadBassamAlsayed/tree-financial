const router = require('express').Router();
const { splitPayment } = require('../controllers/paymentController');
const { splitPaymentRules } = require('../validators/paymentValidators');
const validate = require('../middlewares/validate');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Split and multi-wallet payments
 */

/**
 * @swagger
 * /api/payments/split:
 *   post:
 *     summary: Split payment — debit N wallets and credit M wallets atomically
 *     description: |
 *       Executes a multi-party payment in a single atomic SQL transaction.
 *       - sum(debits.amount) MUST equal sum(credits.amount)
 *       - All debit wallets must have sufficient balance
 *       - Wallets are locked in SN order to prevent deadlocks
 *       - A single wallet may appear in both debits and credits
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [debits, credits]
 *             properties:
 *               debits:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [sn, amount]
 *                   properties:
 *                     sn:
 *                       type: string
 *                       example: "12345678901234567890"
 *                     amount:
 *                       type: number
 *                       format: double
 *                       example: 500
 *               credits:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [sn, amount]
 *                   properties:
 *                     sn:
 *                       type: string
 *                       example: "09876543210987654321"
 *                     amount:
 *                       type: number
 *                       format: double
 *                       example: 500
 *               description:
 *                 type: string
 *                 example: "Order #42 payment"
 *               currency:
 *                 type: string
 *                 example: "SYP"
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Imbalanced totals or insufficient balance
 *       404:
 *         description: One or more wallets not found
 */
router.post('/split', splitPaymentRules, validate, splitPayment);

module.exports = router;
