# -*- coding: utf-8 -*-
import re

def update_theme():
    with open('styles.css.bak', 'r', encoding='utf-8') as f:
        css = f.read()

    # 1. Root & Base
    old_header_root = """/* ==========================================================================
   AGENTCART AI — PREMIUM LIQUID GLASS DESIGN SYSTEM
   Aesthetic: Deep Midnight Navy, Obsidian Black, Electric Cyan & Icy Blue
   ========================================================================== */

:root {
  /* Color Palette */
  --bg-midnight: #080D18;
  --bg-obsidian: #101722;
  --bg-surface-elevated: #162030;
  --bg-deep-canvas: #050810;
  
  /* Liquid Glass Surfaces */
  --glass-frosted: rgba(255, 255, 255, 0.08);
  --glass-base: rgba(16, 23, 34, 0.58);
  --glass-heavy: rgba(12, 18, 28, 0.82);
  --glass-modal: rgba(10, 15, 24, 0.88);
  --glass-light: rgba(255, 255, 255, 0.04);
  --glass-chip: rgba(255, 255, 255, 0.06);
  
  /* Reflective Glass Borders */
  --glass-border: rgba(255, 255, 255, 0.16);
  --glass-border-light: rgba(255, 255, 255, 0.09);
  --glass-border-highlight: rgba(255, 255, 255, 0.28);
  --glass-border-cyan: rgba(66, 232, 245, 0.45);
  
  /* Accents */
  --accent-cyan: #42E8F5;
  --accent-cyan-rgb: 66, 232, 245;
  --accent-ice: #8ACBFF;
  --accent-ice-rgb: 138, 203, 255;
  --accent-blue-deep: #0284c7;
  --accent-violet: #9B8CFF;
  --accent-violet-rgb: 155, 140, 255;
  
  /* Glows */
  --cyan-glow-subtle: rgba(66, 232, 245, 0.15);
  --cyan-glow-strong: rgba(66, 232, 245, 0.35);
  --ice-glow: rgba(138, 203, 255, 0.2);
  --violet-glow: rgba(155, 140, 255, 0.22);
  
  /* Status Colors */
  --color-success: #10B981;
  --color-success-glow: rgba(16, 185, 129, 0.22);
  --color-error: #FB7185;
  --color-error-glow: rgba(251, 113, 133, 0.22);
  --color-amber: #F59E0B;
  
  /* Typography */
  --text-primary: #F4F7FB;
  --text-secondary: #A7B2C5;
  --text-dim: #6F7D95;
  --font-main: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'Space Grotesk', monospace;
  
  /* Liquid Glass Shadows & Specular Highlights */
  --shadow-glass-sm: 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  --shadow-glass-md: 0 12px 32px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.18);
  --shadow-glass-lg: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 30px rgba(66, 232, 245, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.22);
  --shadow-glass-hover: 0 20px 48px rgba(0, 0, 0, 0.55), 0 0 24px rgba(66, 232, 245, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  
  /* Transitions */
  --tr-fast: 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  --tr-base: 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  --tr-smooth: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  --tr-spring: 0.5s cubic-bezier(0.2, 1.15, 0.3, 1);
}"""

    new_header_root = """/* ==========================================================================
   AGENTCART AI — PREMIUM LIQUID GLASS DESIGN SYSTEM (WARM PALETTE)
   Aesthetic: Warm Ivory Canvas, Crisp White Liquid Glass, Vibrant LabConnect Orange & Slate Navy
   ========================================================================== */

:root {
  /* Color Palette — Warm Ivory Canvas & Crisp White Glass */
  --bg-canvas: #FAF8F5;
  --bg-canvas-warm: #F4EFEB;
  --bg-surface-elevated: #FFFFFF;
  --bg-deep-canvas: #FAF6F0;
  --bg-midnight: #FAF8F5;
  --bg-obsidian: #FFFFFF;
  --bg-dark-slate: #1E2530;
  --bg-dark-surface: #151D28;
  
  /* Liquid Glass Surfaces (Crisp White Frosted Glass with Specular Edge Glow) */
  --glass-frosted: rgba(255, 255, 255, 0.72);
  --glass-base: rgba(255, 255, 255, 0.86);
  --glass-heavy: rgba(255, 255, 255, 0.94);
  --glass-modal: rgba(255, 255, 255, 0.97);
  --glass-light: rgba(255, 255, 255, 0.65);
  --glass-chip: rgba(255, 255, 255, 0.92);
  
  /* Reflective Glass Borders */
  --glass-border: rgba(30, 41, 59, 0.08);
  --glass-border-light: rgba(30, 41, 59, 0.05);
  --glass-border-highlight: rgba(255, 255, 255, 0.95);
  --glass-border-cyan: rgba(225, 92, 29, 0.35);
  --glass-border-orange: rgba(225, 92, 29, 0.35);
  
  /* Signature Accents — Warm Laboratory Vibrant Orange & Sunset Amber */
  --accent-orange: #E15C1D;
  --accent-orange-rgb: 225, 92, 29;
  --accent-orange-hover: #DE5216;
  --accent-orange-soft: #FFF2EB;
  --accent-orange-border: rgba(225, 92, 29, 0.22);
  
  /* Backwards-compatible Accents (Universal System Consistency) */
  --accent-cyan: #E15C1D;
  --accent-cyan-rgb: 225, 92, 29;
  --accent-ice: #F97316;
  --accent-ice-rgb: 249, 115, 22;
  --accent-blue-deep: #DE5216;
  --accent-violet: #E15C1D;
  --accent-violet-rgb: 225, 92, 29;
  
  /* Liquid Glass Glows */
  --cyan-glow-subtle: rgba(225, 92, 29, 0.16);
  --cyan-glow-strong: rgba(225, 92, 29, 0.38);
  --ice-glow: rgba(249, 115, 22, 0.2);
  --violet-glow: rgba(225, 92, 29, 0.22);
  --orange-glow-subtle: rgba(225, 92, 29, 0.16);
  --orange-glow-strong: rgba(225, 92, 29, 0.38);
  
  /* Status Colors */
  --color-success: #10B981;
  --color-success-glow: rgba(16, 185, 129, 0.22);
  --color-error: #EF4444;
  --color-error-glow: rgba(239, 68, 68, 0.22);
  --color-amber: #F59E0B;
  
  /* Typography */
  --text-primary: #1A202C;
  --text-secondary: #5A677D;
  --text-dim: #8E9AAB;
  --text-muted: #64748B;
  --font-main: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'Space Grotesk', monospace;
  
  /* Liquid Glass Shadows & Specular Highlights */
  --shadow-glass-sm: 0 4px 14px rgba(30, 41, 59, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --shadow-glass-md: 0 10px 30px rgba(30, 41, 59, 0.07), inset 0 1px 1px rgba(255, 255, 255, 0.95);
  --shadow-glass-lg: 0 20px 48px rgba(30, 41, 59, 0.1), 0 0 25px rgba(225, 92, 29, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.95);
  --shadow-glass-hover: 0 20px 44px rgba(225, 92, 29, 0.14), 0 4px 14px rgba(30, 41, 59, 0.06), inset 0 1px 1px rgba(255, 255, 255, 1);
  
  /* Transitions */
  --tr-fast: 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  --tr-base: 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  --tr-smooth: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  --tr-spring: 0.5s cubic-bezier(0.2, 1.15, 0.3, 1);
}"""

    assert old_header_root in css, "old_header_root not found"
    css = css.replace(old_header_root, new_header_root, 1)

    # 2. Body & background
    old_body = """html {
  scroll-behavior: smooth;
  font-size: 16px;
  background-color: var(--bg-midnight);
}

body {
  font-family: var(--font-main);
  background-color: var(--bg-midnight);
  background-image: 
    radial-gradient(circle at 18% 12%, rgba(66, 232, 245, 0.08) 0%, transparent 42%),
    radial-gradient(circle at 82% 24%, rgba(138, 203, 255, 0.09) 0%, transparent 48%),
    radial-gradient(circle at 50% 75%, rgba(155, 140, 255, 0.05) 0%, transparent 55%),
    linear-gradient(180deg, #080D18 0%, #060911 100%);
  background-attachment: fixed;
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}"""

    new_body = """html {
  scroll-behavior: smooth;
  font-size: 16px;
  background-color: var(--bg-canvas);
}

body {
  font-family: var(--font-main);
  background-color: var(--bg-canvas);
  background-image: 
    radial-gradient(circle at 18% 12%, rgba(225, 92, 29, 0.06) 0%, transparent 45%),
    radial-gradient(circle at 82% 24%, rgba(249, 115, 22, 0.05) 0%, transparent 48%),
    radial-gradient(circle at 50% 75%, rgba(245, 158, 11, 0.04) 0%, transparent 55%),
    linear-gradient(180deg, #FAF8F5 0%, #F5F1EA 100%);
  background-attachment: fixed;
  color: var(--text-primary);
  min-height: 100vh;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}"""

    assert old_body in css, "old_body not found"
    css = css.replace(old_body, new_body, 1)

    # 3. Fallback
    old_fallback = """@supports not (backdrop-filter: blur(16px)) {
  .glass-panel, .site-header, .product-card, .ai-assistant-card, .cart-drawer-panel, .modal-content-box {
    background: rgba(16, 23, 34, 0.95) !important;
  }
}"""
    new_fallback = """@supports not (backdrop-filter: blur(16px)) {
  .glass-panel, .site-header, .product-card, .ai-assistant-card, .cart-drawer-panel, .modal-content-box {
    background: rgba(255, 255, 255, 0.98) !important;
  }
}"""
    assert old_fallback in css, "old_fallback not found"
    css = css.replace(old_fallback, new_fallback, 1)

    # 4. Orbs
    old_orbs = """.liquid-ambient-orb.orb-cyan {
  top: 15%;
  right: 12%;
  width: 440px;
  height: 440px;
  background: radial-gradient(circle, rgba(66, 232, 245, 0.16) 0%, rgba(138, 203, 255, 0.04) 60%, transparent 75%);
  animation: liquidFloat 7s ease-in-out infinite;
}

.liquid-ambient-orb.orb-violet {
  top: 60%;
  left: 8%;
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(155, 140, 255, 0.12) 0%, transparent 70%);
  animation: liquidFloat 9s ease-in-out infinite reverse;
}"""

    new_orbs = """.liquid-ambient-orb.orb-cyan {
  top: 15%;
  right: 12%;
  width: 440px;
  height: 440px;
  background: radial-gradient(circle, rgba(225, 92, 29, 0.12) 0%, rgba(249, 115, 22, 0.04) 60%, transparent 75%);
  animation: liquidFloat 7s ease-in-out infinite;
}

.liquid-ambient-orb.orb-violet {
  top: 60%;
  left: 8%;
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%);
  animation: liquidFloat 9s ease-in-out infinite reverse;
}"""
    assert old_orbs in css, "old_orbs not found"
    css = css.replace(old_orbs, new_orbs, 1)

    # 5. Announcement bar
    old_announcement = """.announcement-bar {
  background: rgba(8, 13, 24, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(66, 232, 245, 0.18);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 9px 16px;
  text-align: center;
  position: relative;
  z-index: 50;
}

.announcement-bar strong {
  color: var(--accent-cyan);
  margin-right: 6px;
  font-weight: 800;
}

.announcement-bar span.pill-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(66, 232, 245, 0.12);
  color: var(--accent-cyan);
  border: 1px solid rgba(66, 232, 245, 0.35);
  margin-left: 8px;
  box-shadow: 0 0 10px rgba(66, 232, 245, 0.15);
}"""

    new_announcement = """.announcement-bar {
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(225, 92, 29, 0.14);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 9px 16px;
  text-align: center;
  position: relative;
  z-index: 50;
}

.announcement-bar strong {
  color: var(--accent-orange);
  margin-right: 6px;
  font-weight: 800;
}

.announcement-bar span.pill-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--accent-orange-soft);
  color: var(--accent-orange);
  border: 1px solid var(--accent-orange-border);
  margin-left: 8px;
  box-shadow: 0 0 10px rgba(225, 92, 29, 0.12);
}"""
    assert old_announcement in css, "old_announcement not found"
    css = css.replace(old_announcement, new_announcement, 1)

    # 6. Navbar section
    old_nav = """.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--glass-heavy);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4), inset 0 -1px 0 rgba(255, 255, 255, 0.06);
  transition: var(--tr-base);
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 70px;
  gap: 24px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-size: 1.18rem;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  display: grid;
  place-items: center;
  box-shadow: 0 0 18px var(--cyan-glow-subtle);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.brand-icon svg {
  width: 20px;
  height: 20px;
  fill: #060911;
}

.brand-text span {
  color: var(--accent-cyan);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 26px;
}

.nav-link {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color var(--tr-fast), transform var(--tr-fast);
  padding: 6px 4px;
  position: relative;
}

.nav-link:hover, .nav-link.active {
  color: #fff;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent-ice));
  box-shadow: 0 0 10px var(--accent-cyan);
  border-radius: 2px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 15px;
  border-radius: 12px;
  font-size: 0.83rem;
  font-weight: 700;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--glass-border-highlight);
  transform: translateY(-1px);
}

.nav-btn svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.nav-btn.primary {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #050810;
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 4px 16px var(--cyan-glow-subtle);
}

.nav-btn.primary:hover {
  box-shadow: 0 6px 24px var(--cyan-glow-strong);
  transform: translateY(-2px);
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  background: var(--accent-cyan);
  color: #060911;
  box-shadow: 0 0 10px rgba(66, 232, 245, 0.4);
}

.mobile-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  box-shadow: var(--shadow-glass-sm);
}

.mobile-toggle svg {
  width: 20px;
  height: 20px;
  stroke: var(--text-primary);
  fill: none;
  stroke-width: 2;
}

/* Mobile Navigation Drawer */
.mobile-nav-drawer {
  display: none;
  flex-direction: column;
  gap: 12px;
  padding: 18px 24px 24px;
  background: rgba(12, 18, 28, 0.94);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--glass-border);
}

.mobile-nav-drawer.open {
  display: flex;
}

.mobile-nav-link {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.mobile-nav-link:hover, .mobile-nav-link.active {
  color: var(--accent-cyan);
}"""

    new_nav = """.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: 0 4px 20px rgba(30, 41, 59, 0.04), inset 0 -1px 0 rgba(255, 255, 255, 0.6);
  transition: var(--tr-base);
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 70px;
  gap: 24px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-size: 1.18rem;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  display: grid;
  place-items: center;
  box-shadow: 0 4px 14px rgba(225, 92, 29, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.brand-icon svg {
  width: 20px;
  height: 20px;
  fill: #FFFFFF;
}

.brand-text span {
  color: var(--accent-orange);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 26px;
}

.nav-link {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color var(--tr-fast), transform var(--tr-fast);
  padding: 6px 4px;
  position: relative;
}

.nav-link:hover, .nav-link.active {
  color: var(--accent-orange);
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #FF6F32, #DE5216);
  box-shadow: 0 0 10px rgba(225, 92, 29, 0.4);
  border-radius: 2px;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 15px;
  border-radius: 12px;
  font-size: 0.83rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.nav-btn:hover {
  background: #FFFFFF;
  border-color: rgba(225, 92, 29, 0.3);
  color: var(--accent-orange);
  transform: translateY(-1px);
}

.nav-btn svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.nav-btn.primary {
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 4px 16px rgba(225, 92, 29, 0.3);
}

.nav-btn.primary:hover {
  box-shadow: 0 6px 24px rgba(225, 92, 29, 0.45);
  transform: translateY(-2px);
  color: #FFFFFF;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  background: var(--accent-orange);
  color: #FFFFFF;
  box-shadow: 0 0 10px rgba(225, 92, 29, 0.4);
}

.mobile-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--glass-border);
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  box-shadow: var(--shadow-glass-sm);
}

.mobile-toggle svg {
  width: 20px;
  height: 20px;
  stroke: var(--text-primary);
  fill: none;
  stroke-width: 2;
}

/* Mobile Navigation Drawer */
.mobile-nav-drawer {
  display: none;
  flex-direction: column;
  gap: 12px;
  padding: 18px 24px 24px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--glass-border);
}

.mobile-nav-drawer.open {
  display: flex;
}

.mobile-nav-link {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 10px 0;
  border-bottom: 1px solid rgba(30, 41, 59, 0.06);
}

.mobile-nav-link:hover, .mobile-nav-link.active {
  color: var(--accent-orange);
}"""

    assert old_nav in css, "old_nav not found"
    css = css.replace(old_nav, new_nav, 1)

    # 7. Hero Section
    old_hero_badge = """.hero-glow-sphere {
  position: absolute;
  top: 10%;
  right: 14%;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(66, 232, 245, 0.14) 0%, rgba(138, 203, 255, 0.06) 50%, transparent 72%);
  filter: blur(90px);
  pointer-events: none;
  z-index: 1;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: clamp(28px, 5vw, 64px);
  position: relative;
  z-index: 2;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(66, 232, 245, 0.08);
  border: 1px solid rgba(66, 232, 245, 0.3);
  box-shadow: var(--shadow-glass-sm);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent-cyan);
  margin-bottom: 22px;
  animation: liquidFloat 6s ease-in-out infinite;
}

.hero-badge i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: 0 0 10px var(--accent-cyan);
  display: inline-block;
}

.hero-title {
  font-size: clamp(2.5rem, 5.2vw, 4.3rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
}

.hero-title .gradient-text {
  background: linear-gradient(135deg, #ffffff 25%, var(--accent-ice) 60%, var(--accent-cyan) 95%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-desc {
  font-size: clamp(0.95rem, 1.8vw, 1.15rem);
  color: var(--text-secondary);
  max-width: 540px;
  line-height: 1.65;
  margin-bottom: 34px;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 42px;
}

.btn-hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 28px;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 28px var(--cyan-glow-subtle);
  transition: transform var(--tr-fast), box-shadow var(--tr-fast);
}

.btn-hero-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 36px var(--cyan-glow-strong);
}

.btn-hero-secondary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 24px;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-hero-secondary:hover {
  border-color: rgba(66, 232, 245, 0.5);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass-md);
}"""

    new_hero_badge = """.hero-glow-sphere {
  position: absolute;
  top: 10%;
  right: 14%;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(225, 92, 29, 0.1) 0%, rgba(249, 115, 22, 0.04) 50%, transparent 72%);
  filter: blur(90px);
  pointer-events: none;
  z-index: 1;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: clamp(28px, 5vw, 64px);
  position: relative;
  z-index: 2;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--accent-orange-soft);
  border: 1px solid var(--accent-orange-border);
  box-shadow: var(--shadow-glass-sm);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent-orange);
  margin-bottom: 22px;
  animation: liquidFloat 6s ease-in-out infinite;
}

.hero-badge i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-orange);
  box-shadow: 0 0 10px var(--accent-orange);
  display: inline-block;
}

.hero-title {
  font-size: clamp(2.5rem, 5.2vw, 4.3rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
}

.hero-title .gradient-text {
  background: linear-gradient(135deg, #1A202C 15%, #DE5216 70%, #FF6F32 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-desc {
  font-size: clamp(0.95rem, 1.8vw, 1.15rem);
  color: var(--text-secondary);
  max-width: 540px;
  line-height: 1.65;
  margin-bottom: 34px;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 42px;
}

.btn-hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 28px;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 24px rgba(225, 92, 29, 0.3);
  transition: transform var(--tr-fast), box-shadow var(--tr-fast);
}

.btn-hero-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(225, 92, 29, 0.45);
  color: #FFFFFF;
}

.btn-hero-secondary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 52px;
  padding: 0 24px;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.12);
  color: var(--text-primary);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-hero-secondary:hover {
  border-color: rgba(225, 92, 29, 0.4);
  color: var(--accent-orange);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass-md);
}"""

    assert old_hero_badge in css, "old_hero_badge not found"
    css = css.replace(old_hero_badge, new_hero_badge, 1)

    # Hero specs row and stage
    old_specs_stage = """.hero-spec-item {
  display: flex;
  flex-direction: column;
  padding: 12px 18px;
  border-radius: 14px;
  background: var(--glass-light);
  border: 1px solid var(--glass-border-light);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--shadow-glass-sm);
}

.hero-spec-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--accent-cyan);
  letter-spacing: -0.01em;
}

.hero-spec-label {
  font-size: 0.72rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

.hero-card-wrap {
  display: flex;
  justify-content: center;
  position: relative;
}

.hero-jacket-stage {
  position: relative;
  width: min(440px, 100%);
  border-radius: 28px;
  background: radial-gradient(circle at 50% 30%, #151F2E 0%, #0D1420 80%);
  border: 1px solid var(--glass-border);
  padding: 24px;
  box-shadow: var(--shadow-glass-lg);
  transition: transform var(--tr-smooth), box-shadow var(--tr-smooth);
  animation: liquidFloat 6.5s ease-in-out infinite;
}

.hero-jacket-stage:hover {
  transform: translateY(-6px) scale(1.008);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.75), 0 0 36px var(--cyan-glow-subtle);
  border-color: var(--glass-border-cyan);
}

.hero-jacket-img {
  width: 100%;
  height: 420px;
  object-fit: contain;
  filter: drop-shadow(0 18px 28px rgba(0, 0, 0, 0.75));
  transition: transform var(--tr-smooth);
}

.hero-floating-badge {
  position: absolute;
  bottom: 24px;
  left: 24px;
  right: 24px;
  padding: 14px 18px;
  border-radius: 18px;
  background: rgba(16, 23, 34, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-flagship-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-flagship-meta {
  font-size: 0.75rem;
  color: var(--accent-cyan);
}

.hero-flagship-price {
  font-size: 1.15rem;
  font-weight: 800;
  color: #fff;
  text-align: right;
}"""

    new_specs_stage = """.hero-spec-item {
  display: flex;
  flex-direction: column;
  padding: 12px 18px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--shadow-glass-sm);
}

.hero-spec-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--accent-orange);
  letter-spacing: -0.01em;
}

.hero-spec-label {
  font-size: 0.72rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

.hero-card-wrap {
  display: flex;
  justify-content: center;
  position: relative;
}

.hero-jacket-stage {
  position: relative;
  width: min(440px, 100%);
  border-radius: 28px;
  background: radial-gradient(circle at 50% 30%, #151F2E 0%, #0D1420 80%);
  border: 1px solid rgba(225, 92, 29, 0.25);
  padding: 24px;
  box-shadow: 0 24px 60px rgba(30, 41, 59, 0.18), 0 0 35px rgba(225, 92, 29, 0.12);
  transition: transform var(--tr-smooth), box-shadow var(--tr-smooth);
  animation: liquidFloat 6.5s ease-in-out infinite;
}

.hero-jacket-stage:hover {
  transform: translateY(-6px) scale(1.008);
  box-shadow: 0 30px 70px rgba(30, 41, 59, 0.26), 0 0 36px var(--cyan-glow-subtle);
  border-color: rgba(225, 92, 29, 0.45);
}

.hero-jacket-img {
  width: 100%;
  height: 420px;
  object-fit: contain;
  filter: drop-shadow(0 18px 28px rgba(0, 0, 0, 0.75));
  transition: transform var(--tr-smooth);
}

.hero-floating-badge {
  position: absolute;
  bottom: 24px;
  left: 24px;
  right: 24px;
  padding: 14px 18px;
  border-radius: 18px;
  background: rgba(16, 23, 34, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: var(--shadow-glass-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-flagship-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #FFFFFF;
}

.hero-flagship-meta {
  font-size: 0.75rem;
  color: #FFA066;
}

.hero-flagship-price {
  font-size: 1.15rem;
  font-weight: 800;
  color: #FFFFFF;
  text-align: right;
}"""

    assert old_specs_stage in css, "old_specs_stage not found"
    css = css.replace(old_specs_stage, new_specs_stage, 1)

    # 8. Spotlight Bar
    old_spotlight = """.spotlight-bar {
  padding: 28px 0;
  border-top: 1px solid var(--glass-border-light);
  border-bottom: 1px solid var(--glass-border-light);
  background: rgba(12, 18, 28, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 54px;
}

.spotlight-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.spotlight-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--glass-light);
  border: 1px solid var(--glass-border-light);
  box-shadow: var(--shadow-glass-sm);
  transition: transform var(--tr-fast), border-color var(--tr-fast);
}

.spotlight-box:hover {
  transform: translateY(-2px);
  border-color: rgba(66, 232, 245, 0.3);
}

.spotlight-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(66, 232, 245, 0.1);
  border: 1px solid rgba(66, 232, 245, 0.25);
  display: grid;
  place-items: center;
  flex: none;
  box-shadow: 0 0 12px rgba(66, 232, 245, 0.15);
}

.spotlight-icon svg {
  width: 20px;
  height: 20px;
  stroke: var(--accent-cyan);
  fill: none;
  stroke-width: 2;
}"""

    new_spotlight = """.spotlight-bar {
  padding: 28px 0;
  border-top: 1px solid rgba(30, 41, 59, 0.08);
  border-bottom: 1px solid rgba(30, 41, 59, 0.08);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 54px;
}

.spotlight-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.spotlight-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-sm);
  transition: transform var(--tr-fast), border-color var(--tr-fast);
}

.spotlight-box:hover {
  transform: translateY(-2px);
  border-color: rgba(225, 92, 29, 0.35);
  box-shadow: var(--shadow-glass-md);
}

.spotlight-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--accent-orange-soft);
  border: 1px solid var(--accent-orange-border);
  display: grid;
  place-items: center;
  flex: none;
  box-shadow: 0 0 12px rgba(225, 92, 29, 0.12);
}

.spotlight-icon svg {
  width: 20px;
  height: 20px;
  stroke: var(--accent-orange);
  fill: none;
  stroke-width: 2;
}"""

    assert old_spotlight in css, "old_spotlight not found"
    css = css.replace(old_spotlight, new_spotlight, 1)

    # 9. Filters & Search Controls
    old_filters = """.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
  background: var(--glass-base);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-md);
  margin-bottom: 30px;
}

.search-sort-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 16px;
  border-radius: 14px;
  background: rgba(8, 13, 24, 0.7);
  border: 1px solid var(--glass-border);
  flex: 1;
  min-width: min(290px, 100%);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: border-color var(--tr-fast), box-shadow var(--tr-fast);
}

.search-field:focus-within {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 16px var(--cyan-glow-subtle), inset 0 1px 2px rgba(0, 0, 0, 0.4);
}

.search-field svg {
  width: 18px;
  height: 18px;
  stroke: var(--text-dim);
  fill: none;
  stroke-width: 2;
}

.search-field input {
  width: 100%;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.search-field input::placeholder {
  color: var(--text-dim);
}

.sort-select-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select {
  height: 46px;
  padding: 0 38px 0 16px;
  border-radius: 14px;
  background: rgba(8, 13, 24, 0.7);
  border: 1px solid var(--glass-border);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238ACBFF' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  cursor: pointer;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: border-color var(--tr-fast);
}

.sort-select:focus {
  border-color: var(--accent-cyan);
}

/* Category Chips in Frosted Glass */
.category-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: none;
}

.category-chips::-webkit-scrollbar {
  display: none;
}

.chip-btn {
  height: 38px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.chip-btn:hover {
  border-color: rgba(66, 232, 245, 0.4);
  color: #fff;
  transform: translateY(-1px);
}

.chip-btn.active {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  border-color: rgba(255, 255, 255, 0.4);
  color: #060911;
  box-shadow: 0 4px 16px var(--cyan-glow-subtle);
}

/* Secondary Filters (Sizes & Price) */
.secondary-filters-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border-light);
  font-size: 0.82rem;
}

.size-chips-group {
  display: flex;
  align-items: center;
  gap: 7px;
}

.size-filter-label {
  font-weight: 700;
  color: var(--text-dim);
  margin-right: 4px;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
}

.size-btn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.size-btn:hover {
  border-color: var(--accent-cyan);
  color: #fff;
  transform: translateY(-1px);
}

.size-btn.active {
  background: rgba(66, 232, 245, 0.18);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  box-shadow: 0 0 12px rgba(66, 232, 245, 0.25);
}"""

    new_filters = """.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-md);
  margin-bottom: 30px;
}

.search-sort-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 0 16px;
  border-radius: 14px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  flex: 1;
  min-width: min(290px, 100%);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: border-color var(--tr-fast), box-shadow var(--tr-fast);
}

.search-field:focus-within {
  border-color: var(--accent-orange);
  box-shadow: 0 0 0 3px rgba(225, 92, 29, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.04);
}

.search-field svg {
  width: 18px;
  height: 18px;
  stroke: var(--text-dim);
  fill: none;
  stroke-width: 2;
}

.search-field input {
  width: 100%;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.search-field input::placeholder {
  color: var(--text-dim);
}

.sort-select-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select {
  height: 46px;
  padding: 0 38px 0 16px;
  border-radius: 14px;
  background-color: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23E15C1D' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  cursor: pointer;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: border-color var(--tr-fast);
}

.sort-select:focus {
  border-color: var(--accent-orange);
}

/* Category Chips in Frosted Glass */
.category-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: none;
}

.category-chips::-webkit-scrollbar {
  display: none;
}

.chip-btn {
  height: 38px;
  padding: 0 18px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.1);
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.chip-btn:hover {
  border-color: rgba(225, 92, 29, 0.4);
  color: var(--accent-orange);
  transform: translateY(-1px);
}

.chip-btn.active {
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  border-color: transparent;
  color: #FFFFFF;
  box-shadow: 0 4px 14px rgba(225, 92, 29, 0.3);
}

/* Secondary Filters (Sizes & Price) */
.secondary-filters-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border-light);
  font-size: 0.82rem;
}

.size-chips-group {
  display: flex;
  align-items: center;
  gap: 7px;
}

.size-filter-label {
  font-weight: 700;
  color: var(--text-dim);
  margin-right: 4px;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
}

.size-btn {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.1);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.size-btn:hover {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  transform: translateY(-1px);
}

.size-btn.active {
  background: var(--accent-orange-soft);
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  box-shadow: 0 0 10px rgba(225, 92, 29, 0.2);
}"""

    assert old_filters in css, "old_filters not found"
    css = css.replace(old_filters, new_filters, 1)

    # 10. Product Card Grid
    old_product_card = """.product-card {
  position: relative;
  border-radius: 22px;
  background: var(--glass-base);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  transition: transform var(--tr-smooth), box-shadow var(--tr-smooth), border-color var(--tr-smooth);
  cursor: pointer;
  overflow: hidden;
}

/* Reflective Sheen Sweep on Hover */
.product-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: -120%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgba(255, 255, 255, 0.06) 45%,
    rgba(66, 232, 245, 0.12) 50%,
    rgba(255, 255, 255, 0.06) 55%,
    transparent 80%
  );
  transform: skewX(-20deg);
  pointer-events: none;
  z-index: 6;
  transition: left 0.75s ease-in-out;
}

.product-card:hover::after {
  left: 200%;
}

.product-card:hover {
  transform: translateY(-5px) scale(1.008);
  border-color: var(--glass-border-cyan);
  box-shadow: var(--shadow-glass-hover);
}

.product-card.added-pulse {
  border-color: var(--color-success);
  box-shadow: 0 0 28px var(--color-success-glow);
}

/* Badges on Card */
.card-badge-row {
  position: absolute;
  top: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
  pointer-events: none;
}

.card-cat-badge {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(8, 13, 24, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  color: var(--accent-cyan);
}"""

    new_product_card = """.product-card {
  position: relative;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  transition: transform var(--tr-smooth), box-shadow var(--tr-smooth), border-color var(--tr-smooth);
  cursor: pointer;
  overflow: hidden;
}

/* Reflective Sheen Sweep on Hover */
.product-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: -120%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgba(255, 255, 255, 0.7) 45%,
    rgba(225, 92, 29, 0.2) 50%,
    rgba(255, 255, 255, 0.7) 55%,
    transparent 80%
  );
  transform: skewX(-20deg);
  pointer-events: none;
  z-index: 6;
  transition: left 0.75s ease-in-out;
}

.product-card:hover::after {
  left: 200%;
}

.product-card:hover {
  transform: translateY(-5px) scale(1.008);
  border-color: rgba(225, 92, 29, 0.38);
  box-shadow: var(--shadow-glass-hover);
}

.product-card.added-pulse {
  border-color: var(--color-success);
  box-shadow: 0 0 28px var(--color-success-glow);
}

/* Badges on Card */
.card-badge-row {
  position: absolute;
  top: 24px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 5;
  pointer-events: none;
}

.card-cat-badge {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(225, 92, 29, 0.22);
  color: var(--accent-orange);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}"""

    assert old_product_card in css, "old_product_card not found"
    css = css.replace(old_product_card, new_product_card, 1)

    # Product card price and buttons
    old_card_foot = """.card-current-price {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
}

.dual-inr {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: normal;
}

.card-orig-price {
  font-size: 0.8rem;
  color: var(--text-dim);
  text-decoration: line-through;
}

.card-actions-col {
  display: flex;
  gap: 7px;
}

.btn-card-compare {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-card-compare:hover {
  background: rgba(66, 232, 245, 0.12);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  transform: translateY(-1px);
}

.btn-card-compare.active {
  background: rgba(66, 232, 245, 0.2);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.btn-card-compare svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

.btn-card-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  background: rgba(66, 232, 245, 0.12);
  border: 1px solid rgba(66, 232, 245, 0.35);
  color: var(--accent-cyan);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-card-add:hover {
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 16px var(--cyan-glow-subtle);
  transform: translateY(-1px);
}

.btn-card-add.added {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #fff;
  box-shadow: 0 4px 14px var(--color-success-glow);
}"""

    new_card_foot = """.card-current-price {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
}

.dual-inr {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: normal;
}

.card-orig-price {
  font-size: 0.8rem;
  color: var(--text-dim);
  text-decoration: line-through;
}

.card-actions-col {
  display: flex;
  gap: 7px;
}

.btn-card-compare {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.1);
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-card-compare:hover {
  background: var(--accent-orange-soft);
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  transform: translateY(-1px);
}

.btn-card-compare.active {
  background: var(--accent-orange-soft);
  border-color: var(--accent-orange);
  color: var(--accent-orange);
}

.btn-card-compare svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

.btn-card-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  background: var(--accent-orange-soft);
  border: 1px solid var(--accent-orange-border);
  color: var(--accent-orange);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-card-add:hover {
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 16px rgba(225, 92, 29, 0.35);
  transform: translateY(-1px);
}

.btn-card-add.added {
  background: var(--color-success);
  border-color: var(--color-success);
  color: #FFFFFF;
  box-shadow: 0 4px 14px var(--color-success-glow);
}"""

    assert old_card_foot in css, "old_card_foot not found"
    css = css.replace(old_card_foot, new_card_foot, 1)

    # 11. AI Shopping Assistant
    old_ai_card = """.ai-assistant-card {
  max-width: 980px;
  margin: 0 auto;
  border-radius: 28px;
  background: var(--glass-base);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(155, 140, 255, 0.28);
  box-shadow: var(--shadow-glass-lg), 0 0 35px var(--violet-glow);
  overflow: hidden;
}

.ai-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 28px;
  background: rgba(16, 23, 34, 0.85);
  border-bottom: 1px solid var(--glass-border-light);
  flex-wrap: wrap;
  gap: 12px;
}

.ai-header-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ai-avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-violet), var(--accent-cyan));
  display: grid;
  place-items: center;
  box-shadow: 0 0 18px var(--violet-glow);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.ai-avatar svg {
  width: 22px;
  height: 22px;
  stroke: #060911;
  fill: none;
  stroke-width: 2;
}"""

    new_ai_card = """.ai-assistant-card {
  max-width: 980px;
  margin: 0 auto;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(225, 92, 29, 0.25);
  box-shadow: var(--shadow-glass-lg), 0 0 35px rgba(225, 92, 29, 0.08);
  overflow: hidden;
}

.ai-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 28px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid rgba(30, 41, 59, 0.08);
  flex-wrap: wrap;
  gap: 12px;
}

.ai-header-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ai-avatar {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  display: grid;
  place-items: center;
  box-shadow: 0 0 18px rgba(225, 92, 29, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.ai-avatar svg {
  width: 22px;
  height: 22px;
  stroke: #FFFFFF;
  fill: none;
  stroke-width: 2;
}"""

    assert old_ai_card in css, "old_ai_card not found"
    css = css.replace(old_ai_card, new_ai_card, 1)

    # Chat bubbles and input
    old_chat_bubbles = """.chat-bubble.ai {
  align-self: flex-start;
  background: rgba(16, 23, 34, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

.chat-bubble.user {
  align-self: flex-end;
  background: linear-gradient(135deg, rgba(66, 232, 245, 0.25), rgba(138, 203, 255, 0.2));
  backdrop-filter: blur(14px);
  border: 1px solid rgba(66, 232, 245, 0.45);
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 6px 22px rgba(66, 232, 245, 0.18);
}

/* Extracted preferences tags */
.extracted-prefs-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 12px 0 14px;
  padding: 8px 12px;
  background: rgba(8, 13, 24, 0.6);
  border-radius: 11px;
  border: 1px dashed var(--glass-border);
  font-size: 0.72rem;
}

.pref-tag {
  color: var(--accent-cyan);
  font-weight: 700;
}

/* AI Recommendations inside chat */
.ai-recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.ai-rec-card {
  border-radius: 16px;
  background: rgba(10, 15, 24, 0.88);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: transform var(--tr-fast), border-color var(--tr-fast);
}

.ai-rec-card:hover {
  transform: translateY(-2px);
  border-color: var(--glass-border-cyan);
}

.ai-rec-thumb {
  height: 120px;
  border-radius: 10px;
  background: #090E18;
  display: grid;
  place-items: center;
  margin-bottom: 8px;
}

.ai-rec-thumb img {
  max-height: 90%;
  object-fit: contain;
}

.ai-rec-title {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.ai-rec-price {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--accent-cyan);
  margin-bottom: 6px;
}

.ai-rec-reason {
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.35;
  margin-bottom: 10px;
  background: rgba(255, 255, 255, 0.04);
  padding: 6px 8px;
  border-radius: 6px;
}

.ai-rec-actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
}

.ai-btn-add {
  flex: 1;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  font-size: 0.75rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glass-sm);
  transition: transform var(--tr-fast);
}

.ai-btn-add:hover {
  transform: translateY(-1px);
}

.ai-btn-view {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Chat Prompt Suggestions Pills */
.chat-suggestions-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 24px;
  background: rgba(8, 13, 24, 0.6);
  border-top: 1px solid var(--glass-border-light);
  scrollbar-width: none;
}

.chat-suggestions-bar::-webkit-scrollbar {
  display: none;
}

.suggestion-pill {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  white-space: nowrap;
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.suggestion-pill:hover {
  background: rgba(66, 232, 245, 0.12);
  border-color: var(--accent-cyan);
  color: #fff;
  transform: translateY(-1px);
}

/* Chat Input Bar */
.ai-input-form {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(14, 20, 32, 0.9);
  border-top: 1px solid var(--glass-border-light);
}

.ai-input-field {
  flex: 1;
  height: 48px;
  padding: 0 18px;
  border-radius: 14px;
  background: rgba(8, 13, 24, 0.7);
  border: 1px solid var(--glass-border);
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: border-color var(--tr-fast), box-shadow var(--tr-fast);
}

.ai-input-field:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 16px var(--cyan-glow-subtle), inset 0 1px 2px rgba(0, 0, 0, 0.4);
}

.btn-ai-send {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  display: grid;
  place-items: center;
  flex: none;
  box-shadow: 0 4px 16px var(--cyan-glow-subtle);
  transition: transform var(--tr-fast);
}

.btn-ai-send:hover {
  transform: scale(1.05);
}

.btn-ai-send svg {
  width: 20px;
  height: 20px;
  fill: #060911;
}"""

    new_chat_bubbles = """.chat-bubble.ai {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(30, 41, 59, 0.09);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
  box-shadow: 0 4px 14px rgba(30, 41, 59, 0.05);
}

.chat-bubble.user {
  align-self: flex-end;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(225, 92, 29, 0.4);
  color: #FFFFFF;
  border-bottom-right-radius: 4px;
  box-shadow: 0 6px 20px rgba(225, 92, 29, 0.25);
}

/* Extracted preferences tags */
.extracted-prefs-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 12px 0 14px;
  padding: 8px 12px;
  background: var(--accent-orange-soft);
  border-radius: 11px;
  border: 1px dashed rgba(225, 92, 29, 0.3);
  font-size: 0.72rem;
}

.pref-tag {
  color: var(--accent-orange);
  font-weight: 700;
}

/* AI Recommendations inside chat */
.ai-recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.ai-rec-card {
  border-radius: 16px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.09);
  box-shadow: var(--shadow-glass-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: transform var(--tr-fast), border-color var(--tr-fast);
}

.ai-rec-card:hover {
  transform: translateY(-2px);
  border-color: rgba(225, 92, 29, 0.35);
  box-shadow: var(--shadow-glass-md);
}

.ai-rec-thumb {
  height: 120px;
  border-radius: 10px;
  background: #151F2E;
  display: grid;
  place-items: center;
  margin-bottom: 8px;
}

.ai-rec-thumb img {
  max-height: 90%;
  object-fit: contain;
}

.ai-rec-title {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.ai-rec-price {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--accent-orange);
  margin-bottom: 6px;
}

.ai-rec-reason {
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.35;
  margin-bottom: 10px;
  background: var(--accent-orange-soft);
  padding: 6px 8px;
  border-radius: 6px;
}

.ai-rec-actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
}

.ai-btn-add {
  flex: 1;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  font-size: 0.75rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glass-sm);
  transition: transform var(--tr-fast);
}

.ai-btn-add:hover {
  transform: translateY(-1px);
}

.ai-btn-view {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.12);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Chat Prompt Suggestions Pills */
.chat-suggestions-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 24px;
  background: rgba(250, 248, 245, 0.9);
  border-top: 1px solid rgba(30, 41, 59, 0.08);
  scrollbar-width: none;
}

.chat-suggestions-bar::-webkit-scrollbar {
  display: none;
}

.suggestion-pill {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.1);
  color: var(--text-secondary);
  white-space: nowrap;
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.suggestion-pill:hover {
  background: var(--accent-orange-soft);
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  transform: translateY(-1px);
}

/* Chat Input Bar */
.ai-input-form {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid rgba(30, 41, 59, 0.08);
}

.ai-input-field {
  flex: 1;
  height: 48px;
  padding: 0 18px;
  border-radius: 14px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color var(--tr-fast), box-shadow var(--tr-fast);
}

.ai-input-field:focus {
  border-color: var(--accent-orange);
  box-shadow: 0 0 0 3px rgba(225, 92, 29, 0.15);
}

.btn-ai-send {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  display: grid;
  place-items: center;
  flex: none;
  box-shadow: 0 4px 16px rgba(225, 92, 29, 0.3);
  transition: transform var(--tr-fast);
}

.btn-ai-send:hover {
  transform: scale(1.05);
}

.btn-ai-send svg {
  width: 20px;
  height: 20px;
  fill: #FFFFFF;
}"""

    assert old_chat_bubbles in css, "old_chat_bubbles not found"
    css = css.replace(old_chat_bubbles, new_chat_bubbles, 1)

    # 12. Product Details Modal
    old_modal = """.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 8, 16, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: grid;
  place-items: center;
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--tr-base), visibility var(--tr-base);
}

.modal-backdrop.open {
  opacity: 1;
  visibility: visible;
}

.modal-content-box {
  width: min(880px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 28px;
  background: var(--glass-modal);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border-highlight);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 40px var(--cyan-glow-subtle), inset 0 1px 1px rgba(255, 255, 255, 0.25);
  position: relative;
  transform: translateY(20px) scale(0.97);
  transition: transform var(--tr-spring);
}

.modal-backdrop.open .modal-content-box {
  transform: translateY(0) scale(1);
}

.modal-close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  z-index: 10;
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  transform: rotate(90deg);
}"""

    new_modal = """.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(30, 41, 59, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: grid;
  place-items: center;
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--tr-base), visibility var(--tr-base);
}

.modal-backdrop.open {
  opacity: 1;
  visibility: visible;
}

.modal-content-box {
  width: min(880px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(30, 41, 59, 0.1);
  box-shadow: 0 24px 60px rgba(30, 41, 59, 0.18), 0 0 35px rgba(225, 92, 29, 0.1), inset 0 1px 1px rgba(255, 255, 255, 0.95);
  position: relative;
  transform: translateY(20px) scale(0.97);
  transition: transform var(--tr-spring);
}

.modal-backdrop.open .modal-content-box {
  transform: translateY(0) scale(1);
}

.modal-close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(30, 41, 59, 0.05);
  border: 1px solid rgba(30, 41, 59, 0.08);
  display: grid;
  place-items: center;
  z-index: 10;
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.modal-close-btn:hover {
  background: rgba(30, 41, 59, 0.1);
  color: var(--text-primary);
  transform: rotate(90deg);
}"""

    assert old_modal in css, "old_modal not found"
    css = css.replace(old_modal, new_modal, 1)

    # Modal details pricing, sizes and actions
    old_modal_details = """.modal-cat-tag {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-cyan);
  margin-bottom: 8px;
}

.modal-product-title {
  font-size: 1.65rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.modal-price-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-price-current {
  font-size: 1.75rem;
  font-weight: 800;
  color: #fff;
}

.modal-price-current .dual-inr {
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}

.modal-price-orig {
  font-size: 1rem;
  color: var(--text-dim);
  text-decoration: line-through;
}

.modal-price-orig .dual-inr {
  font-size: 0.85rem;
  color: var(--text-dim);
}

.modal-desc {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 22px;
}

.modal-option-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.modal-swatches-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.color-swatch-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
  transition: transform var(--tr-fast);
}

.color-swatch-btn:hover {
  transform: scale(1.15);
}

.color-swatch-btn.selected {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 12px var(--accent-cyan);
}

.modal-sizes-row {
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
}

.modal-size-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.modal-size-btn:hover {
  border-color: var(--accent-cyan);
}

.modal-size-btn.selected {
  background: rgba(66, 232, 245, 0.18);
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  box-shadow: 0 0 12px rgba(66, 232, 245, 0.3);
}

.modal-size-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
  text-decoration: line-through;
}

.modal-stock-indicator {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-success);
  margin-bottom: 24px;
}

.modal-actions-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: auto;
}

.modal-qty-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(8, 13, 24, 0.7);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
}

.modal-qty-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-qty-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-modal-add {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  font-weight: 800;
  font-size: 0.92rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 6px 20px var(--cyan-glow-subtle);
  transition: all var(--tr-fast);
}

.btn-modal-add:hover {
  box-shadow: 0 8px 28px var(--cyan-glow-strong);
  transform: translateY(-1px);
}"""

    new_modal_details = """.modal-cat-tag {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-orange);
  margin-bottom: 8px;
}

.modal-product-title {
  font-size: 1.65rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.modal-price-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-price-current {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-price-current .dual-inr {
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}

.modal-price-orig {
  font-size: 1rem;
  color: var(--text-dim);
  text-decoration: line-through;
}

.modal-price-orig .dual-inr {
  font-size: 0.85rem;
  color: var(--text-dim);
}

.modal-desc {
  font-size: 0.88rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 22px;
}

.modal-option-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 8px;
}

.modal-swatches-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.color-swatch-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
  transition: transform var(--tr-fast);
}

.color-swatch-btn:hover {
  transform: scale(1.15);
}

.color-swatch-btn.selected {
  border-color: var(--accent-orange);
  box-shadow: 0 0 12px var(--accent-orange);
}

.modal-sizes-row {
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
}

.modal-size-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.modal-size-btn:hover {
  border-color: var(--accent-orange);
}

.modal-size-btn.selected {
  background: var(--accent-orange-soft);
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  box-shadow: 0 0 10px rgba(225, 92, 29, 0.2);
}

.modal-size-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
  text-decoration: line-through;
}

.modal-stock-indicator {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-success);
  margin-bottom: 24px;
}

.modal-actions-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: auto;
}

.modal-qty-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 12px;
  border-radius: 12px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  box-shadow: var(--shadow-glass-sm);
}

.modal-qty-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.05);
  border: 1px solid rgba(30, 41, 59, 0.08);
  display: grid;
  place-items: center;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-qty-btn:hover {
  background: rgba(30, 41, 59, 0.1);
}

.btn-modal-add {
  flex: 1;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 0.92rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 6px 20px rgba(225, 92, 29, 0.35);
  transition: all var(--tr-fast);
}

.btn-modal-add:hover {
  box-shadow: 0 8px 28px rgba(225, 92, 29, 0.45);
  transform: translateY(-1px);
  color: #FFFFFF;
}"""

    assert old_modal_details in css, "old_modal_details not found"
    css = css.replace(old_modal_details, new_modal_details, 1)

    # 13. Comparison Drawer & Modal Table
    old_compare = """.compare-sticky-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(110px);
  z-index: 55;
  background: rgba(14, 20, 32, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border-cyan);
  border-radius: 20px;
  padding: 12px 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.75), 0 0 25px var(--cyan-glow-subtle);
  transition: transform var(--tr-smooth);
}

.compare-sticky-bar.visible {
  transform: translateX(-50%) translateY(0);
}

.compare-thumbs-strip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compare-thumb-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #090E18;
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  overflow: hidden;
  position: relative;
}

.compare-thumb-box img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.compare-thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 9px;
  line-height: 1;
}

.btn-open-compare {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  font-weight: 800;
  font-size: 0.82rem;
  box-shadow: var(--shadow-glass-sm);
}

/* Comparison Modal Table */
.compare-modal-box {
  width: min(1040px, 95vw);
  max-height: 85vh;
  overflow-y: auto;
  border-radius: 26px;
  background: var(--glass-modal);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border-highlight);
  box-shadow: var(--shadow-glass-lg);
  padding: 30px;
}"""

    new_compare = """.compare-sticky-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(110px);
  z-index: 55;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(225, 92, 29, 0.35);
  border-radius: 20px;
  padding: 12px 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  box-shadow: 0 16px 44px rgba(30, 41, 59, 0.15), 0 0 25px rgba(225, 92, 29, 0.12);
  transition: transform var(--tr-smooth);
}

.compare-sticky-bar.visible {
  transform: translateX(-50%) translateY(0);
}

.compare-thumbs-strip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compare-thumb-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #151F2E;
  border: 1px solid rgba(225, 92, 29, 0.25);
  display: grid;
  place-items: center;
  overflow: hidden;
  position: relative;
}

.compare-thumb-box img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.compare-thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font-size: 9px;
  line-height: 1;
}

.btn-open-compare {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 0.82rem;
  box-shadow: 0 4px 14px rgba(225, 92, 29, 0.3);
}

/* Comparison Modal Table */
.compare-modal-box {
  width: min(1040px, 95vw);
  max-height: 85vh;
  overflow-y: auto;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(30, 41, 59, 0.1);
  box-shadow: 0 24px 60px rgba(30, 41, 59, 0.2);
  padding: 30px;
}"""

    assert old_compare in css, "old_compare not found"
    css = css.replace(old_compare, new_compare, 1)

    # 14. Cart Floating Pill & Drawer
    old_cart_pill = """.cart-floating-pill {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 14px 0 10px;
  border-radius: 999px;
  background: var(--glass-heavy);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border-cyan);
  color: #fff;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.75), 0 0 24px var(--cyan-glow-subtle);
  transition: opacity 0.35s, transform 0.45s cubic-bezier(0.2, 1.2, 0.3, 1);
}

.cart-floating-pill.hide {
  opacity: 0;
  transform: translateY(24px) scale(0.85);
  pointer-events: none;
}

.cart-pill-stack {
  display: flex;
}

.cart-pill-stack i {
  width: 36px;
  height: 36px;
  margin-left: -12px;
  border-radius: 50%;
  background: #080D18;
  border: 2px solid var(--accent-cyan);
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 0 8px rgba(66, 232, 245, 0.3);
}

.cart-pill-stack i:first-child {
  margin-left: 0;
}

.cart-pill-stack img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.cart-pill-tx {
  text-align: left;
  padding-right: 4px;
}

.cart-pill-tx b {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
}

.cart-pill-tx small {
  font-size: 0.72rem;
  color: var(--accent-cyan);
}

.cart-pill-chev {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(66, 232, 245, 0.15);
  display: grid;
  place-items: center;
}

.cart-pill-chev svg {
  width: 14px;
  height: 14px;
  stroke: var(--accent-cyan);
  fill: none;
  stroke-width: 2.5;
}

/* Cart Slide-Out Drawer Panel */
.cart-drawer-panel {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 70;
  width: min(390px, calc(100vw - 32px));
  max-height: calc(100vh - 56px);
  padding: 22px;
  border-radius: 26px;
  background: rgba(14, 20, 32, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border-cyan);
  box-shadow: 0 28px 75px rgba(0, 0, 0, 0.85), 0 0 35px var(--cyan-glow-subtle);
  transform-origin: 100% 100%;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.cart-drawer-panel[hidden] {
  display: none;
}

.cart-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--glass-border-light);
}

.cart-head svg {
  width: 20px;
  height: 20px;
  stroke: var(--accent-cyan);
  fill: none;
  stroke-width: 2;
}

.cart-head b {
  font-size: 1.05rem;
  font-weight: 800;
}

.cart-head-cnt {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(66, 232, 245, 0.15);
  color: var(--accent-cyan);
}

.cart-close-x {
  margin-left: auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.cart-close-x:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: rotate(90deg);
}"""

    new_cart_pill = """.cart-floating-pill {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 14px 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(225, 92, 29, 0.35);
  color: var(--text-primary);
  box-shadow: 0 14px 36px rgba(30, 41, 59, 0.14), 0 0 24px rgba(225, 92, 29, 0.15);
  transition: opacity 0.35s, transform 0.45s cubic-bezier(0.2, 1.2, 0.3, 1);
}

.cart-floating-pill.hide {
  opacity: 0;
  transform: translateY(24px) scale(0.85);
  pointer-events: none;
}

.cart-pill-stack {
  display: flex;
}

.cart-pill-stack i {
  width: 36px;
  height: 36px;
  margin-left: -12px;
  border-radius: 50%;
  background: #151F2E;
  border: 2px solid var(--accent-orange);
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow: 0 0 8px rgba(225, 92, 29, 0.3);
}

.cart-pill-stack i:first-child {
  margin-left: 0;
}

.cart-pill-stack img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.cart-pill-tx {
  text-align: left;
  padding-right: 4px;
}

.cart-pill-tx b {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
}

.cart-pill-tx small {
  font-size: 0.72rem;
  color: var(--accent-orange);
}

.cart-pill-chev {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-orange-soft);
  display: grid;
  place-items: center;
}

.cart-pill-chev svg {
  width: 14px;
  height: 14px;
  stroke: var(--accent-orange);
  fill: none;
  stroke-width: 2.5;
}

/* Cart Slide-Out Drawer Panel */
.cart-drawer-panel {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 70;
  width: min(390px, calc(100vw - 32px));
  max-height: calc(100vh - 56px);
  padding: 22px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(30, 41, 59, 0.1);
  box-shadow: -10px 0 40px rgba(30, 41, 59, 0.15), 0 0 35px rgba(225, 92, 29, 0.1);
  transform-origin: 100% 100%;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.cart-drawer-panel[hidden] {
  display: none;
}

.cart-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--glass-border-light);
}

.cart-head svg {
  width: 20px;
  height: 20px;
  stroke: var(--accent-orange);
  fill: none;
  stroke-width: 2;
}

.cart-head b {
  font-size: 1.05rem;
  font-weight: 800;
}

.cart-head-cnt {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-orange-soft);
  color: var(--accent-orange);
}

.cart-close-x {
  margin-left: auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(30, 41, 59, 0.05);
  border: 1px solid rgba(30, 41, 59, 0.08);
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.cart-close-x:hover {
  background: rgba(30, 41, 59, 0.1);
  color: var(--text-primary);
  transform: rotate(90deg);
}"""

    assert old_cart_pill in css, "old_cart_pill not found"
    css = css.replace(old_cart_pill, new_cart_pill, 1)

    # Cart item row and delivery status
    old_cart_items = """.cart-item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
}

.cart-item-thumb {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #090E18;
  display: grid;
  place-items: center;
  flex: none;
  overflow: hidden;
}

.cart-item-thumb img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.cart-item-mid {
  flex: 1;
  min-width: 0;
}

.cart-item-meta {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--accent-cyan);
}

.cart-item-title {
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-item-variant {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.cart-qty-stepper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 0.78rem;
  font-weight: 700;
}

.cart-qty-stepper button {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.cart-qty-stepper button:hover {
  background: rgba(66, 232, 245, 0.25);
  color: #fff;
}

.cart-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.cart-item-price {
  font-size: 0.88rem;
  font-weight: 800;
}

.cart-item-del-btn {
  color: var(--text-dim);
  transition: color var(--tr-fast);
}

.cart-item-del-btn:hover {
  color: var(--color-error);
}

.cart-item-del-btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

/* Delivery Progress Indicator in Liquid Glass */
.cart-delivery-status {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  font-size: 0.78rem;
  overflow: hidden;
  margin-bottom: 12px;
}

.cart-delivery-status svg {
  width: 18px;
  height: 18px;
  stroke: var(--accent-cyan);
  fill: none;
  stroke-width: 2;
  flex: none;
}

.cart-delivery-status.checking svg {
  animation: truckDrive 1.2s ease-in-out infinite;
}

@keyframes truckDrive {
  50% { transform: translateX(5px); }
}

.cart-delivery-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent-ice));
  box-shadow: 0 0 8px var(--accent-cyan);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.cart-sum-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.cart-sum-row.total-row {
  font-size: 0.95rem;
  font-weight: 800;
  color: #fff;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px solid var(--glass-border-light);
  margin-bottom: 16px;
}

.cart-sum-row.total-row strong {
  font-size: 1.35rem;
  color: #fff;
}

.btn-cart-checkout {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  font-size: 0.92rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 24px var(--cyan-glow-subtle);
  transition: transform var(--tr-fast), box-shadow var(--tr-fast);
}

.btn-cart-checkout:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 32px var(--cyan-glow-strong);
}"""

    new_cart_items = """.cart-item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-sm);
}

.cart-item-thumb {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #151F2E;
  display: grid;
  place-items: center;
  flex: none;
  overflow: hidden;
}

.cart-item-thumb img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.cart-item-mid {
  flex: 1;
  min-width: 0;
}

.cart-item-meta {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--accent-orange);
}

.cart-item-title {
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-item-variant {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 1px;
}

.cart-qty-stepper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 0.78rem;
  font-weight: 700;
}

.cart-qty-stepper button {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.05);
  border: 1px solid rgba(30, 41, 59, 0.08);
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.cart-qty-stepper button:hover {
  background: var(--accent-orange-soft);
  color: var(--accent-orange);
}

.cart-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.cart-item-price {
  font-size: 0.88rem;
  font-weight: 800;
}

.cart-item-del-btn {
  color: var(--text-dim);
  transition: color var(--tr-fast);
}

.cart-item-del-btn:hover {
  color: var(--color-error);
}

.cart-item-del-btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
}

/* Delivery Progress Indicator in Liquid Glass */
.cart-delivery-status {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--accent-orange-soft);
  border: 1px solid var(--accent-orange-border);
  font-size: 0.78rem;
  overflow: hidden;
  margin-bottom: 12px;
}

.cart-delivery-status svg {
  width: 18px;
  height: 18px;
  stroke: var(--accent-orange);
  fill: none;
  stroke-width: 2;
  flex: none;
}

.cart-delivery-status.checking svg {
  animation: truckDrive 1.2s ease-in-out infinite;
}

@keyframes truckDrive {
  50% { transform: translateX(5px); }
}

.cart-delivery-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, #FF6F32, #DE5216);
  box-shadow: 0 0 8px rgba(225, 92, 29, 0.4);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.cart-sum-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.cart-sum-row.total-row {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  padding-top: 10px;
  margin-top: 8px;
  border-top: 1px solid rgba(30, 41, 59, 0.08);
  margin-bottom: 16px;
}

.cart-sum-row.total-row strong {
  font-size: 1.35rem;
  color: var(--text-primary);
}

.btn-cart-checkout {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  font-size: 0.92rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 24px rgba(225, 92, 29, 0.3);
  transition: transform var(--tr-fast), box-shadow var(--tr-fast);
}

.btn-cart-checkout:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 32px rgba(225, 92, 29, 0.45);
  color: #FFFFFF;
}"""

    assert old_cart_items in css, "old_cart_items not found"
    css = css.replace(old_cart_items, new_cart_items, 1)

    # 15. Checkout Modal & Inputs
    old_checkout = """.checkout-modal-box {
  width: min(620px, 95vw);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 26px;
  background: var(--glass-modal);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border-highlight);
  box-shadow: var(--shadow-glass-lg);
  padding: 28px;
}

.checkout-step-title {
  font-size: 1.3rem;
  font-weight: 800;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.checkout-step-title svg {
  width: 22px;
  height: 22px;
  stroke: var(--accent-cyan);
  fill: none;
}

.checkout-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 20px;
}

.form-full-col {
  grid-column: 1 / -1;
}

.checkout-input-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.checkout-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: rgba(8, 13, 24, 0.7);
  border: 1px solid var(--glass-border);
  color: #fff;
  font-size: 0.88rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: border-color var(--tr-fast);
}

.checkout-input:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 12px var(--cyan-glow-subtle);
}

/* Summary Box in Checkout */
.checkout-summary-card {
  padding: 16px;
  border-radius: 16px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
  margin-bottom: 22px;
}

.checkout-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  padding: 4px 0;
  color: var(--text-secondary);
}

.checkout-summary-row.total {
  font-weight: 800;
  font-size: 1rem;
  color: #fff;
  border-top: 1px solid var(--glass-border-light);
  padding-top: 8px;
  margin-top: 6px;
}"""

    new_checkout = """.checkout-modal-box {
  width: min(620px, 95vw);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(30, 41, 59, 0.1);
  box-shadow: 0 24px 60px rgba(30, 41, 59, 0.18);
  padding: 28px;
}

.checkout-step-title {
  font-size: 1.3rem;
  font-weight: 800;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.checkout-step-title svg {
  width: 22px;
  height: 22px;
  stroke: var(--accent-orange);
  fill: none;
}

.checkout-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 20px;
}

.form-full-col {
  grid-column: 1 / -1;
}

.checkout-input-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.checkout-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  color: var(--text-primary);
  font-size: 0.88rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color var(--tr-fast);
}

.checkout-input:focus {
  border-color: var(--accent-orange);
  box-shadow: 0 0 0 3px rgba(225, 92, 29, 0.15);
}

/* Summary Box in Checkout */
.checkout-summary-card {
  padding: 16px;
  border-radius: 16px;
  background: rgba(250, 248, 245, 0.85);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-sm);
  margin-bottom: 22px;
}

.checkout-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  padding: 4px 0;
  color: var(--text-secondary);
}

.checkout-summary-row.total {
  font-weight: 800;
  font-size: 1rem;
  color: var(--text-primary);
  border-top: 1px solid rgba(30, 41, 59, 0.08);
  padding-top: 8px;
  margin-top: 6px;
}"""

    assert old_checkout in css, "old_checkout not found"
    css = css.replace(old_checkout, new_checkout, 1)

    # 16. Order receipt card
    old_receipt = """.order-receipt-card {
  text-align: left;
  padding: 16px;
  border-radius: 16px;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
  margin: 20px 0;
  font-size: 0.85rem;
}

.receipt-item-line {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}"""

    new_receipt = """.order-receipt-card {
  text-align: left;
  padding: 16px;
  border-radius: 16px;
  background: rgba(250, 248, 245, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-sm);
  margin: 20px 0;
  font-size: 0.85rem;
}

.receipt-item-line {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(30, 41, 59, 0.06);
}"""

    assert old_receipt in css, "old_receipt not found"
    css = css.replace(old_receipt, new_receipt, 1)

    # 17. Materials & Tech section
    old_materials = """.material-card {
  padding: 28px;
  border-radius: 22px;
  background: var(--glass-base);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-md);
  transition: transform var(--tr-smooth), border-color var(--tr-smooth), box-shadow var(--tr-smooth);
}

.material-card:hover {
  transform: translateY(-5px);
  border-color: var(--glass-border-cyan);
  box-shadow: var(--shadow-glass-hover);
}

.material-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(66, 232, 245, 0.1);
  border: 1px solid rgba(66, 232, 245, 0.25);
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  box-shadow: 0 0 14px var(--cyan-glow-subtle);
}

.material-icon-box svg {
  width: 22px;
  height: 22px;
  stroke: var(--accent-cyan);
  fill: none;
  stroke-width: 2;
}"""

    new_materials = """.material-card {
  padding: 28px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-md);
  transition: transform var(--tr-smooth), border-color var(--tr-smooth), box-shadow var(--tr-smooth);
}

.material-card:hover {
  transform: translateY(-5px);
  border-color: rgba(225, 92, 29, 0.35);
  box-shadow: var(--shadow-glass-hover);
}

.material-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--accent-orange-soft);
  border: 1px solid var(--accent-orange-border);
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  box-shadow: 0 0 14px rgba(225, 92, 29, 0.12);
}

.material-icon-box svg {
  width: 22px;
  height: 22px;
  stroke: var(--accent-orange);
  fill: none;
  stroke-width: 2;
}"""

    assert old_materials in css, "old_materials not found"
    css = css.replace(old_materials, new_materials, 1)

    # 18. Reviews
    old_reviews = """.review-card {
  padding: 24px;
  border-radius: 20px;
  background: var(--glass-base);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass-sm);
  display: flex;
  flex-direction: column;
  transition: transform var(--tr-fast);
}

.review-card:hover {
  transform: translateY(-3px);
  border-color: rgba(138, 203, 255, 0.3);
}

.review-stars-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--color-amber);
}

.review-quote {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.55;
  margin-bottom: 16px;
  font-style: italic;
}

.review-author-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}

.review-author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--glass-chip);
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--accent-cyan);
}"""

    new_reviews = """.review-card {
  padding: 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: var(--shadow-glass-sm);
  display: flex;
  flex-direction: column;
  transition: transform var(--tr-fast);
}

.review-card:hover {
  transform: translateY(-3px);
  border-color: rgba(225, 92, 29, 0.28);
  box-shadow: var(--shadow-glass-md);
}

.review-stars-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--color-amber);
}

.review-quote {
  font-size: 0.88rem;
  color: var(--text-primary);
  line-height: 1.55;
  margin-bottom: 16px;
  font-style: italic;
}

.review-author-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
}

.review-author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent-orange-soft);
  border: 1px solid var(--accent-orange-border);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--accent-orange);
}"""

    assert old_reviews in css, "old_reviews not found"
    css = css.replace(old_reviews, new_reviews, 1)

    # 19. Newsletter
    old_news = """.newsletter-card {
  max-width: 820px;
  margin: 0 auto;
  border-radius: 26px;
  background: var(--glass-base);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border-highlight);
  box-shadow: var(--shadow-glass-lg);
  padding: clamp(32px, 5vw, 48px);
  text-align: center;
}

.newsletter-card h2 {
  font-size: clamp(1.8rem, 3.5vw, 2.4rem);
  font-weight: 800;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.newsletter-card p {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 24px;
}

.newsletter-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto 14px;
  flex-wrap: wrap;
}

.newsletter-input {
  flex: 1;
  min-width: 240px;
  height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  background: rgba(8, 13, 24, 0.7);
  border: 1px solid var(--glass-border);
  color: #fff;
  font-size: 0.9rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
}

.newsletter-input:focus {
  border-color: var(--accent-cyan);
}

.btn-newsletter-sub {
  height: 48px;
  padding: 0 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-ice));
  color: #060911;
  font-weight: 800;
  font-size: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: var(--shadow-glass-sm);
  transition: all var(--tr-fast);
}

.btn-newsletter-sub:hover {
  box-shadow: 0 6px 20px var(--cyan-glow-subtle);
  transform: translateY(-1px);
}"""

    new_news = """.newsletter-card {
  max-width: 820px;
  margin: 0 auto;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(30, 41, 59, 0.1);
  box-shadow: var(--shadow-glass-lg);
  padding: clamp(32px, 5vw, 48px);
  text-align: center;
}

.newsletter-card h2 {
  font-size: clamp(1.8rem, 3.5vw, 2.4rem);
  font-weight: 800;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.newsletter-card p {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 24px;
}

.newsletter-form {
  display: flex;
  gap: 12px;
  max-width: 500px;
  margin: 0 auto 14px;
  flex-wrap: wrap;
}

.newsletter-input {
  flex: 1;
  min-width: 240px;
  height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  background: #FFFFFF;
  border: 1px solid rgba(30, 41, 59, 0.12);
  color: var(--text-primary);
  font-size: 0.9rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.03);
}

.newsletter-input:focus {
  border-color: var(--accent-orange);
  box-shadow: 0 0 0 3px rgba(225, 92, 29, 0.15);
}

.btn-newsletter-sub {
  height: 48px;
  padding: 0 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, #FF6F32, #DE5216);
  color: #FFFFFF;
  font-weight: 800;
  font-size: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 16px rgba(225, 92, 29, 0.3);
  transition: all var(--tr-fast);
}

.btn-newsletter-sub:hover {
  box-shadow: 0 6px 24px rgba(225, 92, 29, 0.45);
  transform: translateY(-1px);
}"""

    assert old_news in css, "old_news not found"
    css = css.replace(old_news, new_news, 1)

    # 20. Footer (Slate Navy matching image bottom-left)
    old_footer = """.site-footer {
  background: rgba(5, 8, 16, 0.96);
  border-top: 1px solid var(--glass-border-light);
  padding: 60px 0 36px;
  font-size: 0.82rem;
  color: var(--text-dim);
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-col h4 {
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  margin-bottom: 14px;
}

.footer-col ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-col a:hover {
  color: var(--accent-cyan);
}

.footer-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 1px solid var(--glass-border-light);
  flex-wrap: wrap;
  gap: 16px;
}"""

    new_footer = """.site-footer {
  background: #1E2530;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 60px 0 36px;
  font-size: 0.82rem;
  color: #94A3B8;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}

.footer-col h4 {
  color: #FFFFFF;
  font-size: 0.88rem;
  font-weight: 700;
  margin-bottom: 14px;
}

.footer-col ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-col a:hover {
  color: #FF6F32;
}

.footer-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-wrap: wrap;
  gap: 16px;
}"""

    assert old_footer in css, "old_footer not found"
    css = css.replace(old_footer, new_footer, 1)

    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)

    print("styles.css successfully updated to LabConnect Warm Glass Theme!")

if __name__ == '__main__':
    update_theme()
