# AgentCart AI — Your Personal AI Jacket Shopper

> **Tagline:** Find Your Style. Shop Smarter.  
> Premium futuristic fashion-tech outerwear e-commerce platform powered by Google Gemini AI, SQLite, and PayPal Sandbox Checkout.

---

## 1. Overview & Aesthetic Direction

AgentCart AI is a high-performance, dark-themed technical outerwear online shopping destination. Designed with a luxury cyber-technical aesthetic inspired by leading outdoor brands, the application features:
- **Palette:** Deep pitch black and charcoal backgrounds (`#07080a`, `#0c0d12`), neon electric cyan accents (`#00f0ff`, `#0070f3`), and subtle frosted glass surfaces (`backdrop-filter: blur(16px)`).
- **Hero Section:** Cinematic technical jacket showcase featuring the flagship CyberShell Stormbreaker, technical specifications, and instant shopping call-to-action.
- **Outerwear Specialization:** Exclusively jackets — zero agricultural or produce content.
- **Preserved Interactions:** Seamlessly retains and enhances the beloved cart mechanics from `apmc.html` (flying jacket animations, morphing cart drawer, and interactive free shipping progress bar).

---

## 2. Key Features

### 🛍️ Jacket-Only Product Catalogue (24 Distinct Models)
- Across 10 core categories:
  1. Technical Windbreakers
  2. Lightweight Rain Jackets
  3. Bomber Jackets
  4. Denim Jackets
  5. Puffer Jackets
  6. Hooded Jackets
  7. Casual Everyday Jackets
  8. Sports and Outdoor Jackets
  9. Minimalist Urban Jackets
  10. Insulated Winter Jackets
- Every listing includes authentic Indian Rupee (`₹`) pricing (e.g. ₹1,499 to ₹4,699), original demo comparison prices, variant colorways, size breakdown (`XS` to `XXL`) with live stock counts, hydrostatic head ratings (`28,000mm`), and high-resolution local photography (`assets/images/jackets/`).

### 🔍 Product Search, Category Filtering & Sorting
- Real-time search matching jacket titles, materials (GORE-TEX, Cordura, Kevlar, Ripstop), colors, and features.
- Horizontal category chips carousel.
- Size chips filter (`XS`, `S`, `M`, `L`, `XL`, `XXL`).
- Interactive max-price slider (₹1,400 to ₹5,000).
- Multi-criteria sorting (Featured First, Price: Low to High, Price: High to Low, Name: A–Z, Highest Rated).
- Live counter with zero-state reset capability.

### 🤖 Grounded AI Shopping Assistant (Gemini 2.5 + Heuristic Fallback)
- Natural language conversational assistant grounded strictly in actual catalog inventory.
- Understands complex constraints: *"Find me a black waterproof-style jacket under ₹2,000 in size M for everyday use"*.
- Extracts budget, color, size, occasion, and technical requirements.
- Returns ranked matches with transparent reasoning and trade-off analysis.
- One-click "Add to Cart" directly from inside the chat stream!
- **Zero-Friction Fallback:** Operates out of the box with an intelligent local heuristic matcher when `GEMINI_API_KEY` is not supplied, clearly labeled as demo mode.

### ⚖️ Side-by-Side Product Comparison
- Select up to 4 jackets with a persistent floating bottom tray.
- Side-by-side modal matrix comparing hydrostatic waterproofing, breathability, weight, materials, fit, hardware, and pricing.

### 🛒 Cart & Flying Animation (APMC Enhanced)
- Interactive Add to Cart buttons on product cards, modal, and AI chat.
- Parabolic flying item animation where jacket miniatures lift off and drop into the floating cart pill.
- Morphing cart drawer with free delivery progress calculation (Free shipping above ₹2,000; ₹150 delivery fee below).
- Persistent cart state using browser `localStorage`.

### 💳 Secure PayPal Sandbox Checkout Flow
- Client never dictates payment totals. All prices and discounts are recalculated strictly on the server against the SQLite database.
- Supports official PayPal Sandbox SDK creation and capture when credentials are configured.
- Seamless demo test purchase workflow when credentials are unset, recording the order in the SQLite database and presenting an official itemized receipt.

---

## 3. Technology Stack & Architecture

- **Frontend:** Vanilla Modern JavaScript (ES6+), Semantic HTML5, Custom Cyberpunk CSS with CSS Variables & Glassmorphism.
- **Backend:** Node.js v24 + Express REST API.
- **Database:** SQLite (`node:sqlite` built-in, zero native compilation required on Windows).
- **AI Engine:** Google Gemini API (`gemini-2.5-flash` / `gemini-1.5-flash`) via Google AI Studio + Grounded Catalog Heuristic Fallback.
- **Payments:** Official PayPal Sandbox Checkout API (`/v2/checkout/orders`).

---

## 4. Installation & Local Startup

### Prerequisites
- Node.js (v20+ recommended, v24 tested)
- npm (v10+)

### Setup
1. Open a terminal in the project directory:
   ```bash
   cd D:\AgentCart-AI
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the SQLite database (auto-initializes on startup, or seed manually):
   ```bash
   npm run seed
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser at:
   ```
   http://localhost:3000
   ```

*Note:* You can also open `index.html` directly in any web browser (`file:///D:/AgentCart-AI/index.html`) to test the frontend UI and shopping cart offline!

---

## 5. Configuration & Environment Variables

Copy `.env.example` to `.env` to configure optional live API keys:

```bash
# Server Port
PORT=3000

# Google Gemini API Key (optional for live LLM mode)
# Obtain from https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# PayPal Sandbox Credentials (optional for live PayPal popup)
# Obtain from https://developer.paypal.com/dashboard/applications/sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_CURRENCY=USD
```

---

## 6. Running Tests

AgentCart AI includes a comprehensive 17-point automated integration test suite verifying the database, pricing security, filter logic, AI extraction, and HTTP endpoints:

```bash
npm test
```

### Verified Test Cases:
- Catalog length & 10 required outerwear styles integrity
- Price, size, color, and local image path verification
- Search, filter, and price sort accuracy
- Server-side price recalculation & anti-tampering verification
- Free delivery rule threshold logic (₹2,000)
- AI constraint parsing (budget, size, color, occasion) and trade-off detection
- Order status transition (PENDING -> PAID) in SQLite
- Live HTTP endpoints (`/`, `/api/config`, `/api/products`, `/api/ai/recommend`, `/api/paypal/create-order`)
