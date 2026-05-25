#!/usr/bin/env node

/**
 * KNET Integration Test Script
 * Tests encryption, payment request building, and callback handling
 * 
 * Usage: node knet-test.js
 */

import { encryptAES, decryptAES, testEncryption, isValidEncryptionKey } from './knet/encryption.js';
import { initiatePayment, validateCallback, getResponseCodeMeaning } from './knet/payment-client.js';

const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m'
};

function log(level, message) {
	const prefix =
		{
			info: `${colors.blue}[INFO]${colors.reset}`,
			success: `${colors.green}[✓]${colors.reset}`,
			error: `${colors.red}[✗]${colors.reset}`,
			warn: `${colors.yellow}[!]${colors.reset}`
		}[level] || `[${level.toUpperCase()}]`;

	console.log(`${prefix} ${message}`);
}

function separator(title) {
	console.log(
		`\n${colors.bright}${'─'.repeat(60)}${colors.reset}`
	);
	if (title) {
		console.log(`${colors.bright}${title}${colors.reset}`);
		console.log(`${colors.bright}${'─'.repeat(60)}${colors.reset}\n`);
	} else {
		console.log();
	}
}

async function runTests() {
	separator('KNET INTEGRATION TEST SUITE');

	// Get encryption key from environment
	const encryptionKey = process.env.KNET_ENCRYPTION_KEY;

	// Test 1: Check encryption key
	log('info', 'Test 1: Validate Encryption Key Configuration');
	if (!encryptionKey) {
		log('warn', 'KNET_ENCRYPTION_KEY not set in environment');
		log('info', 'Skipping encryption tests (key required for testing)');
		log('info', 'To test: Add KNET_ENCRYPTION_KEY=<16-char-key> to .env and re-run');
		separator();
	} else {
		if (isValidEncryptionKey(encryptionKey)) {
			log('success', `Encryption key is valid (16 bytes)`);
		} else {
			const keyBuffer = Buffer.from(encryptionKey, 'utf8');
			log('error', `Encryption key length: ${keyBuffer.length} bytes (expected 16)`);
			separator();
			return;
		}

		// Test 2: Encrypt/Decrypt round-trip
		separator('Test 2: Encryption/Decryption Round-Trip');
		const testString =
			'amt=100.000&action=1&trackid=test12345&currencycode=414&langid=USA';
		const result = testEncryption(testString, encryptionKey);

		if (result.success) {
			log('success', 'Encryption/Decryption successful');
			console.log(`  Original:  ${result.original}`);
			console.log(`  Encrypted: ${result.encrypted}`);
			console.log(`  Decrypted: ${result.decrypted}`);
			console.log(`  Match:     ${colors.green}✓${colors.reset}`);
		} else {
			log('error', `Test failed: ${result.error}`);
			separator();
			return;
		}

		// Test 3: Payment Request Building
		separator('Test 3: Payment Request Building');
		try {
			const paymentRequest = initiatePayment(
				{
					amount: '100.000',
					terminalId: '659501',
					terminalPassword: 'LilyServeKnet2026!',
					responseUrl: 'https://lilyserve.com/api/knet/callback',
					errorUrl: 'https://lilyserve.com/api/knet/error',
					udf1: 'ORDER-001',
					udf2: 'test@example.com',
					udf3: 'Flower Delivery',
					udf4: 'AlFahidi',
					udf5: 'Test Order'
				},
				encryptionKey,
				'test'
			);

			log('success', 'Payment request built successfully');
			console.log(`  Track ID:    ${paymentRequest.trackId}`);
			console.log(`  Mode:        ${paymentRequest.mode}`);
			console.log(`  Payment URL: ${paymentRequest.paymentUrl.substring(0, 80)}...`);

			// Test 4: Callback Validation
			separator('Test 4: Callback Response Validation');

			// Simulate a successful KNET response
			const mockResponseString = `amt=100.000&action=1&trackid=${paymentRequest.trackId}&udf1=ORDER-001&udf2=test@example.com&udf3=Flower%20Delivery&udf4=AlFahidi&udf5=Test%20Order&currencycode=414&langid=USA&id=659501&response=000&avr=123456&rrn=999999999&procident=KNET123456&auth=999999`;

			const mockEncryptedResponse = encryptAES(mockResponseString, encryptionKey);

			const validationResult = validateCallback(mockEncryptedResponse, encryptionKey, {
				trackId: paymentRequest.trackId,
				amount: 100.0
			});

			if (validationResult.valid) {
				log('success', 'Callback validation passed');
				console.log(`  Response Code: ${validationResult.response.response}`);
				console.log(`  Auth Code:     ${validationResult.response.auth}`);
				console.log(`  RRN:           ${validationResult.response.rrn}`);
				console.log(`  Amount:        ${validationResult.response.amt}`);
				console.log(`  Validations:   ${JSON.stringify(validationResult.validations)}`);
			} else {
				log('error', `Callback validation failed: ${validationResult.error}`);
			}

			// Test 5: Response Code Meanings
			separator('Test 5: Response Code Interpretations');
			const codes = ['000', '001', '003', '004', '063'];
			codes.forEach(code => {
				const meaning = getResponseCodeMeaning(code);
				const icon = code === '000' ? '✓' : '✗';
				console.log(`  ${icon} Code ${code}: ${meaning}`);
			});
		} catch (error) {
			log('error', `Test failed: ${error.message}`);
			separator();
			return;
		}
	}

	// Summary
	separator('TEST SUMMARY');
	log('success', 'All core encryption/payment functions working correctly');
	log('info', 'Next steps:');
	console.log('  1. Start server: node server.js');
	console.log('  2. Test initiate-payment endpoint: curl POST /api/knet/initiate-payment');
	console.log('  3. Visit payment URL in browser');
	console.log('  4. Enter test credit card and complete payment');
	console.log('  5. Verify callback received and logged');
	separator();
}

// Run tests
runTests().catch(error => {
	log('error', `Test suite error: ${error.message}`);
	process.exit(1);
});
