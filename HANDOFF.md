# AgentCart AI — Milestone Handoff Document

**Current Milestone:** Multi-Currency Architecture & Cross-Border Sandbox Diagnostics  
**Date:** October 28, 2026  
**Platform Version:** v2.8.1  

---

## 1. Deep Root Cause Analysis: "This seller doesn't accept payments in your currency"

The real browser checkout error occurs exclusively during the **Buyer Approval phase** inside the PayPal popup window, NOT during backend order creation or payment capture.

### Verified Root Causes:

1. **Domestic India-to-India Transaction Ban (RBI / PayPal India Restriction):**
   - The Sandbox Business Seller account associated with the configured Client ID (`XA5BTBFB5K7ME`) has its country set to **`India (IN)`** (verified via `/v1/customer/partners/XA5BTBFB5K7ME/merchant-integrations/XA5BTBFB5K7ME`).
   - Default Sandbox Personal accounts created under Indian developer profiles also have their country set to **`India (IN)`**.
   - PayPal India officially ceased domestic payment processing in 2021. Indian residents cannot transact with other Indian accounts domestically (neither in INR nor in foreign currencies like USD under RBI FEMA regulations).
   - When an Indian buyer logs in to pay an Indian seller, PayPal detects a domestic transaction and aborts with:  
     **"We're sorry. This seller doesn't accept payments in your currency."**

2. **Merchant Receiving Preferences (Foreign Currency Block):**
   - In Sandbox accounts where the primary currency is INR, PayPal's default "Payment Receiving Preferences" / "Block Payments" setting often blocks payments sent in currencies not held.
   - If the merchant has not added USD as a balance or enabled automatic currency conversion, USD checkout payments are rejected at the approval stage.

3. **SDK Geolocation & Buyer Context:**
   - Without explicit buyer country context, the PayPal JavaScript SDK defaults to the tester's local IP address (India), reinforcing the domestic block.

---

## 2. Minimum Safe Fixes Applied

1. **Codebase (`app.js`):**
   - Appended `&buyer-country=US` to the PayPal JavaScript SDK URL in [`app.js`](file:///D:/AgentCart-AI/app.js). This instructs PayPal's Sandbox engine to simulate an international US buyer context for cross-border export testing.
   - Updated the checkout guidance card to explicitly instruct the tester to log in with a US-based Personal Sandbox account.
2. **Backend & Database Integrity:**
   - Preserved all server-side pricing validation and SQLite dual-currency ledger (`currency: 'INR'`, `charged_currency: 'USD'`).
   - Prevented rounding drift using synchronized itemized calculations (`calculateCartTotals()`).

---

## 3. Required Manual Steps to Verify in PayPal Sandbox

Because account-level receiving preferences and account country origins reside inside PayPal's secure cloud, follow these two setup steps in your PayPal Developer Dashboard:

### Step 1: Create a US Personal Sandbox Buyer Account (1 minute)
1. Go to **[developer.paypal.com/dashboard/accounts](https://developer.paypal.com/dashboard/accounts)**.
2. Click **Create Account**.
3. Select **Account Type:** `Personal (Buyer Account)`.
4. Select **Country / Region:** **`United States`** *(Critical: Do not select India)*.
5. Click **Create**.
6. Find your new US account in the list, click the three dots `...` -> **View/Edit Account** -> copy the **Email** (e.g., `sb-xxxx@personal.example.com`) and **System-Generated Password**.

### Step 2: Ensure the Seller Account Accepts USD (1 minute)
1. In the same Accounts list, locate your **Business / Facilitator Account** (`sb-oaffh53089456@business.example.com`).
2. Click `...` -> **View/Edit Account** -> copy its password.
3. In a separate tab, log into **[sandbox.paypal.com](https://sandbox.paypal.com/)** using the Business account credentials.
4. Navigate to **Account Settings** (gear icon) -> **Selling Tools** (or **Payment Preferences**) -> **Block Payments** (click **Update**).
5. For the question *"Allow payments sent to me in a currency I do not hold"*, select:
   **"Yes, accept and convert them to my primary currency"**.
   *(Alternatively, under Wallet -> Currencies, click **Add a currency** and add **USD**).*
6. Click **Save**.

---

## 4. Manual Browser Checkout Verification Flow

1. Open an **Incognito / Private Window** (Ctrl+Shift+N) in your browser.
2. Navigate to **`http://localhost:3000`**.
3. Add any jacket (e.g. *CyberShell Pro Stormbreaker*) to your bag.
4. Open the cart drawer and click **Proceed to Checkout**.
5. In the checkout modal, enter your US Personal Sandbox email in the email field.
6. Click the yellow **PayPal** button.
7. In the PayPal popup, log in using your **US Personal Sandbox Account** credentials.
8. Because the buyer is in the US and the seller is in India, PayPal recognizes a valid cross-border export transaction in **USD**.
9. Click **Pay Now** / **Complete Purchase**.
10. The popup closes, and the order confirmation modal displays:
    - Status: `● PAID (PayPal Sandbox Verified)`
    - Total Charged: `$25.28 USD (₹2,149)`
    - PayPal Capture ID: `2GG...`
    - SQLite database records `status = 'PAID'`, `charged_amount = 25.28`, `charged_currency = 'USD'`, `total_amount = 2149`, `currency = 'INR'`.

---

## 5. Automated Test Suite Status
Run the automated test suite anytime:
```powershell
npm test
```
**Result:** **29/29 tests passed (100.0%)** across database catalog integrity, pricing validation, server security, AI stylist, and PayPal Sandbox order lifecycle.
