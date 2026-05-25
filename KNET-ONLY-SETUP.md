# KNET-Only Project Setup and Test Guide

This project is now scoped to **KNET integration and payment flow only**.

## 1) Current Flow

1. Customer opens `knet-checkout.html`.
2. Checkout page sends `POST /api/knet/initiate-payment`.
3. Server builds encrypted KNET request and returns `paymentUrl`.
4. Customer is redirected to KNET hosted payment page.
5. KNET posts response to `POST /api/knet/callback`.
6. Server validates response and returns `REDIRECT=<url>`.

## 2) Required Environment Variables

Create or update `.env` in the project root with:

```env
PORT=3000
KNET_MODE=test
KNET_ENCRYPTION_KEY=YOUR_16_BYTE_KEY
KNET_TERMINAL_ID=YOUR_TERMINAL_ID
KNET_TERMINAL_PASSWORD=YOUR_TERMINAL_PASSWORD
KNET_CALLBACK_URL=https://your-domain.com/api/knet/callback
KNET_ERROR_URL=https://your-domain.com/payment-error
KNET_ALLOWED_ORIGINS=http://localhost:3000
```

Notes:
- `KNET_ENCRYPTION_KEY` must be exactly 16 bytes.
- In local testing, if callback cannot hit localhost directly, use a tunnel URL (for example ngrok) for callback and error URLs.

## 3) Run Locally

Install dependencies (once):

```bash
npm install
```

Start server:

```bash
npm start
```

Open:
- `http://localhost:3000/` (KNET Integration Hub)
- `http://localhost:3000/knet-checkout.html`

## 4) Quick Health Check

Open in browser:

- `http://localhost:3000/api/health`

Expected JSON:

```json
{ "ok": true, "service": "knet-integration", "timestamp": "..." }
```

## 5) API Test (Initiate Payment)

Use this PowerShell command:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/knet/initiate-payment" -ContentType "application/json" -Body '{"orderId":"ORDER-1001","amount":"1.000","customerEmail":"test@example.com","customerName":"Test User","productDescription":"KNET Test","deliveryZone":"Kuwait"}'
```

Expected response fields:
- `success: true`
- `trackId`
- `paymentUrl`

Open returned `paymentUrl` in browser to continue on KNET.

## 6) Encryption Self-Test

Run:

```bash
npm run test:knet
```

This validates:
- AES encryption/decryption
- KNET request generation
- Callback parsing/validation logic

## 7) Callback Test Tips

For full callback testing from KNET:
1. Expose local server publicly (for example: `ngrok http 3000`).
2. Set:
   - `KNET_CALLBACK_URL=https://<public-url>/api/knet/callback`
   - `KNET_ERROR_URL=https://<public-url>/payment-error`
3. Restart server.
4. Initiate payment and complete test transaction.
5. Confirm callback logs in server console.

## 8) What Was Removed

Booking-related files removed:
- `admin-panel.html`
- `booking-widget-v2.html`
- `checkout-redirect.js`
- `backup.js`
- `SHOPIFY-WEBHOOK-SETUP.md`

Core KNET files kept:
- `server.js`
- `knet-checkout.html`
- `knet/`
- `knet-test.js`
- `templates/page.knet-checkout.liquid`
- `KNET-*.md` docs
