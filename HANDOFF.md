# AgentCart AI — Milestone Handoff Document

**Current Milestone:** Dual Currency Experience (USD Primary + INR Secondary, PayPal USD Processing)  
**Date:** October 27, 2026  
**Platform Version:** v2.7.0  

---

## 1. Executive Summary: Dual Currency System

### Background & Reason for USD Processing:
- PayPal's Orders v2 API does not support `INR` (`CURRENCY_NOT_SUPPORTED` 422 error / `This seller doesn't accept payments in your currency`).
- To allow seamless PayPal Sandbox checkout while keeping the Indian market pricing context familiar, AgentCart AI now displays prices in **USD as the primary payment currency** with the **INR amount shown clearly beside it** (e.g. `$23.52 (₹1,999)`).
- When a customer checks out, the transaction is denominated and charged in USD at the fixed conversion rate (`$1 USD = ₹85 INR`).

### Implementation Details:
1. **Frontend Formatting:**
   - Every price on the site (product cards, modal, comparison matrix, AI recommendations, cart drawer, checkout modal, and confirmation receipt) displays USD bold and prominent, with the equivalent INR formatted in secondary text: `${usd(amount)} <span class="dual-inr">(${inr(amount)})</span>`.
   - Free Express Delivery is unlocked at `$24 USD (₹2,000+)`.
2. **Backend Order Processing:**
   - Server validates item prices strictly from SQLite catalog in INR, converts securely to USD with 2 decimal places, and creates the PayPal order with `currency_code: 'USD'`.
   - Never trusts price or currency parameters sent by the client.

---

## 2. Root Cause & Solution: Personal vs Business Sandbox Accounts

When testing PayPal Sandbox checkout, the error:  
> **“You are logging in to the account of the seller for this purchase. Please change your login information and try again.”**

occurs when PayPal detects that the account attempting to pay is the merchant/seller that created the order.

### Investigation & Account Verification:
- **Configured Seller / Payee Account:** `sb-oaffh53089456@business.example.com` (Merchant ID: `XA5BTBFB5K7ME`)  
  *This is the Business Sandbox account that owns the configured Client ID.*
- **Configured Buyer Account:** `sb-lg72c53550049@personal.example.com`  
  *This is a separate, valid Personal Sandbox Buyer account.*
- **The Mismatch / Issue:**  
  The two accounts are separate. The error occurs when the browser profile has active session cookies for the seller (`sb-oaffh53089456@business.example.com` or the main developer account) from `developer.paypal.com` or `sandbox.paypal.com`. When the PayPal popup opens, PayPal checks the active session cookies before the buyer login completes, triggering the seller self-payment block.

### Solutions Applied:
1. **Payer Binding:** Added `payer: { email_address: order.customer_email }` in [`server/paypal.js`](file:///D:/AgentCart-AI/server/paypal.js) so PayPal explicitly expects the personal buyer account (`sb-lg72c53550049@personal.example.com`).
2. **Pre-filled Checkout Email:** Updated [`index.html`](file:///D:/AgentCart-AI/index.html) so the checkout form automatically provides `sb-lg72c53550049@personal.example.com`.
3. **Session Isolation:** Provided clear instructions to test in an **Incognito / Private Window** (or log out of `sandbox.paypal.com` first) to eliminate seller cookie contamination.

---

## 3. How to Test the Checkout Successfully

### Critical Testing Rule
> ⚠️ **Always use an Incognito / Private window** to test the checkout!  
> This ensures that your active login on `developer.paypal.com` (your Business account) does not contaminate the checkout popup.

### Step-by-Step Testing Guide:
1. Open an **Incognito / Private Window** in your browser.
2. Navigate to **`http://localhost:3000`**.
3. Notice that all products display prices in **USD** prominently with the **INR** amount beside it (e.g. `$23.52 (₹1,999)`).
4. Click on any jacket (e.g. *CyberShell Pro Stormbreaker*) and click **Add to Bag**.
5. Open the floating cart in the top right and click **Proceed to Checkout**.
6. The verified total indicates the exact USD amount charged via PayPal. Click the yellow **PayPal** button.
7. In the PayPal popup, log in with your **Personal Sandbox Account**:
   - Email: `sb-lg72c53550049@personal.example.com`
   - Password: `[Your Personal Sandbox password]`
8. Click **Complete Purchase** / **Pay Now**.
9. The popup closes and the order confirmation modal displays:
   - Status: `● PAID (PayPal Sandbox Verified)`
   - Total Paid: `$XX.XX USD (₹X,XXX)`
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
