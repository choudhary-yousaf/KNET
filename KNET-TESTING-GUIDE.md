# KNET Integration Testing Guide

**Status:** Phase 1 Implementation Complete ✅  
**Date:** May 12, 2026  
**Next Action:** Extract Terminal Resource Key + Test Integration

---

## STEP 1: Extract Terminal Resource Key from KNET Portal

The **Terminal Resource Key** is the encryption key needed for AES-128-CBC encryption. Follow these steps to extract it:

### 1A. Log into KNET Test Portal

1. Open: **https://kpaytest.com.kw/portal/merchant.htm**
2. Login with:
   - **Institution ID:** `knetbank`
   - **Merchant ID:** `6595`
   - **User ID:** `LTCADMIN`
   - **Password:** `LilyServeKnet2026!`

### 1B. Find Terminal Resource Key

In the KNET portal, look for one of these locations:

**Option 1: Terminal Settings**
- Click **Terminals** or **Terminal Management**
- Select Terminal ID: `659501`
- Look for **"Resource Key"**, **"Encryption Key"**, or **"Terminal Key"**
- Copy the value (should be 16 characters)

**Option 2: Security Settings**
- Click **Settings** → **Security** or **Encryption**
- Look for **"Terminal Resource Key"**

**Option 3: Download Key File**
- Some KNET portals allow downloading the key file
- The key might be in the `resource.cgn` or `keystore.bin` files
- If so, email support: `PGSupport@knet.com.kw` asking to extract the plaintext key

**If you cannot find it in the portal:**
- Email KNET support with this request:

```
Subject: Terminal Resource Key for Merchant 6595 / Terminal 659501

Dear KNET Support,

I need the Terminal Resource Key (encryption key) for:
- Merchant ID: 6595
- Terminal ID: 659501
- Environment: Test

Can you provide the plaintext Terminal Resource Key?
It should be 16 bytes (128-bit AES).

Thank you,
[Your name]
```

### 1C. Add Key to Environment

Once you have the Terminal Resource Key:

1. Open `.env` file in your project root
2. Find or create: `KNET_ENCRYPTION_KEY=`
3. Paste the key value (16 characters)
4. Save the file

Example:
```bash
KNET_ENCRYPTION_KEY=MySecretKey1234
```

**⚠️ CRITICAL:** Never commit `.env` to Git! It contains secrets.

---

## STEP 2: Verify Configuration

Check that all KNET environment variables are set:

```bash
# In terminal, check your .env file contains:
KNET_TERMINAL_ID=659501
KNET_TERMINAL_PASSWORD=LilyServeKnet2026!
KNET_ENCRYPTION_KEY=<16-character-key>
KNET_MODE=test
KNET_CALLBACK_URL=https://lilyserve.com/api/knet/callback
KNET_ERROR_URL=https://lilyserve.com/api/knet/error
```

---

## STEP 3: Test Encryption/Decryption (DEV ONLY)

Before testing with real KNET, verify encryption works with your key:

### 3A. Start the Server

```bash
node server.js
```

You should see:
```
Server running on 3000
```

### 3B. Test Encryption via Postman or cURL

**Using cURL:**

```bash
curl -X POST http://localhost:3000/api/knet/test-encryption \
  -H "Content-Type: application/json" \
  -d '{
    "testString": "amt=100.000&action=1&trackid=test123&currencycode=414&langid=USA&id=659501&password=LilyServeKnet2026!"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "original": "amt=100.000&action=1&trackid=test123&currencycode=414&langid=USA&id=659501&password=LilyServeKnet2026!",
  "encrypted": "A1B2C3D4E5F6...",
  "decrypted": "amt=100.000&action=1&trackid=test123&currencycode=414&langid=USA&id=659501&password=LilyServeKnet2026!",
  "matchesOriginal": true
}
```

**If `matchesOriginal` is `false`:**
- Your encryption key is incorrect
- Double-check the 16-character key from KNET portal
- It must be exactly 16 UTF-8 characters (128 bits)

### 3C. Troubleshoot

| Issue | Fix |
|-------|-----|
| `"Invalid encryption key length"` | Key must be exactly 16 characters |
| `"Encryption failed"` | Check key has no extra spaces or encoding issues |
| Server won't start | Check Node.js version (need v18+) and dependency installs |

---

## STEP 4: Test Payment Initiation Flow

Now test creating a payment request:

### 4A. Initiate Payment Request

**Using cURL:**

```bash
curl -X POST http://localhost:3000/api/knet/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER-001",
    "amount": "100.000",
    "customerEmail": "test@example.com",
    "customerName": "Test Customer",
    "productDescription": "Flower Delivery",
    "deliveryZone": "AlFahidi"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "trackId": "ABC123DEF456...",
  "paymentUrl": "https://kpaytest.com.kw/kpg/PaymentHTTP.htm?param=paymentInit&trandata=...",
  "orderId": "ORDER-001",
  "amount": 100.000,
  "mode": "test"
}
```

### 4B. Visit Payment URL in Browser

1. Copy the `paymentUrl` from the response
2. Open it in a browser
3. You should be redirected to **KNET Payment Page**

If you get an error:
- Check your `KNET_CALLBACK_URL` is publicly accessible
- Verify HTTPS certificate is valid
- Check KNET portal for IP whitelist / domain restrictions

---

## STEP 5: Test Complete Payment Flow

### 5A. Set Up Test Card

KNET provides test credit card numbers. Get them from:
- KNET Portal → Test Cards, OR
- Email: `PGSupport@knet.com.kw` asking for test card numbers

Common test cards:
```
Visa:       4111111111111111
Mastercard: 5555555555554444
```

### 5B. Complete Test Payment

1. Go to payment URL (from Step 4B)
2. Enter test card number
3. Fill in cardholder details (any name works)
4. Enter any 3-digit CVV
5. Choose any expiry date (in future)
6. Click **Pay**

### 5C. Check Callback

After payment:
- KNET should redirect back to your callback URL
- Check server logs for:
  ```
  [KNET] Callback received: trackId=..., orderId=ORDER-001, code=000
  [KNET] Payment successful: ...
  ```

If redirect fails:
- Check `KNET_CALLBACK_URL` is correct and publicly accessible
- Verify HTTPS works: `curl -I https://lilyserve.com/api/knet/callback`
- Check firewall allows KNET IPs to access your server

---

## STEP 6: Verify Payment in Database

After successful payment, check that order is marked as paid:

**In Supabase:**
```sql
SELECT * FROM bookings 
WHERE order_id = 'ORDER-001';
```

Expected: `payment_status = 'paid'` (after Phase 2 implementation)

---

## Test Scenarios Checklist

Test these scenarios to ensure reliability:

### Scenario 1: Successful Payment (Code 000)
- [ ] Card: `4111111111111111` (Visa test)
- [ ] Payment accepted
- [ ] Redirect to success URL
- [ ] Logs show code `000`
- [ ] Order marked paid in database

### Scenario 2: Declined Card
- [ ] Use card: `5105105105105100` (Declined test card, if available)
- [ ] OR enter wrong CVV on valid test card
- [ ] Payment rejected with code (e.g., `003`)
- [ ] Redirect to error URL
- [ ] Logs show failure code
- [ ] Order remains unpaid in database

### Scenario 3: Invalid Amount
- [ ] Try amount: `0.001` (too small)
- [ ] Should either be rejected or accepted (depends on KNET limits)
- [ ] Check error response

### Scenario 4: Duplicate Callback
- [ ] Manually POST same encrypted response twice
- [ ] Second request should be idempotent (no double charge)
- [ ] Server should log "Duplicate callback"

### Scenario 5: Invalid Signature
- [ ] Tamper with encrypted response (change 1 hex character)
- [ ] Callback should be rejected with decryption error
- [ ] Logs should show security alert

---

## Production Checklist (After Testing)

Once testing passes, prepare for production:

- [ ] Terminal Resource Key extracted ✅
- [ ] Encryption/decryption tested ✅
- [ ] Payment flow tested with test card ✅
- [ ] All test scenarios passed ✅
- [ ] Callback URL configured in KNET portal ✅
- [ ] HTTPS certificate valid and auto-renewing
- [ ] Server monitoring/alerting enabled
- [ ] Database backup configured
- [ ] Production KNET credentials obtained from bank
- [ ] Swap to production mode: `KNET_MODE=production`
- [ ] Perform 5-10 test transactions with production creds
- [ ] Announce to customers

---

## Troubleshooting

### Server won't start
```bash
# Check syntax errors
node --check server.js

# Check dependencies
npm list crypto express

# Reinstall if needed
npm install
```

### Encryption test fails
```
"Invalid encryption key length: X bytes. Expected 16 bytes"
```
- Your key is not exactly 16 UTF-8 characters
- Verify in KNET portal → copy full value (no spaces)
- Test with known good key: `ABCDEFGHIJKLMNOP` (16 chars)

### Payment URL returns error
```
"Invalid Merchant ID" or "Invalid Terminal"
```
- Check `KNET_TERMINAL_ID` matches KNET portal
- Verify Merchant ID in request (`6595`)
- Check Tranportal password is correct

### Callback not received
```
Payment page hangs after "Processing..."
```
- Check callback URL is HTTPS and publicly accessible
- Test: `curl -I https://lilyserve.com/api/knet/callback`
- Ask KNET to whitelist your IP (if required)
- Check firewall rules

---

## Next Steps

Once all tests pass:

1. **Phase 2:** Build Shopify integration layer
   - Connect Shopify checkout to KNET payment
   - Auto-update Shopify order status on successful payment
   
2. **Phase 3:** Database updates
   - Add payment fields to bookings table
   - Implement payment status tracking
   - Add logging and monitoring

3. **Phase 4:** Go-Live
   - Swap to production KNET credentials
   - Final security review
   - Deploy to production server
   - Notify customers

---

## Support Contacts

**KNET Support Email:** `PGSupport@knet.com.kw`

**What to ask KNET:**
- Terminal Resource Key (if not in portal)
- Test credit card numbers
- Production credentials and go-live process
- Callback URL whitelist requirements
- Any encryption/decryption issues

---

**Created:** May 12, 2026  
**Last Updated:** May 12, 2026  
**Status:** Ready for Testing
