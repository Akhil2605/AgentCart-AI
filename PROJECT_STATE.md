# Project State: AgentCart AI

**Current Status:** Customer Features, Admin Management Console, Returns & Refunds, and Security Hardening Verified  
**Date:** October 31, 2026  
**Platform Version:** v4.0.0 (Enterprise Outerwear & Administration Edition)  
**Database Location:** `D:\AgentCart-AI\database\agentcart.sqlite`  
**Default Customer Profile:** `Akhil` (`user_akhil`)  
**Default Admin Account:** `admin` / `Admin@AgentCart2026!`  

---

## 1. Executive Summary & Capabilities Overview

AgentCart AI has been enhanced with a complete suite of customer features, administrator management tools, inventory rules, verified notifications, return & refund workflows integrated with PayPal Sandbox, security hardening, and streamlined UI layout refinements.

### 1.1 Core Modules Implemented

1. **Wishlist / Save for Later:**
   - Heart-shaped favourite icon on every product card (`#productGrid`) and product details modal (`#productModal`).
   - Instant visual toggle (unfilled to filled active red).
   - Saved persistently in SQLite `wishlist` table associated with `user_akhil`.
   - Accessible via **Profile / My Account -> Saved Products** tab.
   - Users can move saved items directly into cart or remove them.
   - Clean upper navigation bar maintained (no permanent navbar clutter).

2. **User & Admin Entry Portal + Protected Admin Console:**
   - Entry Portal modal (`#entryPortalModal`) allowing seamless switching between **Customer Showroom** and **Admin Management Console**.
   - Protected Admin Login modal (`#adminLoginModal`) with salted `scrypt` password hashing and secure session tokens in `admin_sessions`.
   - Role-Based Access Control (RBAC) middleware (`requireAdminAuth`) securing all `/api/admin/*` endpoints.
   - Full Admin Dashboard modal (`#adminDashboardModal`) featuring:
     - **Overview:** Real-time revenue (INR & USD), total orders, pending orders, pending returns, and low-stock variant watchlist.
     - **Products & Inventory:** Product activation/deactivation toggle (hides from customer catalogue without deletion), and variant stock level adjustment steppers.
     - **Orders Management:** Order lifecycle stage advancement (Pending -> Paid -> Processing -> Shipped -> Out for Delivery -> Delivered).
     - **Returns & Refunds:** Return request inspection, Approve / Reject actions, Received & Restock trigger, and PayPal Sandbox refund processor.

3. **Inventory Rules:**
   - Stock is deducted **ONLY after verified payment capture** (never at cart addition or preliminary order creation).
   - Real-time stock validation during order calculation to prevent overselling.
   - Stock is restocked **ONLY when return packages are inspected and marked as received** by an administrator.

4. **In-App Order Notifications:**
   - Bell icon button in top navigation bar (`#notificationBtn`) with live unread badge counter.
   - Floating dropdown notification center (`#notificationDropdown`).
   - Triggered exclusively by verified system events: `ORDER_PLACED`, `PAYMENT_SUCCESS`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURN_REQUESTED`, `RETURN_APPROVED`, `RETURN_REJECTED`, `RETURN_RECEIVED`, `REFUND_ISSUED`.
   - Mark individual notification as read or "Mark All Read".

5. **Customer Returns & PayPal Sandbox Refund Workflow:**
   - Customer return submission via **Profile -> Returns & Refunds** tab (`#returnRequestModal`).
   - Admin approves return, receives package, and restocks inventory.
   - Admin executes genuine PayPal Sandbox refund using captured PayPal transaction ID (`capture_id`).
   - Customer profile spending statistics (`total_spent_inr` and `total_spent_usd`) automatically and dynamically deduct refunded amounts.

6. **Application Security Hardening:**
   - Comprehensive HTTP security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
   - Sliding-window in-memory rate limiters on `/api/admin/login`, `/api/paypal/create-order`, `/api/paypal/capture-order`, and `/api/admin/returns/:id/refund`.
   - 100% parameterized SQL queries preventing SQL injection.
   - Zero sensitive secret leakage (PayPal client secret strictly hidden).

7. **Layout & UX Refinements:**
   - Completely removed `#featuredProduct` section and "VIEW FEATURED SHELL" hero button.
   - Completely removed `#aiAssistant` section and "ASK AI STYLIST" buttons.
   - Reliable Profile modal opening across all 4 entry points (header button, nav link, mobile drawer link, footer link) with 5 tabs:
     1. Profile Details & Live Statistics
     2. My Orders & 6-Stage Tracking Timeline
     3. Payment History
     4. Saved Products (Wishlist)
     5. Returns & Refunds

---

## 2. Section Architecture & Database Schema

### 2.1 Clean Homepage Architecture
```
<header id="siteHeader">
  Shop (#hero) · Catalogue (#catalogue) · Details (#detailsMatter) · Entry Portal (#entryPortalBtn) · Notifications (#notificationBtn) · Profile (#headerProfileBtn) · Cart (#headerCartBtn)
</header>
<main>
  1. #hero             — Clean Static Product Hero (INTELLIGENT OUTERWEAR. POWERED BY AGENTCART AI.)
  2. #catalogue        — Full Outerwear Catalogue (24 Jackets, Search, Filters, Wishlist Hearts)
  3. #detailsMatter    — Technical Details Matter (01-05 Technical Fabric Specifications)
</main>
<footer class="tech-showroom-footer">
  Minimal Single-Row Footer: Brand Logo · Shop · Catalogue · Details · Profile · Admin Portal · © 2026 AGENTCART AI.
</footer>
```

### 2.2 SQLite Database Tables (`agentcart.sqlite`)
- `products`: 24 jackets with metadata, specs, price, and `is_active` flag.
- `product_variants`: Size and color variants with independent stock counts.
- `user_profiles`: Default persistent profile for `Akhil` (`user_akhil`).
- `orders`: Order records with status, shipping details, amounts in INR and USD, and tracking codes.
- `order_items`: Line items for each order.
- `order_tracking_events`: 6-stage chronological delivery timeline records.
- `payments`: PayPal Sandbox transaction records with debug IDs and status.
- `wishlist`: Customer saved products linked to `user_id` and `product_id`.
- `admin_users`: Administrator credentials with salted `scrypt` password hash.
- `admin_sessions`: Secure 24-hour administrator authentication session tokens.
- `notifications`: Customer notifications with unread states and event codes.
- `returns`: Customer return requests with reason, status, and admin inspection notes.
- `refunds`: Refund records linked to PayPal refund IDs and capture IDs.

---

## 3. Automated Test Results

### 3.1 Test Suite (`node tests/run_tests.js`)
**Outcome:** **53/53 tests passed (100.0%)**
- SQLite Database & Catalog Integrity: 24 products, all styles present, price in INR.
- Search, Filter, and Sort Engine: Category filtering, keyword search, price sorting.
- Server-Side Pricing Validation: Database recalculation, free delivery over ₹2,000, tampering rejection.
- PayPal Sandbox Checkout Engine: Order creation, capture, error diagnostics, cancellation.
- Redesigned Clean Homepage: Absence of `#featuredProduct`, `#aiAssistant`, `#reviews`, and old promotional copy.
- User Profile: Default Akhil profile, zeroed stats on fresh start, profile editing persistence.
- Live Order Tracking: Stage 1 to Stage 6 chronological tracking with estimated delivery dates.
- INR Pricing & PayPal-Only International Checkout: Domestic India blocking, international USD approval.
- Security Hardening: Security headers present on all endpoints.
- Wishlist Engine: Toggle add, full product retrieval, duplicate toggle remove, delete endpoint.
- In-App Notifications: Notification creation, unread count tracking, single read, mark all read.
- Admin Authentication & RBAC: Invalid credential rejection (401), valid login (200) with session token, protected route blocking.
- Admin Product & Inventory: Activation/deactivation toggle, customer catalog synchronization, variant stock level adjustment.
- Customer Return & PayPal Refund Workflow: Return request creation, admin approval, package receipt & stock restoration, PayPal Sandbox refund execution, and profile spending reduction.
- Final Clean Reset: Complete zero-state verification.

### 3.2 Headless Chrome CDP Browser Verification (`node tests/verify_account_and_pricing.js`)
**Outcome:** **100% Passed**
- Primary product card pricing in INR (`₹1,899 (≈ $22.34 USD)`).
- Header Profile button displays `PROFILE`.
- My Account / Profile modal opens in clean zero-state (`0`, `0`, `0`, `₹0`, `$0.00`).
- Orders tab and Payment History tab display clean empty states.
- Live order placement and 6-stage tracking timeline verified.
- Domestic India payment restriction alert verified.
- International USD checkout verified.
- Screenshots captured and stored in `docs/`:
  - `docs/account_profile_view.png`
  - `docs/order_tracking_view.png`
  - `docs/payment_history_view.png`
  - `docs/checkout_international_view.png`
