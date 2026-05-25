/**
 * KNET AES-128-CBC Encryption/Decryption Module
 * Encrypts and decrypts KNET payment requests/responses
 */

import crypto from 'crypto';

/**
 * Encrypt request string using AES-128-CBC
 * @param {string} plaintext - URL-encoded request string
 * @param {string} encryptionKey - Terminal Resource Key (16 bytes for 128-bit)
 * @returns {string} Uppercase hex-encoded ciphertext
 * @throws {Error} If encryption fails
 */
export function encryptAES(plaintext, encryptionKey) {
	try {
		// Validate key is correct length (16 bytes for AES-128)
		const keyBuffer = Buffer.from(encryptionKey, 'utf8');
		if (keyBuffer.length !== 16) {
			throw new Error(
				`Invalid encryption key length: ${keyBuffer.length} bytes. Expected 16 bytes (128-bit AES).`
			);
		}

		// IV is same as key for KNET (unusual but required by spec)
		const iv = keyBuffer;

		// Create cipher using AES-128-CBC
		const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, iv);

		// Encrypt plaintext
		let encrypted = cipher.update(plaintext, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		// Return uppercase hex string (KNET requirement)
		return encrypted.toUpperCase();
	} catch (error) {
		throw new Error(`Encryption failed: ${error.message}`);
	}
}

/**
 * Decrypt response string using AES-128-CBC
 * @param {string} ciphertext - Hex-encoded encrypted string from KNET
 * @param {string} encryptionKey - Terminal Resource Key (16 bytes for 128-bit)
 * @returns {string} Decrypted UTF-8 string (URL-encoded response fields)
 * @throws {Error} If decryption fails
 */
export function decryptAES(ciphertext, encryptionKey) {
	try {
		// Validate key is correct length
		const keyBuffer = Buffer.from(encryptionKey, 'utf8');
		if (keyBuffer.length !== 16) {
			throw new Error(
				`Invalid encryption key length: ${keyBuffer.length} bytes. Expected 16 bytes (128-bit AES).`
			);
		}

		// IV is same as key for KNET
		const iv = keyBuffer;

		// Convert hex ciphertext to buffer
		const ciphertextBuffer = Buffer.from(ciphertext, 'hex');

		// Create decipher using AES-128-CBC
		const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);

		// Decrypt ciphertext
		let decrypted = decipher.update(ciphertextBuffer, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch (error) {
		throw new Error(`Decryption failed: ${error.message}`);
	}
}

/**
 * Validate that encryption key is properly formatted
 * @param {string} key - Key to validate
 * @returns {boolean} True if key is valid 16-byte UTF-8 string
 */
export function isValidEncryptionKey(key) {
	if (!key || typeof key !== 'string') return false;
	const buffer = Buffer.from(key, 'utf8');
	return buffer.length === 16;
}

/**
 * Test encryption/decryption round-trip
 * @param {string} testString - String to encrypt and decrypt
 * @param {string} encryptionKey - Terminal Resource Key
 * @returns {object} { original, encrypted, decrypted, success: boolean }
 */
export function testEncryption(testString, encryptionKey) {
	try {
		const encrypted = encryptAES(testString, encryptionKey);
		const decrypted = decryptAES(encrypted, encryptionKey);
		return {
			original: testString,
			encrypted: encrypted.substring(0, 50) + '...', // truncate for logs
			decrypted: decrypted,
			success: decrypted === testString
		};
	} catch (error) {
		return {
			original: testString,
			error: error.message,
			success: false
		};
	}
}
