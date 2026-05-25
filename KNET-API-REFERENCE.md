# KNET API Reference — Quick Commands

**Base URL (Local):** `http://localhost:3000`  
**Base URL (Production):** `https://lilyserve.com`

---

## 1. Test Encryption (DEV ONLY)

### cURL Command

```bash
curl -X POST http://localhost:3000/api/knet/test-encryption \
  -H "Content-Type: application/json" \
  -d '{
    "testString": "amt=100.000&action=1&trackid=test123&currencycode=414&langid=USA&id=659501"
  }'
```

### Expected Response

```json
{
  "success": true,
  "original": "amt=100.000&action=1&trackid=test123&currencycode=414&langid=USA&id=659501",
  "encrypted": "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6...",
  "decrypted": "amt=100.000&action=1&trackid=test123&currencycode=414&langid=USA&id=659501",
  "matchesOriginal": true
}
```

### What It Tests

- Encryption key is configured correctly
- AES-128-CBC encryption works
- Decryption works
- Round-trip consistency

### If `matchesOriginal` is `false`

❌ Your encryption key is **INCORRECT**
- Check `.env` file
- Verify key is exactly 16 UTF-8 characters
- Get key from KNET portal (Terminals → Terminal 659501 → Resource Key)

---

## 2. Initiate Payment

### cURL Command

```bash
curl -X POST http://localhost:3000/api/knet/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER-12345",
    "amount": "100.000",
    "customerEmail": "customer@example.com",
    "customerName": "Ahmed Al-Khaleej",
    "productDescription": "Flower Bouquet Delivery",
    "deliveryZone": "AlFahidi"
  }'
```

### Expected Response

```json
{
  "success": true,
  "trackId": "ABC123DEF456GHI789",
  "paymentUrl": "https://kpaytest.com.kw/kpg/PaymentHTTP.htm?param=paymentInit&trandata=HEXSTRING&responseURL=...&errorURL=...&tranportalId=659501",
  "orderId": "ORDER-12345",
  "amount": 100.0,
  "mode": "test"
}
```

### What It Does

1. Generates unique transaction ID (`trackId`)
2. Encrypts payment request with AES-128-CBC
3. Returns KNET payment page URL
4. Next step: Visit the `paymentUrl` in a browser

### Request Parameters

| Field | Required | Type | Example |
|-------|----------|------|---------|
| `orderId` | YES | String | `"ORDER-001"` |
| `amount` | YES | Number/String | `"100.000"` or `100` |
| `customerEmail` | NO | String | `"customer@example.com"` |
| `customerName` | NO | String | `"John Doe"` |
| `productDescription` | NO | String | `"Flower Delivery"` |
| `deliveryZone` | NO | String | `"AlFahidi"` |

---

## 3. Callback (KNET POSTs Here)

### What KNET Does

After customer completes payment, KNET **automatically POSTs** to your callback URL:

```bash
POST https://lilyserve.com/api/knet/callback
Content-Type: application/x-www-form-urlencoded

A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6[...]
```

### Server Response (Expected)

```
REDIRECT=https://lilyserve.com/order-success?trackId=ABC123DEF456&orderId=ORDER-12345
```

### Server Logs (Expected)

```
[KNET] Callback received: trackId=ABC123DEF456, orderId=ORDER-12345, code=000
[KNET] Payment successful: ABC123DEF456 (Auth: 123456, RRN: 999999999)
```

### What the Server Does

1. Receives encrypted response from KNET
2. Decrypts using AES-128-CBC
3. Parses response fields
4. **Validates:**
   - Response code is `000` (success)
   - TrackId matches original request
   - Amount matches original request
5. If valid → Mark order as PAID
6. Redirects customer to success/error page

### Testing Callback Manually (Advanced)

```bash
# Build a test response
TEST_RESPONSE="amt=100.000&action=1&trackid=ABC123&response=000&auth=999999&rrn=12345678&udf1=ORDER-001"

# Encrypt it (using your Python/Node script)
ENCRYPTED=$(python3 encrypt.py "$TEST_RESPONSE" "$KNET_ENCRYPTION_KEY")

# POST to callback
curl -X POST http://localhost:3000/api/knet/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "$ENCRYPTED"
```

---

## 4. Check Payment Status

### cURL Command

```bash
curl -X GET "http://localhost:3000/api/knet/status?trackId=ABC123DEF456"
```

### Expected Response

```json
{
  "success": true,
  "trackId": "ABC123DEF456",
  "status": "pending",
  "message": "Database integration needed"
}
```

**Note:** Status endpoint is placeholder pending Phase 2 (database integration).

---

## POSTMAN COLLECTION

### Setup

1. **Create New Collection:** KNET Payment Gateway
2. **Add Environment Variable:**
   - `base_url` = `http://localhost:3000`
   - `encryption_key` = `<your-16-char-key>`

### Request 1: Test Encryption

```
Method: POST
URL: {{base_url}}/api/knet/test-encryption
Body (JSON):
{
  "testString": "amt=100.000&action=1&trackid=test123&currencycode=414"
}
```

### Request 2: Initiate Payment

```
Method: POST
URL: {{base_url}}/api/knet/initiate-payment
Body (JSON):
{
  "orderId": "POSTMAN-TEST-001",
  "amount": "50.000",
  "customerEmail": "test@postman.local",
  "customerName": "Postman Test",
  "productDescription": "Postman Test Product",
  "deliveryZone": "Test Zone"
}
```

### Request 3: Check Status

```
Method: GET
URL: {{base_url}}/api/knet/status?trackId={{trackId}}

(Use {{trackId}} from previous response)
```

---

## RESPONSE CODES

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| `000` | ✅ Success | Payment approved | Mark order PAID |
| `001` | ❌ Fail | Insufficient funds | Show error |
| `002` | ❌ Fail | Incorrect PIN | Show error |
| `003` | ❌ Fail | Transaction declined | Show error |
| `004` | ❌ Fail | Card expired | Show error |
| `005` | ❌ Fail | Exceeds limit | Show error |
| `063` | ❌ Fail | Suspected fraud | Show error, contact bank |

**Full list:** See `KNET-PROTOCOL.md` → Response Codes

---

## ERROR RESPONSES

### Encryption Key Not Configured

```json
{
  "success": false,
  "error": "KNET configuration incomplete. Check environment variables."
}
```

**Fix:** Add `KNET_ENCRYPTION_KEY` to `.env`

### Invalid Amount

```json
{
  "success": false,
  "error": "Invalid amount: must be a positive number"
}
```

**Fix:** Use amount > 0, e.g., `"100.000"`

### Callback Validation Failed

```
Error: Invalid payment response
```

**Cause:** 
- Encrypted response is corrupted
- Encryption key is wrong
- Response is not from KNET

### Payment Initiation Failed

```json
{
  "success": false,
  "error": "Failed to initiate payment: [specific error]"
}
```

**Check:**
- All required environment variables set
- `orderId` and `amount` provided
- Amount is valid number > 0

---

## TESTING WORKFLOW

### 1. Test Encryption

```bash
curl -X POST http://localhost:3000/api/knet/test-encryption \
  -H "Content-Type: application/json" \
  -d '{"testString": "amt=100.000&action=1"}'
```

✅ Success → `matchesOriginal: true`  
❌ Fail → Check encryption key

### 2. Initiate Payment

```bash
curl -X POST http://localhost:3000/api/knet/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST-001",
    "amount": "100.000",
    "customerEmail": "test@example.com"
  }'
```

✅ Success → Get `paymentUrl`  
❌ Fail → Check `.env` variables

### 3. Visit Payment URL

1. Copy `paymentUrl` from response
2. Open in browser
3. System should redirect to KNET payment page

✅ Success → KNET login/payment page appears  
❌ Fail → Check `KNET_CALLBACK_URL` is HTTPS + publicly accessible

### 4. Enter Test Card

1. On KNET page, click login
2. Enter test credentials or test card
3. Complete payment flow

✅ Success → After payment, redirect to success page  
❌ Fail → KNET test page shows error

### 5. Check Callback

```bash
# Watch server logs
tail -f server.log
```

✅ Success → See `[KNET] Payment successful`  
❌ Fail → Check callback URL is accessible from KNET

### 6. Verify Order Status

```bash
# Check Supabase (Phase 2)
SELECT * FROM bookings WHERE order_id = 'TEST-001';
```

✅ Success → `payment_status = 'paid'`

---

## DEBUGGING

### Check Environment Variables

```bash
# Show KNET config (without exposing secrets)
env | grep KNET | sed 's/=.*/=***/'
```

### Test HTTPS Callback URL

```bash
curl -I https://lilyserve.com/api/knet/callback
```

✅ Should return `HTTP/2 200` or `HTTP/1.1 200`

### Check Server Logs

```bash
# Local testing
node server.js

# Production (might need docker logs)
docker logs knet-payment-server
```

### Test Encryption Manually

```bash
# Using Node.js REPL
node

> import { encryptAES } from './knet/encryption.js'
> const key = 'MySecretKey1234'
> const encrypted = encryptAES('test', key)
> console.log(encrypted)
A1B2C3D4E5F6G7H8I9J0...
```

---

## SUPPORT

**KNET Support:** `PGSupport@knet.com.kw`

**What to ask:**
- Terminal Resource Key (encryption key)
- Test credit card numbers
- IP whitelisting (if needed)
- Go-live process

---

**Last Updated:** May 12, 2026  
**Status:** Ready for Testing with Terminal Resource Key
