# Project State: AgentCart AI

**Current Status:** Reset Order History & Fresh Tracking Operational & Verified  
**Date:** October 31, 2026  
**Platform Version:** v3.4.0 (Fresh Order Tracking & Zero-State Metrics Edition)  
**Recovery Backup Location:** `D:\AgentCart-AI-backup-pre-reorg`  
**Database Location:** `D:\AgentCart-AI\database\agentcart.sqlite`  

---

## 1. Executive Summary & Capabilities Overview

AgentCart AI's order management and profile system has been reset to a completely clean, zero-baseline state for default user **Akhil** (`user_akhil`), while preserving all personal information, database structure, and the 24 technical jackets catalog.

All hardcoded backfilling of sample/demo historical orders has been eliminated. Starting from this point forward, every new order, payment, delivery update, and tracking stage is automatically and permanently tracked in SQLite.

| Metric / Capability | Reset State | Active Order Behavior | Verification |
| :--- | :--- | :--- | :--- |
| **Total Orders** | **0** | Increments by 1 on newly placed order | ✅ Verified in SQLite & UI |
| **Active Orders** | **0** | Reflects orders currently in processing or delivery | ✅ Verified across order lifecycle |
| **Delivered Orders** | **0** | Increments only when order reaches `DELIVERED` status | ✅ Verified with `actual_delivery_date` |
| **Total Spent (INR)** | **₹0** | Sum of successfully captured/paid orders only | ✅ Unpaid/cancelled orders excluded |
| **Total Spent (USD)** | **$0.00** | Sum of USD charged amounts for paid orders | ✅ Displays `$0.00` with 0 spent |
| **My Orders Tab** | **Empty** (`0`) | Renders newly placed order cards with thumbnails & tracking | ✅ Verified with empty & live states |
| **Payment History Tab** | **Empty** (`0`) | Renders verified transaction row upon order creation/capture | ✅ Verified with empty & live states |
| **Recent Activity** | **Empty** (`0`) | Displays up to 5 most recent orders dynamically | ✅ Verified dynamic update |
| **Default Profile** | **Preserved** | Akhil (`akhil@agentcart.ai`, Bengaluru, Karnataka, PIN 560038) | ✅ Fully intact & editable |
| **Product Catalogue** | **Preserved** | 24 technical jackets across all 10 styles | ✅ Fully intact |

---

## 2. Architecture & Database Updates

### 2.1 SQLite Schema & Migration (`database/schema.sql` & `database/db.js`)
1. **`orders` Table Schema Expansion:**
   - Added `actual_delivery_date TEXT` column to schema and dynamic migration check.
   - Populated automatically with `CURRENT_TIMESTAMP` when order transitions to `DELIVERED` (Stage 6).
2. **Elimination of Historical Backfilling:**
   - Removed legacy loop in `database/db.js` that previously backfilled 480 fake historical orders into `order_tracking_events` and `payments`.
   - Application restarts will **never** regenerate fake/sample orders.
3. **Dedicated Reset Method (`resetOrderHistory`):**
   - Atomically clears `orders`, `order_items`, `order_tracking_events`, and `payments` for user profile `user_akhil`.
   - Preserves `user_profiles` and `products` / `product_variants`.
   - Exposed as helper in `database/db.js` and REST endpoint `POST /api/orders/reset`.
4. **Dynamic User Statistics (`getUserStats`):**
   - `total_orders`: Count of orders belonging to user.
   - `active_orders`: Orders with status in `('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY')`.
   - `delivered_orders`: Orders with status `'DELIVERED'`.
   - `total_spent_inr`: `SUM(total_amount)` strictly for verified paid statuses (`'PAID'`, `'PROCESSING'`, `'SHIPPED'`, `'OUT_FOR_DELIVERY'`, `'DELIVERED'`, `'PAID_DEMO_TEST'`).
   - `total_spent_usd`: `SUM(charged_amount)` for verified paid statuses; returns `0` when spending is zero.
   - Cancelled and failed orders never increase total spending. No double-counting.

---

## 3. Fresh Tracking Flow (From Now On)

Every new order permanently records:
1. **Unique Order ID:** e.g., `ORD-MVWGD...` generated server-side.
2. **Products & Line Items:** Stored in `order_items` with product name, size, color, unit price, quantity, line total, joined with product image.
3. **Pricing & Shipping Charges:** Subtotal, delivery fee (free above ₹2,000 threshold), and total amount in INR.
4. **International USD Equivalent:** Calculated using fixed server exchange rate (`1 USD = ₹85 INR`), stored in `charged_amount`, `charged_currency`, and `exchange_rate`.
5. **Customer & Delivery Details:** Name, email, phone, street address, city, state, postal code, destination country.
6. **Payment Details:** Method (`PayPal Sandbox`), payment status (`PENDING` -> `SUCCESS`), PayPal Order ID, capture/transaction ID, debug ID.
7. **6-Stage Tracking Timeline:**
   - Stage 1: Order Placed (recorded automatically upon order creation)
   - Stage 2: Payment Confirmed (recorded automatically upon server-side capture verification)
   - Stage 3: Order Processing (Bengaluru Fulfillment Center)
   - Stage 4: Shipped (Air Cargo Terminal with AWB tracking)
   - Stage 5: Out for Delivery (Local Depot)
   - Stage 6: Delivered (Delivery Address, sets `actual_delivery_date`)
8. **Estimated & Actual Delivery Dates:** Calculated 3-5 business days estimate and exact delivery timestamp upon delivery.

---

## 4. Verification & Test Results

### 4.1 Automated Test Suite (`npm test`):
```powershell
npm test
```
**Results:** **44/44 tests passed (100.0%)**
- SQLite Database & Catalog Integrity: 3/3 passed
- Search, Filter, and Sort Engine: 3/3 passed
- Server-Side Pricing & Security Validation: 5/5 passed
- AI Jacket Stylist & Grounded Recommendations: 2/2 passed
- PayPal Sandbox Checkout Engine: 9/9 passed
- Live Express HTTP Endpoints: 9/9 passed
- My Account & User Profile Zero-State & Updates: 4/4 passed
- Live Order Tracking & Automatic Dashboard Updates: 5/5 passed
- INR Pricing & PayPal-Only International Checkout: 2/2 passed
- Final Clean Reset Verification: 2/2 passed

### 4.2 Chrome CDP Browser Verification Suite (`npm run verify:account`):
```powershell
npm run verify:account
```
- **Result:** **100% Passed**
- Verified dashboard renders:
  - Total Orders: `0`
  - Active Orders: `0`
  - Delivered Orders: `0`
  - Total Spent: `₹0`
  - USD Total Spent: `$0.00`
- Verified My Orders empty state (`No orders found matching the criteria.`).
- Verified Payment History empty state (`No payment history records found.`).
- Verified live order placement immediately increments order count and displays order card in My Orders tab.
- Verified 6-stage tracking timeline stepper and Stage 1-2 completion.
- Verified live payment record in Payment History tab.
- Verified Domestic India blocking notice and international USD checkout.
- Verified final clean reset leaves the database at zero orders.
- Updated screenshots saved in `docs/`:
  - `docs/account_profile_view.png` (Zero-state dashboard)
  - `docs/order_tracking_view.png` (6-stage timeline)
  - `docs/payment_history_view.png` (Verified payment records)
  - `docs/checkout_international_view.png` (International USD checkout)

---

## 5. Current SQLite Database Summary

```json
{
  "orders": 0,
  "items": 0,
  "tracking": 0,
  "payments": 0,
  "profiles": 1,
  "products": 24,
  "stats": {
    "total_orders": 0,
    "active_orders": 0,
    "delivered_orders": 0,
    "cancelled_orders": 0,
    "total_spent_inr": 0,
    "total_spent_usd": 0,
    "recent_activity": []
  }
}
```
User Akhil's profile and the 24 technical jackets remain permanently saved in SQLite.
All new orders placed through the UI or APIs will be permanently recorded and tracked from this point forward.
