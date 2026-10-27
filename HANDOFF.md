# AgentCart AI — Milestone Handoff Document

**Current Milestone:** PayPal Sandbox Debugging & Diagnostic Hardening Complete  
**Date:** October 27, 2026  
**Platform Version:** v2.6.1  

---

## 1. Executive Summary & Root Cause Investigation

When testing PayPal Sandbox checkout, the error:  
> **“Things don't appear to be working at the moment. Please try again later and go back to the merchant.”**

is PayPal's catch-all message in the Sandbox modal. We investigated and resolved the underlying issues:

### Root Causes Confirmed:
1. **Self-Payment via Business Account:**
   The REST App credentials configured in `.env` are owned by the **Business** account (`sb-oaffh53089456@business.example.com`). When a developer attempts to log into the PayPal checkout popup using that Business account (or any Business account acting as the payee), PayPal strictly blocks the self-purchase with that generic error message. Purchases must be made with a **Personal** Sandbox account.
2. **Missing Orders v2 `experience_context`:**
   In PayPal Orders v2 API, creating an order without `payment_source.paypal.experience_context` causes PayPal's modern checkout UI to miss required parameters (`shipping_preference`, `user_action`, `return_url`, and `cancel_url`), leading to session crashes in the popup.
3. **Browser Cookie / Session Collision:**
   If you have `developer.paypal.com` or `sandbox.paypal.com` open in the same browser, active cookies from the Business account clash with the Personal buyer account session inside the popup.

---

## 2. Changes Implemented

1. **`server/paypal.js`:**
   - Injected `payment_source.paypal.experience_context` into the Orders API payload with `brand_name: 'AgentCart AI'`, `locale: 'en-US'`, `shipping_preference: 'GET_FROM_FILE'`, `user_action: 'PAY_NOW'`, `return_url: 'http://localhost:3000/#paypal-return'`, and `cancel_url: 'http://localhost:3000/#paypal-cancel'`.
   - Added safe diagnostic logging extracting PayPal's internal `paypal-debug-id` header on both create-order and capture-order requests.
   - Added strict positive integer validation for item quantities and positive numeric validation for catalog prices.
   - Enforced 3-letter currency sanitization.

2. **`app.js`:**
   - Added `&intent=capture` parameter to the dynamic PayPal JS SDK script URL.
   - Added a clear guidance notice inside the checkout modal warning testers to use their **Personal** Sandbox Buyer account and test in an **Incognito / Private** window to avoid cookie clashing.
   - Added debug console logs for `createOrder`, `onApprove`, `onCancel`, and `onError`.

3. **`tests/run_tests.js`:**
   - Added focused tests for invalid quantities (negative, fractional, non-numeric).
   - Added test for `experience_context` payload integrity and return/cancel URLs.
   - Added test for order creation failure with debug ID tracking.
   - 29/29 tests pass (100%).

---

## 3. How to Test the Checkout Successfully

### Critical Testing Rule
> ⚠️ **Always use an Incognito / Private window** to test the checkout!  
> This ensures that your active login on `developer.paypal.com` (your Business account) does not contaminate the checkout popup.

### Step-by-Step Testing Guide:
1. Open an **Incognito / Private Window** in your browser.
2. Navigate to **`http://localhost:3000`**.
3. Click on any jacket (e.g. *CyberShell Pro Stormbreaker*) and click **Add to Bag**.
4. Open the floating cart in the top right and click **Proceed to Checkout**.
5. Click the yellow **PayPal** button.
6. In the PayPal popup, log in with your **Personal Sandbox Account**:
   - Go to [PayPal Developer Dashboard > Sandbox Accounts](https://developer.paypal.com/dashboard/accounts).
   - Locate the account of type **Personal** (e.g. `sb-buyerXXXX@personal.example.com`).
   - Click `...` > **View/Edit account** to copy the system-generated password.
   - Enter that Personal email and password into the checkout popup.
7. Click **Complete Purchase** / **Pay Now**.
8. The popup will close and the order confirmation modal will display:
   - Status: `● PAID (PayPal Sandbox Verified)`
   - PayPal Capture ID: `2GG...`
   - Itemized purchase receipt and delivery address.

---

## 4. Diagnostic Logging
If any transaction encounters an error, the server terminal output will display:
```
[PayPal Diagnostics] Creating order for local ID: ORD-...
[PayPal Diagnostics] Intent: CAPTURE, Currency: USD, Subtotal: ..., Shipping: ..., Total: ...
[PayPal Diagnostics] Create order HTTP status: 200 (Debug-ID: ...)
[PayPal Diagnostics] Order created successfully. PayPal Order ID: ...
```
No API secrets, passwords, or customer tokens are ever logged.
