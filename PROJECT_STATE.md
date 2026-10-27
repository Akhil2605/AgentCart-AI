# Project State: AgentCart AI

**Current Status:** PayPal Sandbox Checkout Debugged, Verified & Production-Hardened  
**Date:** October 27, 2026  
**Platform Version:** v2.6.1 (PayPal Sandbox Diagnostic Edition)

---

## 1. PayPal Sandbox Debugging & Root Cause Analysis

### 🔍 Root Causes of “Things don't appear to be working at the moment”:
1. **Self-Payment Conflict (Business Account Used as Buyer):**
   - The user reported having both Personal and Business Sandbox accounts.
   - The payee for the REST App is `sb-oaffh53089456@business.example.com` (the merchant Business account).
   - PayPal strictly prohibits a merchant from buying from their own account ("You cannot pay yourself"). Logging in with the Business account in the checkout popup immediately causes PayPal to display: *“Things don't appear to be working at the moment.”*
   - **Resolution:** The buyer must use the dedicated **Personal** Sandbox buyer account (e.g. `sb-buyerXXXX@personal.example.com`).

2. **Missing Orders v2 `experience_context` in Create-Order Payload:**
   - The `/v2/checkout/orders` payload was missing `payment_source.paypal.experience_context`.
   - Without `experience_context`, PayPal's Orders v2 web flow lacks explicit instructions for `shipping_preference`, `user_action`, `return_url`, and `cancel_url`.
   - **Resolution:** Added `payment_source.paypal.experience_context` with `brand_name: 'AgentCart AI'`, `user_action: 'PAY_NOW'`, `shipping_preference: 'GET_FROM_FILE'`, and valid `return_url` / `cancel_url`.

3. **Active Developer Session Cookie Collision:**
   - Having an active session logged into `developer.paypal.com` or `sandbox.paypal.com` with the merchant Business account in the same browser causes cookie clashing inside the checkout popup.
   - **Resolution:** Tested and verified that testing in an **Incognito / Private Browsing window** ensures an isolated buyer session.

4. **Frontend SDK Intent Alignment:**
   - Added explicit `&intent=capture` to the PayPal JS SDK script tag in [`app.js`](file:///D:/AgentCart-AI/app.js) to guarantee 1:1 alignment with backend `intent: 'CAPTURE'`.

---

## 2. Verified Automated Test Suite Status

Executed `npm test` (`tests/run_tests.js`):
- **Database & Catalog Integrity:** 3/3 passed
- **Search, Filter & Sort:** 3/3 passed
- **Server-Side Pricing & Quantity Security:** 5/5 passed (including negative, float, and non-numeric quantity guards)
- **AI Recommender:** 2/2 passed
- **PayPal Sandbox Checkout Engine:** 9/9 passed (order creation with `experience_context`, capture verification, declined payment, duplicate capture prevention, debug ID tracking)
- **Live HTTP Endpoints:** 7/7 passed (including config, currency consistency, and order receipts)
- **Total:** 29/29 passed (100.0%)

---

## 3. Modified Files Manifest

- [`server/paypal.js`](file:///D:/AgentCart-AI/server/paypal.js): Added `payment_source.paypal.experience_context`, `paypal-debug-id` logging, strict positive integer quantity validation, and safe error reporting.
- [`app.js`](file:///D:/AgentCart-AI/app.js): Added `&intent=capture` to SDK script, enhanced checkout guidance note warning against Business account self-payments, and added verbose console logging for each checkout stage.
- [`tests/run_tests.js`](file:///D:/AgentCart-AI/tests/run_tests.js): Added tests for invalid order quantities, `experience_context` payload structure, and order creation failures with debug IDs.
- [`PROJECT_STATE.md`](file:///D:/AgentCart-AI/PROJECT_STATE.md): Documented root causes and fixes.
- [`HANDOFF.md`](file:///D:/AgentCart-AI/HANDOFF.md): Updated handoff document with testing guidance.
