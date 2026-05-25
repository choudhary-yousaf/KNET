/**
 * KNET Payment Routes
 * Express routes for payment initiation and callback handling
 */

import express from 'express';
import { initiatePayment, validateCallback, getResponseCodeMeaning } from './payment-client.js';

const router = express.Router();

/**
 * POST /api/knet/initiate-payment
 * Start a KNET payment process
 *
 * Request body:
 * {
 *   "orderId": "order-123",
 *   "amount": "100.000",
 *   "customerEmail": "customer@example.com",
 *   "customerName": "John Doe",
 *   "productDescription": "Flower Delivery",
 *   "deliveryZone": "AlFahidi"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "trackId": "ABC123...",
 *   "paymentUrl": "https://kpaytest.com.kw/...",
 *   "orderId": "order-123"
 * }
 */
router.post('/initiate-payment', async (req, res) => {
	try {
		// Get configuration from environment
		const encryptionKey = process.env.KNET_ENCRYPTION_KEY;
		const terminalId = process.env.KNET_TERMINAL_ID;
		const terminalPassword = process.env.KNET_TERMINAL_PASSWORD;
		const responseUrl = process.env.KNET_CALLBACK_URL;
		const errorUrl = process.env.KNET_ERROR_URL;
		const mode = process.env.KNET_MODE || 'test';

		// Validate environment is configured
		if (!encryptionKey || !terminalId || !terminalPassword || !responseUrl || !errorUrl) {
			return res.status(500).json({
				success: false,
				error: 'KNET configuration incomplete. Check environment variables.'
			});
		}

		// Validate request parameters
		const { orderId, amount, customerEmail, customerName, productDescription, deliveryZone } =
			req.body;

		if (!orderId || !amount) {
			return res.status(400).json({
				success: false,
				error: 'Missing required fields: orderId, amount'
			});
		}

		// Validate amount is a valid number
		const parsedAmount = parseFloat(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) {
			return res.status(400).json({
				success: false,
				error: 'Invalid amount: must be a positive number'
			});
		}

		// Initiate KNET payment
		const paymentRequest = initiatePayment(
			{
				amount: parsedAmount,
				terminalId,
				terminalPassword,
				responseUrl,
				errorUrl,
				udf1: orderId, // Order ID in UDF1
				udf2: customerEmail || '', // Customer email in UDF2
				udf3: productDescription || '', // Product description in UDF3
				udf4: deliveryZone || '', // Delivery zone in UDF4
				udf5: customerName || '' // Customer name in UDF5
			},
			encryptionKey,
			mode
		);

		// Store payment request in database (for later validation)
		// TODO: Update this to use actual database (Supabase)
		console.log(`[KNET] Payment initiated: ${paymentRequest.trackId} for order ${orderId}`);

		return res.json({
			success: true,
			trackId: paymentRequest.trackId,
			paymentUrl: paymentRequest.paymentUrl,
			orderId: orderId,
			amount: parsedAmount,
			mode: mode
		});
	} catch (error) {
		console.error('[KNET] Payment initiation error:', error.message);
		return res.status(500).json({
			success: false,
			error: error.message || 'Payment initiation failed'
		});
	}
});

/**
 * GET /api/knet/initiate-payment
 * Helpful response for manual browser testing
 */
router.get('/initiate-payment', (_req, res) => {
	return res.status(405).json({
		success: false,
		error: 'Use POST /api/knet/initiate-payment with a JSON body'
	});
});

/**
 * POST /api/knet/callback
 * Receive KNET payment response
 *
 * KNET POSTs encrypted response here
 * Body: Raw encrypted hex string
 *
 * Response: KNET expects HTML with REDIRECT= parameter
 */
router.post('/callback', express.text({ type: '*/*' }), async (req, res) => {
	try {
		// Get configuration from environment
		const encryptionKey = process.env.KNET_ENCRYPTION_KEY;

		if (!encryptionKey) {
			console.error('[KNET] Callback: encryption key not configured');
			return res.status(500).send('Error: Server misconfiguration');
		}

		// Get encrypted response from request body
		const encryptedResponse = req.body || '';

		if (!encryptedResponse) {
			console.error('[KNET] Callback: no response data received');
			return res.status(400).send('Error: No payment data received');
		}

		// Decrypt and validate KNET response
		const callbackResult = validateCallback(encryptedResponse, encryptionKey);

		if (!callbackResult.valid) {
			console.error('[KNET] Callback: validation failed', callbackResult.error || 'Unknown');
			return res.status(400).send('Error: Invalid payment response');
		}

		const { response } = callbackResult;
		const trackId = response.trackid || 'UNKNOWN';
		const orderId = response.udf1 || 'UNKNOWN';
		const responseCode = response.response || 'UNKNOWN';

		console.log(
			`[KNET] Callback received: trackId=${trackId}, orderId=${orderId}, code=${responseCode}`
		);

		// Check if payment was successful
		if (responseCode === '000') {
			console.log(
				`[KNET] Payment successful: ${trackId} (Auth: ${response.auth}, RRN: ${response.rrn})`
			);

			// TODO: Update order status in Shopify/Supabase
			// TODO: Mark payment as complete

			// Return success redirect
			const successUrl = `https://lilyserve.com/order-success?trackId=${trackId}&orderId=${orderId}`;
			return res.send(`REDIRECT=${successUrl}`);
		} else {
			// Payment failed
			const codeMeaning = getResponseCodeMeaning(responseCode);
			console.log(`[KNET] Payment failed: ${trackId} - Code ${responseCode} (${codeMeaning})`);

			// TODO: Update order status to failed

			// Return error redirect
			const errorUrl = `https://lilyserve.com/order-failed?trackId=${trackId}&orderId=${orderId}&error=${encodeURIComponent(codeMeaning)}`;
			return res.send(`REDIRECT=${errorUrl}`);
		}
	} catch (error) {
		console.error('[KNET] Callback processing error:', error.message);
		return res.status(500).send('Error: Payment processing failed');
	}
});

/**
 * GET /api/knet/status
 * Check payment status (optional, for polling)
 *
 * Query params: trackId
 */
router.get('/status', async (req, res) => {
	try {
		const trackId = req.query.trackId || '';

		if (!trackId) {
			return res.status(400).json({
				success: false,
				error: 'Missing trackId parameter'
			});
		}

		// TODO: Query database for payment status
		// For now, return placeholder

		return res.json({
			success: true,
			trackId: trackId,
			status: 'pending',
			message: 'Database integration needed'
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			error: error.message || 'Status check failed'
		});
	}
});

/**
 * POST /api/knet/test-encryption (DEV ONLY)
 * Test encryption/decryption without real KNET transaction
 * Only available in test mode
 */
router.post('/test-encryption', async (req, res) => {
	try {
		if (process.env.KNET_MODE !== 'test') {
			return res.status(403).json({
				success: false,
				error: 'Test endpoint only available in test mode'
			});
		}

		const encryptionKey = process.env.KNET_ENCRYPTION_KEY;

		if (!encryptionKey) {
			return res.status(500).json({
				success: false,
				error: 'Encryption key not configured'
			});
		}

		const testString =
			req.body?.testString || 'amt=100.000&action=1&trackid=test123&currencycode=414';

		const { encryptAES, decryptAES } = await import('./encryption.js');

		const encrypted = encryptAES(testString, encryptionKey);
		const decrypted = decryptAES(encrypted, encryptionKey);

		return res.json({
			success: true,
			original: testString,
			encrypted: encrypted.substring(0, 100) + '...',
			decrypted: decrypted,
			matchesOriginal: decrypted === testString
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			error: error.message || 'Encryption test failed'
		});
	}
});

export default router;
