# Project State: AgentCart AI

**Current Status:** Dual Currency Experience (USD Primary + INR Secondary, PayPal USD Processing) Verified & Active  
**Date:** October 27, 2026  
**Platform Version:** v2.7.0 (Dual Currency & Global Checkout Edition)

---

## 1. Dual Currency Architecture (USD Primary + INR Secondary)

### 🔍 User Requirement & PayPal Restriction:
- **PayPal Restriction:** PayPal REST Orders v2 API does not support `INR` (`CURRENCY_NOT_SUPPORTED` 422 error / `This seller doesn't accept payments in your currency`). All international orders charged through standard PayPal accounts must use a supported transaction currency such as `USD`.
- **User Experience Requirement:** Present pricing in USD prominently as primary currency across the entire website, while clearly displaying the INR estimate beside it (e.g. `$23.52 (₹1,999)`). When checking out, payment is processed strictly in USD (`$1 USD = ₹85 INR`).

### 🛠️ Frontend & Design Implementation:
1. **Consistent Dual Price Formatting:**
   - Implemented helper functions `usd(n)`, `inr(n)`, `dualPrice(n)` (with `<span class="dual-inr">(₹...)</span>`), and `dualPricePlain(n)` in [`app.js`](file:///D:/AgentCart-AI/app.js).
   - Styled `.dual-inr` in [`styles.css`](file:///D:/AgentCart-AI/styles.css) with subtle secondary opacity and muted tones so the primary USD price stands out cleanly while keeping the INR value immediately visible.
2. **Comprehensive Dual Pricing Coverage:**
   - **Hero Flagship Card & Specs:** Shows `$23.52 (₹1,999)` and Free Delivery threshold `$24 / ₹2,000+`.
   - **Product Catalogue Grid:** Every product card renders prominent USD bold price accompanied by `(₹...)`.
   - **Product Details Modal:** Main price renders prominent `$XX.XX` with adjacent `(₹...)` and strike-through original comparison price.
   - **Filter Price Slider & Reset:** Displays `$58.82 (₹5,000)` max range.
   - **Cart Drawer:** Line items, subtotal, delivery fee, and grand total show dual pricing; checkout button emphasizes `Proceed to Checkout ($XX.XX USD)`.
   - **Checkout Modal:** Subtotal, delivery fee, and verified total clearly indicate USD payment (`Verified Total (Charged in USD)`).
   - **Comparison Matrix:** Comparison table displays dual prices for each selected jacket.
   - **AI Stylist:** Identified budget constraints and recommendation cards render dual USD/INR amounts.
   - **Order Confirmation Receipt:** Purchased items and grand total render in USD with INR beside it, accompanied by the PayPal capture ID.

---

## 2. PayPal Sandbox Debugging & Root Cause Analysis

### 🔍 Specific Error Investigation:
> “You are logging in to the account of the seller for this purchase. Please change your login information and try again.”

1. **Payee & Merchant Verification:**
   - **Backend Client ID:** `AcDu4sttyx2W1pJEH7djvFyCNwCwXkllBoMo4KQETR2AWOOma53MyxBr-YKEm4rpYPsJSL9HIpNjw6MU`
   - **Order Payee / Merchant Account:** `sb-oaffh53089456@business.example.com` (Merchant ID: `XA5BTBFB5K7ME`)
   - **Customer Buyer Account:** `sb-lg72c53550049@personal.example.com` (Type: Personal Buyer)
   - **Root Cause Confirmed:** The error occurred because the browser previously had active session cookies for `sb-oaffh53089456@business.example.com` (from logging into `developer.paypal.com`), causing PayPal's popup to automatically bind to the merchant session instead of initiating a fresh buyer login.

2. **Fixes Applied:**
   - **Explicit Payer Binding:** Added `payer: { email_address: order.customer_email }` in [`server/paypal.js`](file:///D:/AgentCart-AI/server/paypal.js) so PayPal's popup pre-populates and binds the order to the buyer account (`sb-lg72c53550049@personal.example.com`).
   - **Pre-filled Checkout Email:** Updated [`index.html`](file:///D:/AgentCart-AI/index.html) to pre-fill the customer email with `sb-lg72c53550049@personal.example.com`.
   - **Updated Guidance Banner:** Updated the UI banner in [`app.js`](file:///D:/AgentCart-AI/app.js) with explicit instructions to test in an Incognito/Private window (or log out of `sandbox.paypal.com`).
   - **Security Guarantee:** Never log or display secrets, buyer passwords, or access tokens in terminal output, codebase, or git history.

---

## 3. Verified Automated Test Suite Status

Executed `npm test` (`tests/run_tests.js`):
- **Database & Catalog Integrity:** 3/3 passed
- **Search, Filter & Sort:** 3/3 passed
- **Server-Side Pricing & Quantity Security:** 5/5 passed (including negative, float, and non-numeric quantity guards)
- **AI Recommender:** 2/2 passed
- **PayPal Sandbox Checkout Engine:** 9/9 passed (order creation with `experience_context`, capture verification, declined payment, duplicate capture prevention, debug ID tracking)
- **Live HTTP Endpoints:** 7/7 passed (including config, currency consistency, and order receipts)
- **Total:** 29/29 passed (100.0%)

---

## 4. Modified Files Manifest

- [`app.js`](file:///D:/AgentCart-AI/app.js): Standardized all price rendering to prominent USD with INR secondary (`dualPrice`, `dualPricePlain`), updated checkout summary, modal pricing, cart drawer, AI stylist cards, comparison matrix, and confirmation modal.
- [`styles.css`](file:///D:/AgentCart-AI/styles.css): Added `.dual-inr` styling, flex baseline alignment for price rows, and modal pricing typography adjustments.
- [`index.html`](file:///D:/AgentCart-AI/index.html): Updated hero showcase, spotlight badge, prompt pills, filter notices, checkout headers, and footer notes to reference USD ($) and INR (₹).
- [`server/paypal.js`](file:///D:/AgentCart-AI/server/paypal.js): Preserved USD currency calculation ($1 = ₹85), `payment_source.paypal.experience_context`, safe debug-id logging, and buyer pre-fill.
- [`PROJECT_STATE.md`](file:///D:/AgentCart-AI/PROJECT_STATE.md): Documented architecture and testing status.
- [`HANDOFF.md`](file:///D:/AgentCart-AI/HANDOFF.md): Updated handoff with checkout validation steps.
