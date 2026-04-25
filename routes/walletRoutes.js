const router = require('express').Router();
const { createWallet, getWallet, deposit, withdraw } = require('../controllers/walletController');
const { createWalletRules, depositWithdrawRules } = require('../validators/walletValidators');
const validate = require('../middlewares/validate');

/**
 * @swagger
 * tags:
 *   name: Wallets
 *   description: Wallet management and dummy deposit/withdraw
 */

/**
 * @swagger
 * /api/wallets:
 *   post:
 *     summary: Create a new wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [user, shop]
 *               userId:
 *                 type: integer
 *                 description: Required when type is "user"
 *               shopId:
 *                 type: integer
 *                 description: Required when type is "shop"
 *               currency:
 *                 type: string
 *                 default: SYP
 *     responses:
 *       201:
 *         description: Wallet created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.post('/', createWalletRules, validate, createWallet);

/**
 * @swagger
 * /api/wallets/{sn}:
 *   get:
 *     summary: Get wallet info and current balance
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sn
 *         required: true
 *         schema:
 *           type: string
 *         description: 20-digit wallet serial number
 *     responses:
 *       200:
 *         description: Wallet details including balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Wallet not found
 */
router.get('/:sn', getWallet);

/**
 * @swagger
 * /api/wallets/{sn}/deposit:
 *   post:
 *     summary: Dummy deposit — credit an amount into a wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sn
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 format: double
 *                 example: 1000
 *               description:
 *                 type: string
 *                 example: "Top-up"
 *     responses:
 *       200:
 *         description: Deposit successful
 *       400:
 *         description: Wallet inactive/frozen
 *       404:
 *         description: Wallet not found
 */
router.post('/:sn/deposit', depositWithdrawRules, validate, deposit);

/**
 * @swagger
 * /api/wallets/{sn}/withdraw:
 *   post:
 *     summary: Dummy withdrawal — debit an amount from a wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sn
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 format: double
 *                 example: 500
 *               description:
 *                 type: string
 *                 example: "Purchase"
 *     responses:
 *       200:
 *         description: Withdrawal successful
 *       400:
 *         description: Insufficient balance or wallet inactive
 *       404:
 *         description: Wallet not found
 */
router.post('/:sn/withdraw', depositWithdrawRules, validate, withdraw);

module.exports = router;
