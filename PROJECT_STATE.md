# Project State: AgentCart AI

**Current Status:** Cinematic Scroll-Controlled Video Showroom Verified & Operational  
**Date:** October 29, 2026  
**Platform Version:** v3.2.0 (Cinematic Scroll-Controlled Video Showroom Edition)  
**Recovery Backup Location:** `D:\AgentCart-AI-backup-pre-reorg`  

---

## 1. Actual Video Opening Scroll Animation Integration

The reference video stored in `D:\AgentCart-AI\video` has been integrated as the primary, dominant visual experience for the opening section of the AgentCart-AI homepage, immediately below the fixed header.

| Parameter | Specification | Verification |
| :--- | :--- | :--- |
| **Source Video File** | `A futuristic e-commerce experience built to make the product feel premium before the customer ev.mp4` | ✅ File exists in `video/` (2.87 MB) |
| **Local File Path** | `D:\AgentCart-AI\video\A futuristic e-commerce experience built to make the product feel premium before the customer ev.mp4` | ✅ Tested & verified |
| **Format & Codec** | MP4 (H.264 / AVC video, AAC audio / muted) | ✅ Verified |
| **Dimensions** | 1156 x 720 px (Aspect ratio: ~1.605) | ✅ Maintained |
| **Frame Rate & Count** | 30.0 FPS, 437 total frames | ✅ Verified via OpenCV |
| **Total Duration** | 14.567 seconds | ✅ Synchronized to scroll |
| **Express Streaming Route** | `GET /video/hero.mp4` (HTTP 206 Partial Content / Range support) | ✅ Verified |
| **Scrubbing Manifest** | `GET /video/manifest.json` (30 progressive fallback frames) | ✅ Verified |

---

## 2. Architecture & Implementation Method

### 2.1 Hybrid Scrubbing Engine (Direct Video + Canvas Fallback)
1. **Primary Video Engine:**
   - HTML5 `<video>` element (`#heroVideo`) with `muted`, `playsinline`, `preload="auto"`, and strict absence of `controls`.
   - Uses `requestAnimationFrame` with lerp damping (`currentProgress += diff * 0.22`) to smoothly synchronize video timeline to user scroll progress.
   - Scrolling down advances the video frame-by-frame; scrolling up smoothly reverses the video frame-by-frame.
   - Throttled seek loop avoids seek queue saturation while maintaining buttery-smooth updates.
2. **Progressive Canvas Scrubbing Fallback Engine:**
   - High-performance `<canvas>` element (`#heroCanvas`, 1156x720) initialized in tandem.
   - Loads `video/manifest.json` and preloads key frames progressively.
   - If direct video playback or rapid seek is delayed or unsupported by the browser, canvas immediately renders nearest frame without user-perceptible latency.
3. **Instant Loading Poster:**
   - `#heroPosterImg` displays initial frame instantly, fading out with graceful CSS opacity transition once video or canvas frame is decoded.
4. **Performance & Energy Efficiency:**
   - `IntersectionObserver` detects when `#hero` leaves the viewport and pauses the RAF animation loop, preventing background CPU or GPU usage.
   - Audio is strictly muted (`video.muted = true`, `video.volume = 0`).
   - Compliant with `prefers-reduced-motion`: pauses scrub loop and renders static hero frame if requested.

---

## 3. UI Fixes & Motion Enhancements

### 3.1 "Huge Black Triangle" Issue Diagnosed & Permanently Fixed
- **Root Cause Identified:** The inline SVG arrow in `#heroShopNowBtn` (`<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`) lacked explicit `width`, `height`, `fill="none"`, and `stroke="currentColor"`. In Chromium, unstyled SVG paths default to solid black fill (`fill: #000000; stroke: none;`), which filled the entire bounding box (93px wide) with a massive black triangular wedge directly next to the buttons.
- **Fix Applied:**
  1. Updated the SVG with explicit dimensions (`width="16" height="16"`), `fill="none"`, and `stroke="currentColor"`.
  2. Created dedicated Liquid Glass styling in `frontend/styles.css` for `.btn-tech-shop` (vibrant laboratory orange CTA pill with specular glow and white chevron) and `.btn-tech-outline` (frosted glass pill with subtle border and orange hover accent).
  3. Added global CSS safeguards ensuring SVG elements never collapse or blow up.

### 3.2 Sticky Stage Viewport Pinning Fix
- **Root Cause Identified:** Parent `.showroom-dark-stage` had `overflow: hidden`, which breaks CSS `position: sticky` on child elements according to the CSS specification.
- **Fix Applied:**
  1. Added `overflow: visible !important;` to `.hero-showroom-section`.
  2. Set `.hero-sticky-stage` to `top: 70px; height: calc(100vh - 70px); overflow: hidden;`.
  3. The hero stage now docks flush beneath the sticky header and stays pinned throughout the 280vh scroll track.

---

## 4. Verification & Automated Test Results

Executed `npm test` ([`tests/run_tests.js`](file:///D:/AgentCart-AI/tests/run_tests.js)):
- **Database & Catalog Integrity:** 3/3 passed
- **Search, Filter & Sort:** 3/3 passed
- **Server-Side Pricing & Security Validation:** 5/5 passed
- **AI Recommender:** 2/2 passed
- **PayPal Sandbox Checkout Engine:** 9/9 passed
- **Live Express HTTP Endpoints:** 9/9 passed (including `/video/hero.mp4` HTTP 206 range check, `/video/manifest.json` check, and `#heroVideo` inspection)
- **Total:** **31/31 passed (100.0%)**

### Headless Chrome CDP Browser Verification ([`tests/verify_browser_scroll.js`](file:///D:/AgentCart-AI/tests/verify_browser_scroll.js)):
- **DOM Elements:** `#heroVideo`, `#heroCanvas`, `#heroPosterImg`, `#heroVideoArena` present and measured.
- **Scroll Down (800px):** Sticky stage pinned at `top: 70px`, `video.currentTime` advanced to `7.25s`, scrub progress fill at `54.3%`, telemetry displaying `REC 00:07.91 / 00:14.56`.
- **Scroll Down (1600px):** `video.currentTime` advanced to `13.85s`, fill at `96.2%`.
- **Scroll Up (Reversal to 0px):** `video.currentTime` reversed to `0.09s`, telemetry returning to `REC 00:00.10 / 00:14.56`, fill resetting to `0.7%`.
- **Console Errors:** `0` (Zero errors, zero exceptions).
- **Visual Capture:** Screenshot verified at [`video/browser_scrolled_800px.png`](file:///D:/AgentCart-AI/video/browser_scrolled_800px.png) showing glossy blue puffer jacket, orange telemetry bar, corner brackets, and zero triangles.
