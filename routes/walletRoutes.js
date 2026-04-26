const router = require('express').Router();
const { createWallet,getPersonalWallets, getWallet,getShopWallets, deposit, withdraw } = require('../controllers/walletController');
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
 *     description: |
 *       Creates a new wallet account for a user or a shop. Only one wallet per
 *       owner+currency combination is permitted regardless of status. If a wallet
 *       already exists in any status the request is rejected with 409.
 *
 *       Every request to this service must include a valid JWT Bearer token.
 *       The token is validated against the SSO service before the handler runs.
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [user, shop]
 *                 description: Owner type of the wallet.
 *                 example: user
 *               userId:
 *                 type: integer
 *                 minimum: 1
 *                 description: Required when `type` is "user". Must be a positive integer.
 *                 example: 42
 *               shopId:
 *                 type: integer
 *                 minimum: 1
 *                 description: Required when `type` is "shop". Must be a positive integer.
 *                 example: 7
 *               currency:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 10
 *                 default: SYP
 *                 description: ISO currency code. Defaults to SYP when omitted.
 *                 example: SYP
 *           examples:
 *             userWallet:
 *               summary: Create a user wallet
 *               value:
 *                 type: user
 *                 userId: 42
 *                 currency: SYP
 *             shopWallet:
 *               summary: Create a shop wallet
 *               value:
 *                 type: shop
 *                 shopId: 7
 *                 currency: USD
 *     responses:
 *       201:
 *         description: Wallet created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Wallet created
 *       400:
 *         description: >
 *           Validation failed. One or more request body fields did not pass
 *           validation rules (e.g. missing `type`, non-positive `userId`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             example:
 *               success: false
 *               message: Validation failed
 *               errors:
 *                 - field: type
 *                   message: type must be "user" or "shop"
 *                 - field: userId
 *                   message: userId is required for user wallets
 *       401:
 *         description: >
 *           Missing, invalid, expired, or revoked Bearer token. Also returned
 *           when the SSO service reports the user does not exist.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 summary: No Authorization header supplied
 *                 value:
 *                   success: false
 *                   message: Access token is required
 *                   error: null
 *               invalidToken:
 *                 summary: Token failed SSO validation
 *                 value:
 *                   success: false
 *                   message: Invalid or expired token
 *                   error: null
 *               userNotFound:
 *                 summary: User no longer exists in SSO
 *                 value:
 *                   success: false
 *                   message: User not found
 *                   error: null
 *       403:
 *         description: The authenticated account is deleted or banned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               deleted:
 *                 summary: Account deleted
 *                 value:
 *                   success: false
 *                   message: Account has been deleted
 *                   error: null
 *               banned:
 *                 summary: Account banned
 *                 value:
 *                   success: false
 *                   message: "Account is banned: Violation of terms"
 *                   error: null
 *       409:
 *         description: >
 *           A wallet for this owner+currency combination already exists.
 *           The message varies by the existing wallet's status:
 *           active/frozen wallets return "You already have a {status} {currency} wallet.";
 *           inactive (closed) wallets return "A closed {currency} wallet already exists.
 *           Contact support to reopen it."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               activeConflict:
 *                 summary: Existing active wallet
 *                 value:
 *                   success: false
 *                   message: You already have a active SYP wallet.
 *                   error: null
 *               frozenConflict:
 *                 summary: Existing frozen wallet
 *                 value:
 *                   success: false
 *                   message: You already have a frozen SYP wallet.
 *                   error: null
 *               inactiveConflict:
 *                 summary: Existing closed wallet
 *                 value:
 *                   success: false
 *                   message: A closed SYP wallet already exists. Contact support to reopen it.
 *                   error: null
 *       500:
 *         description: Unexpected server error while creating the wallet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Failed to create wallet
 *               error: "SequelizeConnectionError: ..."
 *       503:
 *         description: SSO authentication service is unreachable or timed out.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Authentication service unavailable
 *               error: null
 */
router.post('/', createWalletRules, validate, createWallet);

/**
 * @swagger
 * /api/wallets/{sn}:
 *   get:
 *     summary: Get wallet info and current balance
 *     description: |
 *       Returns full account details plus the current computed balance for
 *       a wallet identified by its 20-digit serial number.
 *
 *       Ownership is enforced:
 *       - **User wallet** — the authenticated user's `userId` must match
 *         `account.userId`.
 *       - **Shop wallet** — the authenticated user must be the owner of the
 *         shop, verified via the Shops service.
 *
 *       Returns 503 if the Shops service cannot be reached during a shop
 *       wallet ownership check.
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sn
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 20
 *           maxLength: 20
 *           pattern: '^\d{20}$'
 *         description: 20-digit numeric wallet serial number.
 *         example: "12345678901234567890"
 *     responses:
 *       200:
 *         description: Wallet details including computed balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Wallet fetched
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 value:
 *                   success: false
 *                   message: Access token is required
 *                   error: null
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: Invalid or expired token
 *                   error: null
 *       403:
 *         description: >
 *           The authenticated user does not own this wallet, or the account
 *           is deleted/banned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notOwner:
 *                 summary: Requester does not own this wallet
 *                 value:
 *                   success: false
 *                   message: Forbidden: you do not own this wallet
 *                   error: null
 *               deleted:
 *                 summary: Account deleted
 *                 value:
 *                   success: false
 *                   message: Account has been deleted
 *                   error: null
 *       404:
 *         description: No wallet with the given serial number exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Wallet not found
 *               error: null
 *       500:
 *         description: Unexpected server error while fetching the wallet.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Failed to fetch wallet
 *               error: "SequelizeConnectionError: ..."
 *       503:
 *         description: >
 *           Either the SSO service (auth) or the Shops service (shop wallet
 *           ownership check) is unreachable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               authUnavailable:
 *                 summary: SSO service unreachable
 *                 value:
 *                   success: false
 *                   message: Authentication service unavailable
 *                   error: null
 *               shopsUnavailable:
 *                 summary: Shops service unreachable during ownership check
 *                 value:
 *                   success: false
 *                   message: Could not verify shop ownership — shops service unavailable
 *                   error: null
 */
router.get('/:sn', getWallet);

/**
 * @swagger
 * /api/wallets/mine/{shopId}:
 *   get:
 *     summary: Get all active and frozen wallets for a shop
 *     description: |
 *       Returns every wallet belonging to the specified shop that has a status
 *       of `active` or `frozen` (inactive/closed wallets are excluded).
 *       Each account object is augmented with a `balance` field computed from
 *       the ledger.
 *
 *       Shop ownership is verified against the Shops service. The authenticated
 *       user must be the owner of the shop.
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the shop whose wallets should be returned.
 *         example: 7
 *     responses:
 *       200:
 *         description: List of wallets for the shop with their current balances.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Wallets fetched
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 value:
 *                   success: false
 *                   message: Access token is required
 *                   error: null
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: Invalid or expired token
 *                   error: null
 *       403:
 *         description: >
 *           The authenticated user does not own the specified shop, or the
 *           account is deleted/banned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               notShopOwner:
 *                 summary: User does not own this shop
 *                 value:
 *                   success: false
 *                   message: Forbidden: you do not own this shop
 *                   error: null
 *               deleted:
 *                 summary: Account deleted
 *                 value:
 *                   success: false
 *                   message: Account has been deleted
 *                   error: null
 *       404:
 *         description: The shop has no active or frozen wallets.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: No wallets found
 *               error: null
 *       500:
 *         description: Unexpected server error while fetching shop wallets.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Failed to fetch wallet
 *               error: "SequelizeConnectionError: ..."
 *       503:
 *         description: >
 *           Either the SSO service (auth) or the Shops service (ownership
 *           check) is unreachable.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               authUnavailable:
 *                 summary: SSO service unreachable
 *                 value:
 *                   success: false
 *                   message: Authentication service unavailable
 *                   error: null
 *               shopsUnavailable:
 *                 summary: Shops service unreachable during ownership check
 *                 value:
 *                   success: false
 *                   message: Could not verify shop ownership — shops service unavailable
 *                   error: null
 */
router.get('/mine/:shopId',getShopWallets)

/**
 * @swagger
 * /api/wallets/mine:
 *   get:
 *     summary: Get all active and frozen wallets for the authenticated user
 *     description: |
 *       Returns every wallet owned by the currently authenticated user that
 *       has a status of `active` or `frozen`. Inactive (closed) wallets are
 *       excluded. Each account object is augmented with a `balance` field
 *       computed from the ledger.
 *
 *       The user identity is derived from the validated JWT — no extra
 *       parameters are required.
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of the user's wallets with their current balances.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Wallets fetched
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 value:
 *                   success: false
 *                   message: Access token is required
 *                   error: null
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: Invalid or expired token
 *                   error: null
 *       403:
 *         description: The authenticated account is deleted or banned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               deleted:
 *                 value:
 *                   success: false
 *                   message: Account has been deleted
 *                   error: null
 *               banned:
 *                 value:
 *                   success: false
 *                   message: "Account is banned: Violation of terms"
 *                   error: null
 *       404:
 *         description: The authenticated user has no active or frozen wallets.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: No wallets found
 *               error: null
 *       500:
 *         description: Unexpected server error while fetching the user's wallets.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Failed to fetch wallet
 *               error: "SequelizeConnectionError: ..."
 *       503:
 *         description: SSO authentication service is unreachable or timed out.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Authentication service unavailable
 *               error: null
 */
router.get('/mine',getPersonalWallets)

/**
 * @swagger
 * /api/wallets/{sn}/deposit:
 *   post:
 *     summary: Dummy deposit — credit an amount into a wallet
 *     description: |
 *       Credits the specified amount into the wallet identified by `sn`.
 *       The wallet must be in `active` status; `frozen` and `inactive` wallets
 *       are rejected with 400.
 *
 *       The operation is wrapped in a database transaction with a row-level
 *       lock to prevent race conditions. A `Transaction` record and a
 *       `LedgerEntry` (CREDIT direction) are created and immediately completed.
 *       A tamper-evident fingerprint is signed onto the ledger entry.
 *
 *       The response includes the transaction reference, old balance, and new
 *       balance so callers can confirm the exact movement.
 *
 *       **Validation rules for `sn`:** exactly 20 numeric digits.
 *       **Validation rules for `amount`:** positive float, greater than 0.
 *       **Validation rules for `description`:** optional string, max 500 chars.
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sn
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 20
 *           maxLength: 20
 *           pattern: '^\d{20}$'
 *         description: 20-digit numeric wallet serial number.
 *         example: "12345678901234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 format: double
 *                 exclusiveMinimum: 0
 *                 description: Amount to credit. Must be a positive number.
 *                 example: 1000
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional human-readable note for this transaction.
 *                 example: Top-up
 *     responses:
 *       200:
 *         description: Deposit completed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Deposit successful
 *       400:
 *         description: >
 *           Either request validation failed (invalid `sn`, non-positive `amount`)
 *           or the wallet is not in `active` status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               walletFrozen:
 *                 summary: Wallet is frozen
 *                 value:
 *                   success: false
 *                   message: Wallet is frozen
 *                   error: null
 *               walletInactive:
 *                 summary: Wallet is inactive (closed)
 *                 value:
 *                   success: false
 *                   message: Wallet is inactive
 *                   error: null
 *               validationFailed:
 *                 summary: Validation error
 *                 value:
 *                   success: false
 *                   message: Validation failed
 *                   errors:
 *                     - field: amount
 *                       message: amount must be a positive number
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 value:
 *                   success: false
 *                   message: Access token is required
 *                   error: null
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: Invalid or expired token
 *                   error: null
 *       403:
 *         description: The authenticated account is deleted or banned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Account has been deleted
 *               error: null
 *       404:
 *         description: No wallet with the given serial number exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Wallet not found
 *               error: null
 *       500:
 *         description: Unexpected server error; the database transaction was rolled back.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Deposit failed
 *               error: "SequelizeConnectionError: ..."
 *       503:
 *         description: SSO authentication service is unreachable or timed out.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Authentication service unavailable
 *               error: null
 */
router.post('/:sn/deposit', depositWithdrawRules, validate, deposit);

/**
 * @swagger
 * /api/wallets/{sn}/withdraw:
 *   post:
 *     summary: Dummy withdrawal — debit an amount from a wallet
 *     description: |
 *       Debits the specified amount from the wallet identified by `sn`.
 *       The wallet must be in `active` status; `frozen` and `inactive` wallets
 *       are rejected with 400. Insufficient balance also results in a 400.
 *
 *       The operation is wrapped in a database transaction with a row-level
 *       lock to prevent race conditions. A `Transaction` record and a
 *       `LedgerEntry` (DEBIT direction) are created and immediately completed.
 *       A tamper-evident fingerprint is signed onto the ledger entry.
 *
 *       The response includes the transaction reference, old balance, and new
 *       balance so callers can confirm the exact movement.
 *
 *       **Validation rules for `sn`:** exactly 20 numeric digits.
 *       **Validation rules for `amount`:** positive float, greater than 0.
 *       **Validation rules for `description`:** optional string, max 500 chars.
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sn
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 20
 *           maxLength: 20
 *           pattern: '^\d{20}$'
 *         description: 20-digit numeric wallet serial number.
 *         example: "12345678901234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 format: double
 *                 exclusiveMinimum: 0
 *                 description: Amount to debit. Must be a positive number.
 *                 example: 500
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional human-readable note for this transaction.
 *                 example: Purchase
 *     responses:
 *       200:
 *         description: Withdrawal completed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: Withdrawal successful
 *       400:
 *         description: >
 *           Request validation failed, wallet is not `active`, or available
 *           balance is less than the requested withdrawal amount.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               walletFrozen:
 *                 summary: Wallet is frozen
 *                 value:
 *                   success: false
 *                   message: Wallet is frozen
 *                   error: null
 *               walletInactive:
 *                 summary: Wallet is inactive (closed)
 *                 value:
 *                   success: false
 *                   message: Wallet is inactive
 *                   error: null
 *               insufficientBalance:
 *                 summary: Not enough balance to cover the withdrawal
 *                 value:
 *                   success: false
 *                   message: "Insufficient balance. Available: 250"
 *                   error: null
 *               validationFailed:
 *                 summary: Validation error
 *                 value:
 *                   success: false
 *                   message: Validation failed
 *                   errors:
 *                     - field: amount
 *                       message: amount must be a positive number
 *       401:
 *         description: Missing, invalid, or expired Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingToken:
 *                 value:
 *                   success: false
 *                   message: Access token is required
 *                   error: null
 *               invalidToken:
 *                 value:
 *                   success: false
 *                   message: Invalid or expired token
 *                   error: null
 *       403:
 *         description: The authenticated account is deleted or banned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Account has been deleted
 *               error: null
 *       404:
 *         description: No wallet with the given serial number exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Wallet not found
 *               error: null
 *       500:
 *         description: Unexpected server error; the database transaction was rolled back.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Withdrawal failed
 *               error: "SequelizeConnectionError: ..."
 *       503:
 *         description: SSO authentication service is unreachable or timed out.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Authentication service unavailable
 *               error: null
 */
router.post('/:sn/withdraw', depositWithdrawRules, validate, withdraw);

module.exports = router;
