# Project State: AgentCart AI

**Current Status:** Explicit Multi-Currency Architecture (Shared Rate, USD PayPal Sandbox Gateway, INR SQLite Merchandise Ledger) Verified & Active  
**Date:** October 28, 2026  
**Platform Version:** v2.8.0 (Unified Currency & Gateway Synchronization Edition)

---

## 1. Unified Multi-Currency Architecture

### 🔍 System Architecture & Separation of Concerns:
1. **Local Merchandise Ledger (INR):**
   - Base product prices, catalog definitions, and internal store accounting operate strictly in **`INR`** (`₹`).
   - SQLite orders table stores `subtotal`, `delivery_fee`, `total_amount`, and `currency: 'INR'`.
   - Merchandise amounts are never overwritten by gateway converted values.
2. **Payment Gateway Ledger (USD):**
   - PayPal Sandbox Orders v2 API processes transactions exclusively in **`USD`** (`$`) to avoid PayPal's domestic INR restriction (`CURRENCY_NOT_ALLOWED` / `CURRENCY_NOT_SUPPORTED`).
   - Order records in SQLite store `charged_amount REAL` (e.g. `25.28`) and `charged_currency TEXT` (`'USD'`) separately from the INR merchandise fields.
   - The PayPal SDK, order creation payload, capture verification, and order confirmation receipt all agree on the exact USD figure charged.
3. **Single Source of Truth Exchange Rate:**
   - Defined in [`server/config.js`](file:///D:/AgentCart-AI/server/config.js):
     - `INR_TO_USD_RATE = Number(process.env.INR_TO_USD_RATE) || 85` (fixed demonstration rate: 1 USD = 85 INR; not a live floating market rate).
     - `PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || 'USD').trim().toUpperCase()`.
   - Shared with the frontend dynamically via `GET /api/config` (`inr_to_usd_rate` and `usd_exchange_rate`).
   - Documented in [`.env`](file:///D:/AgentCart-AI/.env) and [`.env.example`](file:///D:/AgentCart-AI/.env.example).
4. **Penny Rounding Drift Prevention:**
   - Frontend (`calculateCartTotals()` in [`app.js`](file:///D:/AgentCart-AI/app.js)) and backend (`createPayPalSandboxOrder()` in [`server/paypal.js`](file:///D:/AgentCart-AI/server/paypal.js)) compute USD line items at unit level (`Number((price / rate).toFixed(2))`) and aggregate item totals.
   - Eliminates single-penny discrepancies (`MISMATCH_OF_ITEM_TOTAL`) between the cart drawer, checkout modal, PayPal popup, and capture response.
   - Client never sends prices or totals; all calculations are strictly enforced server-side.

---

## 2. PayPal Sandbox Error Diagnostics & Sanitize Root-Cause Log

| Diagnostic Case | API / Response Code | Root Cause | Solution Implemented |
| :--- | :--- | :--- | :--- |
| **Seller Self-Payment Block** | UI Error: *"You are logging in to the account of the seller for this purchase..."* | Browser profile had active session cookies for the sandbox seller merchant (`sb-oaffh53089456@business.example.com`). PayPal blocks merchants from purchasing from themselves. | Explicit buyer pre-fill (`sb-lg72c53550049@personal.example.com`), `payer: { email_address }` payload binding, and clear UI instructions to use an Incognito/Private window. |
| **Currency Not Supported** | HTTP 422: `CURRENCY_NOT_ALLOWED` | PayPal REST Orders v2 API rejects standard accounts attempting to transact domestic INR. | Configured transaction currency strictly to `USD` across server, SDK URL, and Orders v2 request while keeping INR estimates for display. |
| **Capture Prior to Payer Approval** | HTTP 422: `ORDER_NOT_APPROVED` (Debug-ID: `ca51a70a46b45`) | Calling `/v2/checkout/orders/{id}/capture` before the buyer has authorized the payment in the PayPal popup. | Order lifecycle requires client approval callback (`onApprove`) before backend triggers capture. Sanitized diagnostics log debug ID and actionable reason. |
| **Item Breakdown Rounding Drift** | HTTP 422: `MISMATCH_OF_ITEM_TOTAL` | Converting order total instead of summing converted line items caused 1-cent differences between `breakdown.item_total` and items array. | Both frontend and backend sum itemized `unit_price / rate` figures before assembling the payload. |

---

## 3. Verified Automated Test Suite Status

Executed `npm test` ([`tests/run_tests.js`](file:///D:/AgentCart-AI/tests/run_tests.js)):
- **Database & Catalog Integrity:** 3/3 passed
- **Search, Filter & Sort:** 3/3 passed
- **Server-Side Pricing & Security Validation:** 5/5 passed (tampering rejection, free delivery threshold, quantity guards)
- **AI Recommender:** 2/2 passed
- **PayPal Sandbox Checkout Engine:** 9/9 passed (order creation, experience context, debug ID reporting, capture verification, dual-currency storage verification, duplicate capture guard)
- **Live HTTP Endpoints:** 7/7 passed (config currency, secret redaction, catalog, AI, create-order, capture-order, cancel-order, demo fallback)
- **Total:** 29/29 passed (100.0%)

---

## 4. Modified Files Manifest

- [`server/config.js`](file:///D:/AgentCart-AI/server/config.js): Created single source of truth for exchange rates (`INR_TO_USD_RATE = 85`), PayPal transaction currency (`PAYPAL_CURRENCY = 'USD'`), and shipping constants.
- [`server/schema.sql`](file:///D:/AgentCart-AI/server/schema.sql): Added explicit `charged_amount REAL` and `charged_currency TEXT DEFAULT 'USD'` columns to `orders` table.
- [`server/db.js`](file:///D:/AgentCart-AI/server/db.js): Added backward-compatible SQLite migration for existing databases and updated `createOrder` to persist gateway charge metadata.
- [`server/paypal.js`](file:///D:/AgentCart-AI/server/paypal.js): Replaced duplicated rate with `config.INR_TO_USD_RATE`; updated `createPayPalSandboxOrder`, `capturePayPalSandboxOrder`, and `recordDemoSimulationOrder` to save and verify `charged_amount` and `charged_currency`.
- [`server/server.js`](file:///D:/AgentCart-AI/server/server.js): Updated `GET /api/config` to expose `inr_to_usd_rate` and `usd_exchange_rate` to clients.
- [`.env`](file:///D:/AgentCart-AI/.env) & [`.env.example`](file:///D:/AgentCart-AI/.env.example): Added explicit `INR_TO_USD_RATE=85` configuration.
- [`app.js`](file:///D:/AgentCart-AI/app.js): Dynamically synchronized `USD_RATE` with server configuration; implemented `calculateCartTotals()` for zero-drift alignment with PayPal v2 breakdown; updated confirmation modal to render explicit charged USD amount alongside INR merchandise total.
- [`tests/run_tests.js`](file:///D:/AgentCart-AI/tests/run_tests.js): Added assertions verifying dual currency storage (`currency: 'INR'`, `charged_currency: 'USD'`, `inr_to_usd_rate: 85`).
- [`PROJECT_STATE.md`](file:///D:/AgentCart-AI/PROJECT_STATE.md): Documented architecture, diagnostics, and testing verification.
- [`HANDOFF.md`](file:///D:/AgentCart-AI/HANDOFF.md): Updated testing guide and multi-currency ledger documentation.
