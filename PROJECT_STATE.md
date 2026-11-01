# Project State: AgentCart AI

**Current Status:** Interactive 3D Jacket Model Integration Verified (Three.js WebGL Showcase, 360° Mouse Movement, Reference Photo Color Accuracy, Touch/Mobile Gestures)  
**Date:** November 1, 2026  
**Platform Version:** v4.1.0 (Interactive 3D Outerwear Edition)  
**Database Location:** `D:\AgentCart-AI\database\agentcart.sqlite`  
**Default Customer Profile:** `Akhil` (`user_akhil`)  
**Default Admin Account:** `admin` / `Admin@AgentCart2026!`  

---

## 1. Executive Summary & Capabilities Overview

AgentCart AI now features a flagship interactive 3D digital outerwear showcase directly integrated into the primary hero section. The static hero image has been seamlessly replaced with the Nixi3D-generated `jacket.glb` model, recolored with photorealistic fidelity to the original reference photograph, featuring smooth 360° mouse-tracking rotation, click-and-drag turntable inspection, mobile touch gestures, and Studio PBR lighting.

### 1.1 Core Modules & 3D Integration

1. **Interactive 3D Jacket Showcase Viewer (`#heroJacketContainer`):**
   - Replaced static jacket photograph in `.hero-flagship-card .hero-card-visual` with a high-performance WebGL 3D canvas.
   - Retained complete existing website layout, typography, glassmorphism card styling, pricing, quick-add controls, and surrounding sections without any regression.
   - Retained `#heroJacketImg` as an accessible fallback for the flying-cart addition animation and screen readers.
   - Centrally positioned, prominent framing responsive on desktop, tablet, and mobile viewports.

2. **Accurate Color Matching & Material Recoloring (Grounded in Reference Photograph):**
   - **Main Fabric:** Rich, deep dark navy blue / almost black (`#090d16` to `#0d1322`), maintaining all natural folds, creases, stitching, and shadow contours.
   - **Zippers:** Bright electric blue (`#00b4ff` to `#00e5ff`) with subtle metallic sheen and physical emission glow.
   - **Piping & Accents:** Bright electric blue along outer sleeves, collar/hood opening, side stripes, and bottom hem.
   - **Logos:** High-contrast crisp icy white / pale blue on chest and back hood.
   - **PBR Material System:** Segregated into 3 distinct physical materials (`Jacket_Fabric_DarkNavy`, `Jacket_Zippers_ElectricBlue`, `Jacket_Accents_ElectricBlue`) with tuned roughness, metalness, and emission.
   - **Zero Polygon Bleeding:** Continuous color mapping eliminates polygon-boundary artifacts.

3. **Interactive 360-Degree Movement & Controls:**
   - **Natural Mouse Movement:** Jacket smoothly tracks mouse position over the display area. Moving left rotates left; moving right rotates right; vertical mouse movement adjusts viewing angle within subtle pitch bounds.
   - **Spherical Lerp Damping:** Silky-smooth interpolation removes jitter, jumps, or abrupt snapping.
   - **Click-and-Drag Turntable:** Full 360° continuous rotation in any direction with inertia glide on pointer release.
   - **Mobile Touch Gestures:** Single-touch drag to rotate, two-finger pinch to zoom in/out with boundary clamping.
   - **Smooth Zoom Controls:** Mouse wheel zoom bounded safely between 0.75x and 1.35x.
   - **Front & Back Inspection Buttons:** Floating controls (`#jacketResetViewBtn`, `#jacketBackViewBtn`) for instant 180° front/back toggling.
   - **Gentle Ambient Breathing:** Subtle floating animation after idle pause; immediately disabled during interaction. Respects `prefers-reduced-motion`.

4. **Technical Implementation & Zero External Dependencies:**
   - Three.js core and GLTFLoader bundled locally into `frontend/assets/js/jacket-viewer.js` (619 KB) using `esbuild`.
   - 100% compliant with strict Content-Security-Policy (`script-src 'self'`).
   - Clean loading overlay with modern spinner, percentage indicator, and retry handling.
   - Complete lifecycle resource disposal (`dispose()`) on unmount.

---

## 2. Section Architecture & Database Schema

### 2.1 Homepage Architecture
```
<header id="siteHeader">
  Shop (#hero) · Catalogue (#catalogue) · Details (#detailsMatter) · Entry Portal (#entryPortalBtn) · Notifications (#notificationBtn) · Profile (#headerProfileBtn) · Cart (#headerCartBtn)
</header>
<main>
  1. #hero             — Clean Hero with Interactive 3D Jacket Viewer (#heroJacketContainer)
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

## 3. Automated Test Results & Verification

### 3.1 Automated Test Suite (`npm test`)
**Outcome:** **53/53 tests passed (100.0%)**
- SQLite Database & Catalog Integrity: 24 products, all styles present, price in INR.
- Search, Filter, and Sort Engine: Category filtering, keyword search, price sorting.
- Server-Side Pricing Validation: Database recalculation, free delivery over ₹2,000, tampering rejection.
- PayPal Sandbox Checkout Engine: Order creation, capture, error diagnostics, cancellation.
- Redesigned Clean Homepage: Absence of obsolete promotional copy and intact hero layout.
- User Profile: Default Akhil profile, zeroed stats on fresh start, profile editing persistence.
- Live Order Tracking: Stage 1 to Stage 6 chronological tracking with estimated delivery dates.
- INR Pricing & PayPal-Only International Checkout: Domestic India blocking, international USD approval.
- Security Hardening: Security headers present on all endpoints.
- Wishlist Engine: Toggle add, full product retrieval, duplicate toggle remove, delete endpoint.
- In-App Notifications: Notification creation, unread count tracking, single read, mark all read.
- Admin Authentication & RBAC: Invalid credential rejection (401), valid login (200) with session token, protected route blocking.
- Admin Product & Inventory: Activation/deactivation toggle, customer catalog synchronization, variant stock level adjustment.
- Customer Return & PayPal Refund Workflow: Return request creation, admin approval, package receipt & stock restoration, PayPal Sandbox refund execution.

### 3.2 3D Model CDP Browser Verification (`npm run verify:3d`)
**Outcome:** **100% Passed (0 Errors)**
- Verified canvas creation in DOM: 427px × 380px WebGL renderer.
- Verified 3D loading overlay dismissal with smooth fade-out.
- Verified `360° INTERACTIVE` badge display.
- Verified default Front view rendering with bright electric blue zipper and dark navy fabric.
- Verified smooth 180° rotation to Back view upon trigger.
- Verified click-and-drag interaction and rotation responsiveness.
- Verified mobile emulation (390px × 844px) responsiveness and proper framing.
- Verified zero console errors or WebGL pipeline warnings.
- Screenshots saved in `tests/screenshots_3d/`:
  - `tests/screenshots_3d/1_hero_3d_front.png`
  - `tests/screenshots_3d/2_hero_3d_back.png`
  - `tests/screenshots_3d/3_hero_3d_drag_angle.png`
  - `tests/screenshots_3d/4_hero_3d_mobile.png`

### 3.3 Customer Account & Checkout CDP Verification (`npm run verify:account`)
**Outcome:** **100% Passed**
- Primary INR pricing, profile modal, order timeline tracking, domestic payment block, and international USD checkout verified.
