# KNET Integration — QUICK START SUMMARY

**Your Credentials:**
- Merchant ID: `6595`
- Terminal ID: `659501`
- Website: `https://lilyserve.com/`
- Encryption Files: `/Integration/resource.cgn` + `/Integration/keystore.bin`

**Your Setup Status:**
- ✅ KNET credentials provided
- ✅ HTTPS domain ready (lilyserve.com)
- ✅ Sample code available (JSP/PHP/ASPNET)
- ✅ Node backend exists (server.js)
- ✅ Shopify store connected
- ❓ STILL NEED: Tranportal password + encryption key extraction

---

## WHAT'S REQUIRED RIGHT NOW (BEFORE CODING)

### 1. ✅ Confirm KNET Encryption Key
**Status:** You have the FILES (`resource.cgn` + `keystore.bin`)  
**What's Missing:** The PLAINTEXT encryption key OR Java library to extract it

**Action:** Email KNET support:
```
To: PGSupport@knet.com.kw
Subject: Extract Terminal Resource Key for Merchant 6595 / Terminal 659501

Dear KNET Support,

Can you provide the Terminal Resource Key (termResourceKey) for:
- Merchant ID: 6595
- Terminal ID: 659501
- Environment: Test + Production

We have resource.cgn and keystore.bin files. Can you provide:
1. The plaintext encryption key (for AES-128-CBC encryption)
2. OR the Java library/method to extract from keystore.bin

Also confirm:
- Is the encryption algorithm AES-128-CBC with IV=Key?
- Are resource.cgn and keystore.bin for test or production?

Thank you,
[Your team]
```

### 2. ✅ Confirm Tranportal Password (Test vs Production)
**Status:** You have Terminal ID, but need password  
**What's Missing:** Test password + Production password from KNET

**Action:** Ask KNET for:
```
Test Environment:
- Test Terminal ID (if different from 659501)
- Test Tranportal Password
- Test KNET payment page URL

Production Environment:
- Production Terminal ID: 659501
- Production Tranportal Password (you likely have this from bank)
- Production KNET payment page URL
```

### 3. ✅ Verify HTTPS + Domain
**Status:** https://lilyserve.com/ — GOOD  
**What to Do:**
```bash
# Test in terminal:
curl -I https://lilyserve.com

# Should return:
# HTTP/1.1 200 OK
# Server: ...
# SSL certificate: VALID
```

### 4. ✅ Decide: Test vs Production First
**Recommendation:** START WITH TEST ENVIRONMENT
- Prevents live charges during development
- KNET provides test credit card numbers
- Your test credentials won't charge customers

**Timeline:**
1. **Week 1:** Use test creds → build & test endpoints
2. **Week 2:** Swap to production creds → final testing
3. **Week 3:** Go live with customer traffic

---

## IMPLEMENTATION APPROACH — 3 PHASES

### Phase 1: KNET Node Module (Days 1-2)
**What we'll build:**
```javascript
/knet/
├── encryption.js      // AES-128-CBC encrypt/decrypt
├── payment-client.js  // Build request strings
├── knet-routes.js     // Express endpoints
└── test-utils.js      // Helper functions
```

**New server.js endpoints:**
- `POST /api/knet/initiate-payment` → Start KNET payment flow
- `POST /api/knet/callback` → Receive KNET response
- `POST /api/knet/test` → Manually test encryption (dev only)

**Test method:**
```bash
# 1. In Postman/curl, call initiate-payment
curl -X POST https://lilyserve.com/api/knet/initiate-payment \
  -H "Content-Type: application/json" \
  -d '{"orderId": "test-123", "amount": "100.000"}'

# 2. Get back payment URL
# 3. Visit in browser → redirects to KNET test page
# 4. Enter test card → process payment
# 5. KNET POSTs back to /api/knet/callback
# 6. Check order status → should be marked PAID
```

### Phase 2: Shopify Integration (Days 3-4)
**What we'll build:**
```javascript
/shopify/
├── payment-app.js     // Shopify Payment App (optional)
└── order-updater.js   // Mark orders as paid via Admin API
```

**New server.js endpoints:**
- `POST /api/shopify/payment-gateway` → Handle KNET payment from Shopify checkout
- Update existing `/api/knet/callback` to mark Shopify order as paid

**Test method:**
- Create test order in Shopify dev store
- Proceed to payment → select KNET
- Complete payment → order status changes to "Paid"

### Phase 3: Database + Go-Live (Days 5+)
**Updates:**
- Add `knet_transaction_id`, `payment_method` to Supabase `bookings` table
- Add logging/monitoring for payment events
- Security audit + PCI compliance check
- Production deployment

---

## IMMEDIATE NEXT STEP

**I will now implement Phase 1** (KNET encryption + Node endpoints) using:
1. Node's built-in `crypto` module (AES-128-CBC)
2. The protocol details from JSP demo code
3. Your merchant/terminal IDs

**I will need you to provide:**
- [ ] Terminal Resource Key (encryption key)
- [ ] Test Tranportal Password
- [ ] Production Tranportal Password (optional, for later)

---

## FILE REFERENCE

**New files I'll create:**
| File | Purpose |
|------|---------|
| `knet/encryption.js` | AES encryption/decryption |
| `knet/payment-client.js` | KNET request builder |
| `knet/knet-routes.js` | Express routes |
| `knet/test-utils.js` | Testing helpers |
| `KNET-PROTOCOL.md` | ✅ Created (detailed spec) |
| `KNET-INTEGRATION-PLAN.md` | ✅ Created (full roadmap) |
| `KNET-QUICK-START.md` | ✅ This file |

**Files we're NOT modifying yet:**
- `server.js` — will add routes, not change core logic
- Database schema — minimal changes needed
- Shopify integration — Phase 2

---

## FAQ

**Q: Can we test without KNET test account?**
A: No. You need test credentials from KNET support. But setup is free.

**Q: How long does KNET support take to respond?**
A: Usually 24-48 hours for test creds, 2-5 days for production approval.

**Q: What if encryption key is in keystore.bin?**
A: We may need to run Java code to extract it, OR ask KNET for plaintext.

**Q: Can we use production creds immediately?**
A: Not recommended. Test first, verify, then go live.

**Q: What's the rollback plan if KNET payment fails?**
A: Show error message, customer can retry or use alternative payment method.

---

## SUCCESS CRITERIA

When Phase 1 is complete, you should be able to:
1. ✅ Start KNET payment from your Node server
2. ✅ Encrypt request using AES-128-CBC
3. ✅ Redirect customer to KNET payment page
4. ✅ Receive + decrypt KNET callback
5. ✅ Validate payment signature
6. ✅ Mark order as paid in Supabase

When Phase 2 is complete:
7. ✅ Shopify checkout shows KNET option
8. ✅ Customer can pay via KNET from Shopify
9. ✅ Shopify order auto-updates to "Paid"

---

**⏭️ READY TO IMPLEMENT?**

Send me:
1. Terminal Resource Key (encryption key)
2. Test Tranportal Password

And I'll start building Phase 1 immediately! 🚀
