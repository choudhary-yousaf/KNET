/**
 * KNET Payment Client
 * Builds KNET payment requests and validates responses
 */

import crypto from 'crypto';
import { encryptAES, decryptAES } from './encryption.js';
import { URLSearchParams } from 'url';

// Node's global fetch is used for server-to-server calls

/**
 * Build unencrypted KNET request string
 * @param {object} params - Payment parameters
 * @returns {string} URL-encoded request string
 */
function buildRequestString(params) {
	const {
		amount,
		trackId,
		terminalId,
		terminalPassword,
		responseUrl,
		errorUrl,
		udf1 = '',
		udf2 = '',
		udf3 = '',
		udf4 = '',
		udf5 = '',
		langId = 'USA'
	} = params;

	// Format amount to 3 decimal places (KD precision)
	const formattedAmount = parseFloat(amount).toFixed(3);

	// Build request string in order (order doesn't strictly matter but this is conventional)
	// Build request string following K-064 ordering. DO NOT URL-encode the values here;
	// the whole string is encrypted as plaintext.
	const parts = [
		`id=${terminalId}`,
		`password=${terminalPassword}`,
		`action=1`, // 1 = Purchase
		`amt=${formattedAmount}`,
		`currencycode=414`, // 414 = KWD
		`langid=${langId}`,
		`trackid=${trackId}`,
		`responseURL=${responseUrl}`,
		`errorURL=${errorUrl}`,
		`udf1=${udf1}`,
		`udf2=${udf2}`,
		`udf3=${udf3}`,
		`udf4=${udf4}`,
		`udf5=${udf5}`
	];

	return parts.join('&');
}

/**
 * Initiate KNET payment request
 * @param {object} params - Payment parameters
 * @param {string} encryptionKey - Terminal Resource Key
 * @param {string} mode - 'test' or 'production'
 * @returns {object} { trackId, paymentUrl, requestString }
 */
export async function initiatePayment(params, encryptionKey, mode = 'test') {
	try {
		// Validate required parameters
		const { amount, terminalId, terminalPassword, responseUrl, errorUrl } = params;
		if (!amount || !terminalId || !terminalPassword || !responseUrl || !errorUrl) {
			throw new Error('Missing required payment parameters');
		}

		// Generate unique track ID (alphanumeric)
		const trackId = (`ORD${Date.now()}${crypto.randomBytes(4).toString('hex')}`).toUpperCase();

		// Build unencrypted request string
		const requestString = buildRequestString({
			...params,
			trackId
		});

		// Encrypt the request string
		const trandata = encryptAES(requestString, encryptionKey);

		// Select KNET endpoint based on mode
		const baseUrl =
			mode === 'production'
				? 'https://www.kpay.com.kw/kpg/PaymentHTTP.htm'
				: 'https://kpaytest.com.kw/kpg/PaymentHTTP.htm';

		// Build server-to-server request URL
		const paramsObj = new URLSearchParams({
			param: 'paymentInit',
			trandata: trandata,
			responseURL: responseUrl,
			errorURL: errorUrl,
			tranportalId: terminalId
		});

		const requestUrl = `${baseUrl}?${paramsObj.toString()}`;

		// Server-to-server GET
		const resp = await fetch(requestUrl, { method: 'GET' });
		const body = await resp.text();

		// KNET may return either key=value pairs containing trandata or a raw hex string
		let paymentPageUrl = null;

		if (body.includes('=')) {
			const parsed = new URLSearchParams(body);
			const encryptedResp = parsed.get('trandata');
			const paymentId = parsed.get('paymentid') || null;
			if (encryptedResp) {
				const decrypted = decryptAES(encryptedResp.trim(), encryptionKey);
				// decrypted often contains paymentPage or webaddress
				const decParsed = new URLSearchParams(decrypted);
				paymentPageUrl = decParsed.get('paymentPage') || decParsed.get('webaddress') || decParsed.get('URL');
				if (!paymentPageUrl) {
					// fallback: search for first https:// occurrence
					const m = decrypted.match(/https?:\/\/[\S]+/i);
					if (m) paymentPageUrl = m[0];
				}
			}
			return {
				trackId,
				paymentUrl: paymentPageUrl,
				rawResponse: body
			};
		} else {
			// Treat body as encrypted hex
			const decrypted = decryptAES(body.trim(), encryptionKey);
			const decParsed = new URLSearchParams(decrypted);
			paymentPageUrl = decParsed.get('paymentPage') || decParsed.get('webaddress') || decParsed.get('URL');
			if (!paymentPageUrl) {
				const m = decrypted.match(/https?:\/\/[\S]+/i);
				if (m) paymentPageUrl = m[0];
			}

			return {
				trackId,
				paymentUrl: paymentPageUrl,
				rawResponse: body
			};
		}
	} catch (error) {
		throw new Error(`Failed to initiate payment: ${error.message}`);
	}
}

/**
 * Parse URL-encoded response string into object
 * @param {string} responseString - URL-encoded response string
 * @returns {object} Parsed response fields
 */
function parseResponseString(responseString) {
	const params = new URLSearchParams(responseString);
	const response = {};
	for (const [key, value] of params.entries()) {
		response[key] = value;
	}
	return response;
}

/**
 * Validate KNET callback response
 * @param {string} encryptedResponse - Encrypted hex string from KNET POST
 * @param {string} encryptionKey - Terminal Resource Key
 * @param {object} originalRequest - Original request params for comparison
 * @returns {object} { valid: boolean, response: object, error?: string }
 */
export function validateCallback(encryptedResponse, encryptionKey, originalRequest = {}) {
	try {
		// Decrypt response
		const decryptedResponse = decryptAES(encryptedResponse, encryptionKey);
		const response = parseResponseString(decryptedResponse);

		// Check if payment was successful (response code 000)
		const isSuccessful = response.response === '000';

		// Validate critical fields
		const validations = {
			hasResponseCode: !!response.response,
			hasTrackId: !!response.trackid,
			hasAuthCode: !!response.auth,
			hasRrn: !!response.rrn,
			isSuccessful: isSuccessful
		};

		// If original request provided, validate amount matches (prevent tampering)
		if (originalRequest.amount) {
			const originalAmount = parseFloat(originalRequest.amount).toFixed(3);
			const responseAmount = parseFloat(response.amt || 0).toFixed(3);
			validations.amountMatches = originalAmount === responseAmount;
		}

		// If original request provided, validate track ID matches
		if (originalRequest.trackId) {
			validations.trackIdMatches = originalRequest.trackId === response.trackid;
		}

		const valid =
			validations.hasResponseCode &&
			validations.hasTrackId &&
			validations.hasAuthCode &&
			validations.hasRrn &&
			validations.isSuccessful &&
			(originalRequest.amount ? validations.amountMatches : true) &&
			(originalRequest.trackId ? validations.trackIdMatches : true);

		return {
			valid,
			response,
			validations,
			decrypted: decryptedResponse
		};
	} catch (error) {
		return {
			valid: false,
			error: error.message
		};
	}
}

/**
 * Get KNET response code meaning
 * @param {string} code - KNET response code
 * @returns {string} Human-readable description
 */
export function getResponseCodeMeaning(code) {
	const meanings = {
		'000': 'Success (Payment Approved)',
		'001': 'Insufficient Funds',
		'002': 'Incorrect PIN',
		'003': 'Transaction Declined',
		'004': 'Expired Card',
		'005': 'Exceeds Limit',
		'006': 'No Customer Record',
		'007': 'No Card Record',
		'008': 'Invalid Transaction',
		'009': 'Lost Card',
		'010': 'Stolen Card',
		'012': 'Invalid Amount',
		'013': 'Invalid Card Number',
		'014': 'No Issuer',
		'015': 'No Capture',
		'021': 'Duplicate',
		'025': 'Unable to Locate Record',
		'028': 'File Temporarily Unavailable',
		'029': 'File Permanently Unavailable',
		'030': 'Format Error',
		'031': 'Bank Not Supported',
		'032': 'Completed Partially',
		'033': 'Expired Terminal',
		'034': 'Merchant Suspended',
		'035': 'Terminal Blocked',
		'036': 'Card Expired',
		'037': 'Contact Acquirer',
		'038': 'Allowable PIN Tries Exceeded',
		'039': 'No Credit Account',
		'040': 'Function Not Supported',
		'041': 'Lost Card',
		'042': 'No Universal Account',
		'043': 'No Checking Account',
		'044': 'No Savings Account',
		'045': 'No Line of Credit',
		'046': 'Unsupported Card',
		'047': 'Call Acquirer Security',
		'048': 'Invalid Amount',
		'049': 'Invalid Merchant ID',
		'050': 'No Savings Account',
		'051': 'Ineligible Account',
		'052': 'Ineligible Account',
		'053': 'Blocked Account',
		'054': 'No Expense Account',
		'055': 'Not Authorized',
		'056': 'Identification Number Mismatch',
		'057': 'Traveler Checks Not Accepted',
		'058': 'Not Accepted at This Terminal',
		'059': 'Allowable Number Exceeded',
		'060': 'Acquirer Error',
		'061': 'Amount Limit Exceeded',
		'062': 'Restricted Card',
		'063': 'Suspected Fraud',
		'064': 'Retain Card',
		'065': 'Exceeds Daily Withdrawal Limit',
		'066': 'Incorrect PIN',
		'067': 'Issuer Unavailable',
		'068': 'Invalid Merchant ID',
		'069': 'Capture Error',
		'070': 'Batch Error',
		'071': 'Cannot Verify PIN',
		'072': 'Invalid Effective Date',
		'073': 'Invalid Expiration Date',
		'074': 'Invalid CVC2',
		'075': 'Card Not Accepted',
		'076': 'System Unavailable',
		'077': 'Card Not Yet Effective',
		'078': 'No Savings Account',
		'079': 'PIN Verification Failed',
		'080': 'Invalid Transaction Code',
		'081': 'Transaction Not Permitted',
		'082': 'Frequency Limit Exceeded',
		'083': 'Suspected Counterfeit Card',
		'084': 'Invalid Transaction',
		'085': 'Approved',
		'086': 'Invalid Terminal ID',
		'087': 'Invalid Transaction Indicator',
		'088': 'PED Device Error',
		'089': 'Transaction Not Permitted at Terminal'
	};
	return meanings[code] || 'Unknown Response Code';
}

/**
 * Format payment amount for KNET (3 decimal places)
 * @param {number} amount - Amount in KD
 * @returns {string} Formatted amount string
 */
export function formatAmount(amount) {
	return parseFloat(amount).toFixed(3);
}
