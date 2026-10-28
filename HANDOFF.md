# AgentCart AI — Milestone Handoff Document

**Current Milestone:** Explicit Multi-Currency Architecture & Gateway Synchronization  
**Date:** October 28, 2026  
**Platform Version:** v2.8.0  

---

## 1. Executive Summary: Multi-Currency Separation & Synchronization

### Key Architecture Decisions:
1. **USD Payment Gateway Processing:**
   - PayPal Sandbox Orders v2 API processes transactions strictly in **`USD`** to comply with PayPal's platform rules (domestic INR processing is disallowed on standard accounts).
2. **Explicit Dual-Currency Ledger in SQLite:**
   - The database maintains full integrity between catalog merchandise pricing and gateway charges:
     - `subtotal`, `delivery_fee`, `total_amount`, and `currency: 'INR'` preserve the exact store merchandise amounts in **`INR`**.
     - `charged_amount REAL` (e.g. `25.28`) and `charged_currency TEXT` (`'USD'`) store the actual gateway charge submitted to and verified by PayPal.
     - Amounts are never conflated, mislabeled, or overwritten.
3. **Unified Single-Source Exchange Rate:**
   - Both backend and frontend consume `INR_TO_USD_RATE = 85` from [`server/config.js`](file:///D:/AgentCart-AI/server/config.js) and `GET /api/config`.
   - Marked clearly as a fixed demonstration exchange rate ($1 USD = ₹85 INR), not a floating live rate.
4. **Zero-Drift Penny Breakdown:**
   - Frontend (`calculateCartTotals()`) and backend (`createPayPalSandboxOrder()`) compute line items using identical unit rounding (`Number((unit_price / 85).toFixed(2))`).
   - The cart drawer, checkout modal, PayPal popup, and receipt all agree on the exact same cent.

---

## 2. Root Cause Diagnostics & Solutions Applied

| Issue Encountered | Diagnosis / Evidence | Solution Implemented |
| :--- | :--- | :--- |
| **Seller Self-Payment Block** | PayPal popup displays: *"You are logging in to the account of the seller for this purchase..."* Active session cookies for `sb-oaffh53089456@business.example.com` contaminate the popup. | Bound `payer: { email_address }` to personal buyer `sb-lg72c53550049@personal.example.com`; pre-filled checkout form; added prominent notice to use an Incognito / Private window. |
| **Currency Rejection (INR)** | HTTP 422: `CURRENCY_NOT_ALLOWED` from PayPal Orders v2 API when requesting domestic INR. | Configured `PAYPAL_CURRENCY=USD` across `.env`, Orders v2 payload, and frontend SDK injection URL. |
| **Premature Capture Call** | HTTP 422: `ORDER_NOT_APPROVED` (Debug-ID: `ca51a70a46b45`) when capture is invoked before payer authorizes the popup. | Capture endpoint properly verifies authorization and logs sanitized debug IDs without leaking secrets. |
| **Rounding Drift** | Potential HTTP 422 `MISMATCH_OF_ITEM_TOTAL` if item totals and breakdown differ by $0.01. | Synchronized item unit conversion calculation between frontend and backend. |

---

## 3. How to Test the Checkout Successfully

### Critical Testing Rule
> ⚠️ **Always use an Incognito / Private window** to test PayPal checkout!  
> This ensures that your active developer dashboard session (`developer.paypal.com`) does not contaminate the buyer popup.

### Step-by-Step Testing Flow:
1. Open an **Incognito / Private Window** in your browser.
2. Navigate to **`http://localhost:3000`**.
3. Add any jacket (e.g. *CyberShell Pro Stormbreaker*) to your bag.
4. Open the floating cart drawer in the top right and click **Proceed to Checkout**.
5. Review the checkout summary:
   - Verified Total indicates the exact USD amount (e.g. `$25.28 USD`) alongside the merchandise estimate `(₹2,149)`.
6. Click the yellow **PayPal** button.
7. In the PayPal popup, log in with your Personal Sandbox Buyer Account:
   - Email: `sb-lg72c53550049@personal.example.com`
   - Password: `[Your Personal Sandbox password]`
8. Click **Pay Now** / **Complete Purchase**.
9. The popup closes, and the confirmation screen renders:
   - Status: `● PAID (PayPal Sandbox Verified)`
   - Total Charged: `$25.28 USD (₹2,149)`
   - PayPal Capture ID: `2GG...`
   - Delivery Address & Itemized Receipt.
10. Verify that SQLite contains the updated order record with `currency = 'INR'`, `total_amount = 2149`, `charged_currency = 'USD'`, and `charged_amount = 25.28`.

---

## 4. Test Suite Verification
Run the automated test suite:
```powershell
npm test
```
Result: **29/29 tests passed (100.0%)** across database catalog integrity, pricing validation, server security, AI stylist, and PayPal Sandbox order lifecycle.
