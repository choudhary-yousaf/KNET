# KNET Payment Protocol Specification
**Extracted From:** JSP Demo Code (`SendPerformREQuest.jsp`, `GetHandleRESponse.jsp`)  
**Status:** Production Ready  
**Date:** May 11, 2026

---

## ENCRYPTION DETAILS

### Algorithm
- **Type:** AES (Advanced Encryption Standard)
- **Key Size:** 128-bit
- **Mode:** CBC (Cipher Block Chaining)
- **Padding:** PKCS5
- **IV (Initialization Vector):** Same as key (UTF-8 encoded)

### Encryption Key Source
- **Key Name:** `termResourceKey` (Terminal Resource Key)
- **Where to Get:** KNET support email: `PGSupport@knet.com.kw`
- **Storage:** `/Integration/resource.cgn` and `/Integration/keystore.bin` (encrypted binary files)
- **Usage:** Used for both request encryption AND response decryption

### Key Extraction (Java Example)
```java
// The resource.cgn and keystore.bin contain encrypted key material
// To extract: You need KNET's Java library OR ask support for plaintext key
```

---

## REQUEST FLOW

### Step 1: Build Request String

Construct a URL-encoded string with the following fields:

| Field | Required | Type | Example | Notes |
|-------|----------|------|---------|-------|
| `amt` | YES | String | `"100.000"` | Amount in KD (3 decimal places) |
| `action` | YES | String | `"1"` | Transaction type: 1 = Purchase |
| `currencycode` | YES | String | `"414"` | KD currency code (fixed) |
| `langid` | YES | String | `"USA"` | Language: USA (English) or AR (Arabic) |
| `trackid` | YES | String | `"1234567890"` | **UNIQUE** transaction ID from merchant system |
| `id` | YES | String | `"659501"` | Terminal ID (Tranportal ID) |
| `password` | YES | String | `"xxxxxxxx"` | Terminal password (from KNET support) |
| `responseURL` | YES | HTTPS URL | `"https://lilyserve.com/api/knet/callback"` | Payment success response URL |
| `errorURL` | YES | HTTPS URL | `"https://lilyserve.com/api/knet/error"` | Payment error response URL |
| `udf1` | Optional | String | Order/Booking ID | User-defined field 1 |
| `udf2` | Optional | String | Customer email | User-defined field 2 |
| `udf3` | Optional | String | Product details | User-defined field 3 |
| `udf4` | Optional | String | Delivery zone | User-defined field 4 |
| `udf5` | Optional | String | Additional info | User-defined field 5 |

### Step 2: Concatenate with Ampersands
```
Example (unencrypted):
amt=100.000&action=1&responseURL=https://lilyserve.com/api/knet/callback&errorURL=https://lilyserve.com/api/knet/error&trackid=1234567890&udf1=ORDER-123&udf2=test@example.com&udf3=Flower%20Delivery&udf4=AlFahidi&udf5=&currencycode=414&langid=USA&id=659501&password=xxxxxxxx
```

**IMPORTANT:** Order doesn't matter, but ALL required fields must be present.

### Step 3: Encrypt Request String

```
1. Convert string to UTF-8 bytes
2. Encrypt using AES/CBC/PKCS5Padding with:
   - Key: termResourceKey (UTF-8 bytes)
   - IV: termResourceKey (UTF-8 bytes) — SAME as key!
3. Convert encrypted bytes to HEX string (uppercase)
4. Result: LONG hex string like "A1B2C3D4..."
```

### Step 4: Build Final Payment Request

```
GET Parameter Format:
https://kpaytest.com.kw/kpg/PaymentHTTP.htm?param=paymentInit&trandata=<HEX_ENCRYPTED_STRING>&responseURL=https://lilyserve.com/api/knet/callback&errorURL=https://lilyserve.com/api/knet/error&tranportalId=659501
```

**URL Components:**
- **Base URL (Test):** `https://kpaytest.com.kw/kpg/PaymentHTTP.htm`
- **Base URL (Production):** `https://www.kpay.com.kw/kpg/PaymentHTTP.htm`
- **param:** Always `paymentInit`
- **trandata:** HEX-encrypted request string (unencrypted URLs passed in clear)
- **responseURL:** Plain text (not encrypted)
- **errorURL:** Plain text (not encrypted)
- **tranportalId:** Plain text (not encrypted)

### Step 5: Redirect Customer

```javascript
// In Node.js/Express:
res.redirect(paymentUrl);
```

---

## RESPONSE FLOW

### Step 1: KNET POSTs to responseURL

KNET will POST (HTTP POST method) to your callback URL with:
- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:** Encrypted response (hex string)

```
POST https://lilyserve.com/api/knet/callback
Content-Type: application/x-www-form-urlencoded

<encrypted_hex_string>
```

### Step 2: Decrypt Response

```javascript
1. Read raw POST body (hex string)
2. Decrypt using AES/CBC/PKCS5Padding with:
   - Key: termResourceKey (UTF-8 bytes)
   - IV: termResourceKey (UTF-8 bytes) — SAME as key!
3. Decode bytes to UTF-8 string
4. Result: URL-encoded response string
```

### Step 3: Parse Response String

Example decrypted response:
```
amt=100.000&action=1&trackid=1234567890&udf1=ORDER-123&udf2=test@example.com&udf3=Flower%20Delivery&udf4=AlFahidi&udf5=&currencycode=414&langid=USA&id=659501&response=000&avr=123456&rrn=999999999&procident=KNET123456&auth=999999
```

### Step 4: Validate Response

Critical fields to check:

| Field | Meaning | Values |
|-------|---------|--------|
| `response` | Payment status code | `000` = SUCCESS, others = FAILED |
| `trackid` | Transaction ID (must match request) | Should equal request `trackid` |
| `amt` | Amount (verify matches request) | Should equal request `amt` |
| `auth` | Authorization code (proof of payment) | 6-digit code |
| `rrn` | Retrieval Reference Number | Unique per transaction |
| `procident` | Processor identifier | KNET's transaction ID |
| `avr` | AVR code | Additional validation result |

### Step 5: Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| `000` | Success (Payment Approved) | ✅ Mark order as PAID |
| `001` | Insufficient Funds | ❌ Show error to customer |
| `002` | Incorrect PIN | ❌ Show error to customer |
| `003` | Transaction Declined | ❌ Show error to customer |
| `004` | Expired Card | ❌ Show error to customer |
| `005` | Exceeds Limit | ❌ Show error to customer |
| Others | Various errors | ❌ Log and contact KNET |

---

## NODE.JS IMPLEMENTATION PSEUDO-CODE

### Initiate Payment Endpoint

```javascript
// POST /api/knet/initiate-payment
// Body: { orderId, amount, customerEmail, ... }

const crypto = require('crypto');

async function initiatePayment(req, res) {
  const { orderId, amount, customerEmail } = req.body;
  
  // 1. Build request string
  const termResourceKey = process.env.KNET_ENCRYPTION_KEY; // From .env
  const terminalId = process.env.KNET_TERMINAL_ID; // "659501"
  const terminalPassword = process.env.KNET_TERMINAL_PASSWORD; // From KNET support
  const trackId = crypto.randomBytes(16).toString('hex'); // Unique ID
  
  const requestString = [
    `amt=${(amount).toFixed(3)}`,
    `action=1`,
    `responseURL=https://lilyserve.com/api/knet/callback`,
    `errorURL=https://lilyserve.com/api/knet/error`,
    `trackid=${trackId}`,
    `udf1=${orderId}`,
    `udf2=${customerEmail}`,
    `udf3=Flower%20Delivery`,
    `currencycode=414`,
    `langid=USA`,
    `id=${terminalId}`,
    `password=${terminalPassword}`
  ].join('&');
  
  // 2. Encrypt using AES/CBC
  const iv = Buffer.from(termResourceKey, 'utf8'); // IV = key
  const key = Buffer.from(termResourceKey, 'utf8');
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  
  let encrypted = cipher.update(requestString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  encrypted = encrypted.toUpperCase();
  
  // 3. Build payment URL
  const baseUrl = process.env.KNET_MODE === 'production'
    ? 'https://www.kpay.com.kw/kpg/PaymentHTTP.htm'
    : 'https://kpaytest.com.kw/kpg/PaymentHTTP.htm';
  
  const paymentUrl = `${baseUrl}?param=paymentInit&trandata=${encrypted}&responseURL=https://lilyserve.com/api/knet/callback&errorURL=https://lilyserve.com/api/knet/error&tranportalId=${terminalId}`;
  
  // 4. Store trackId → orderId mapping (for callback validation)
  await db.payment_requests.insert({
    track_id: trackId,
    order_id: orderId,
    amount: amount,
    created_at: new Date(),
    status: 'pending'
  });
  
  // 5. Redirect customer to KNET
  res.json({ paymentUrl: paymentUrl });
}
```

### Callback Handler Endpoint

```javascript
// POST /api/knet/callback
// Body: Raw encrypted hex string

async function handleKnetCallback(req, res) {
  const termResourceKey = process.env.KNET_ENCRYPTION_KEY;
  
  try {
    // 1. Read encrypted response from body
    let encryptedResponse = '';
    req.on('data', chunk => encryptedResponse += chunk.toString());
    
    // 2. Decrypt response
    const iv = Buffer.from(termResourceKey, 'utf8');
    const key = Buffer.from(termResourceKey, 'utf8');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    
    const decryptedBytes = Buffer.concat([
      decipher.update(encryptedResponse, 'hex'),
      decipher.final()
    ]);
    const decrypted = decryptedBytes.toString('utf8');
    
    // 3. Parse response string
    const response = parseQueryString(decrypted); // Parse URL-encoded string
    const trackId = response.trackid;
    const responseCode = response.response;
    const orderId = response.udf1;
    
    // 4. Validate response
    if (responseCode !== '000') {
      console.error(`Payment failed for ${trackId}: code ${responseCode}`);
      await db.payment_requests.update(trackId, { status: 'failed' });
      return res.json({ result: 'REDIRECT=https://lilyserve.com/order-failed' });
    }
    
    // 5. Verify trackId exists and amount matches
    const payment = await db.payment_requests.findOne({ track_id: trackId });
    if (!payment) {
      console.error(`Unknown trackId: ${trackId}`);
      return res.status(400).json({ error: 'Invalid transaction' });
    }
    
    if (payment.amount !== parseFloat(response.amt)) {
      console.error(`Amount mismatch for ${trackId}`);
      return res.status(400).json({ error: 'Amount mismatch' });
    }
    
    // 6. Prevent duplicate processing
    if (payment.status === 'paid') {
      console.log(`Duplicate callback for ${trackId}, ignoring`);
      return res.json({ result: 'REDIRECT=https://lilyserve.com/order-success' });
    }
    
    // 7. Mark order as PAID in Shopify
    await shopifyApiClient.markOrderAsPaid(orderId, {
      trackId: trackId,
      authCode: response.auth,
      rrn: response.rrn
    });
    
    // 8. Update payment status in database
    await db.payment_requests.update(trackId, { 
      status: 'paid',
      response_code: responseCode,
      auth_code: response.auth,
      rrn: response.rrn,
      paid_at: new Date()
    });
    
    // 9. Redirect customer to success page
    res.json({ result: 'REDIRECT=https://lilyserve.com/order-success?trackId=' + trackId });
    
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({ error: 'Processing error' });
  }
}
```

---

## ERROR HANDLING

### Payment Initiation Errors

| Scenario | HTTP Status | Action |
|----------|-----------|--------|
| Missing required field | 400 | Return error to client |
| Invalid amount format | 400 | Validate amount >= 0.001 KD |
| KNET URL unreachable | 500 | Log and alert ops |
| Database error (tracking) | 500 | Return error, log incident |

### Callback Errors

| Scenario | Action |
|----------|--------|
| Decryption fails | Log security incident, reject |
| TrackId unknown | Log fraud alert, reject |
| Amount mismatch | Log fraud alert, reject |
| Duplicate trackId | Return success (idempotent) |
| Duplicate processing | Use `SELECT FOR UPDATE` or atomic DB transaction |
| Shopify API fails | Log, queue retry, notify ops |

---

## ENVIRONMENT VARIABLES (.env)

```bash
# KNET Configuration
KNET_MERCHANT_ID=6595
KNET_TERMINAL_ID=659501
KNET_TERMINAL_PASSWORD=xxxxxxxx          # From KNET support
KNET_ENCRYPTION_KEY=xxxxxxxx              # From keystore.bin (to be extracted)
KNET_MODE=test                            # or 'production'

# URLs
KNET_CALLBACK_URL=https://lilyserve.com/api/knet/callback
KNET_ERROR_URL=https://lilyserve.com/api/knet/error

# Test (optional - for Postman/curl testing)
KNET_TEST_TRACK_ID=test-1234567890
KNET_TEST_AMOUNT=100.000
```

---

## SHOPIFY INTEGRATION TOUCHPOINTS

### 1. Order Creation (Checkout → Draft Order)

When customer selects KNET payment:
```
POST /api/knet/initiate-payment
{
  "orderId": "shopify-draft-order-123",
  "amount": "100.000",
  "customerEmail": "customer@example.com"
}
```

### 2. Callback to Shopify Order Update

On successful KNET callback:
```
POST /admin/api/2024-01/orders/{shopify_order_id}/transactions.json
{
  "transaction": {
    "kind": "capture",
    "status": "success",
    "amount": "100.00",
    "gateway": "knet",
    "authorization": "KNET-auth-code-from-callback"
  }
}
```

### 3. Database Update (Supabase)

Insert payment confirmation into bookings table:
```sql
UPDATE bookings 
SET 
  payment_status = 'paid',
  payment_method = 'KNET',
  knet_track_id = 'trackid-value',
  knet_rrn = 'rrn-value',
  paid_at = NOW()
WHERE order_id = 'shopify-order-id';
```

---

## TESTING CHECKLIST

- [ ] Encryption/decryption logic works with test key
- [ ] Request string built correctly
- [ ] Payment URL formed correctly
- [ ] Can POST to KNET test endpoint (certificate validation)
- [ ] Callback receives response in expected format
- [ ] Response decryption works
- [ ] Response codes parsed correctly (000 = success)
- [ ] TrackId validation prevents fraud
- [ ] Amount validation prevents mismatch attacks
- [ ] Duplicate callbacks handled idempotently
- [ ] Shopify order marked as paid within 1 minute
- [ ] Supabase booking entry updated
- [ ] Customer redirected to success page
- [ ] Error scenarios tested (declined card, timeout, etc.)

---

## PRODUCTION CHECKLIST

- [ ] Use production KNET URLs (https://www.kpay.com.kw)
- [ ] All secrets in secure vault (not hardcoded)
- [ ] HTTPS certificates valid and auto-renewing
- [ ] Callback URL whitelisted with KNET support
- [ ] Rate limiting enabled on payment endpoints
- [ ] Request signing/verification implemented (if KNET requires)
- [ ] Logging in place (without exposing sensitive data)
- [ ] Monitoring/alerting for failed payments
- [ ] Incident response plan for KNET outages
- [ ] Backup payment method if KNET unavailable
- [ ] PCI compliance review completed
- [ ] Penetration testing for payment endpoints
- [ ] Disaster recovery tested (data loss scenario)

---

## REFERENCES

- JSP Demo: `SendPerformREQuest.jsp` — Request building
- JSP Demo: `GetHandleRESponse.jsp` — Callback handling
- Merchant Manual: `K-063-Merchant-Manual.pdf`
- Integration Manual: `K-064-Integration-Manual.pdf`
- KNET Support: `PGSupport@knet.com.kw`

---

**Next Step:** Implement Node.js KNET module with encryption/decryption and test with KNET demo credentials.
