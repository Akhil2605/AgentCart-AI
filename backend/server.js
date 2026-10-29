require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../database/db');
const gemini = require('./gemini');
const paypal = require('./paypal');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Serve static assets and frontend files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.use('/data', express.static(path.join(__dirname, '..', 'database')));

// Root route handler for digital showroom
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Public configuration status
app.get('/api/config', (req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  const { clientId, clientSecret } = paypal.getSanitizedCredentials();
  const hasPayPal = Boolean(
    clientId && 
    clientSecret && 
    clientId !== 'your_paypal_client_id_here' &&
    clientSecret !== 'your_paypal_client_secret_here'
  );

  res.json({
    ai_configured: hasGemini,
    paypal_configured: hasPayPal,
    paypal_client_id: hasPayPal ? clientId : null,
    paypal_currency: config.PAYPAL_CURRENCY,
    inr_to_usd_rate: config.INR_TO_USD_RATE,
    usd_exchange_rate: config.INR_TO_USD_RATE,
    free_shipping_threshold: config.FREE_SHIPPING_THRESHOLD,
    standard_shipping_fee: config.STANDARD_SHIPPING_FEE
  });
});

// GET /api/products — list and filter products
app.get('/api/products', (req, res) => {
  try {
    const products = db.getAllProducts(req.query);
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve products' });
  }
});

// GET /api/products/:id — get single product details
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve product details' });
  }
});

// POST /api/ai/recommend — AI jacket stylist and recommender
app.post('/api/ai/recommend', async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'A valid shopping prompt is required.' });
    }

    if (prompt.length > 500) {
      return res.status(400).json({ success: false, error: 'Prompt exceeds maximum length of 500 characters.' });
    }

    const result = await gemini.getRecommendations(prompt.trim(), history || []);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('AI Recommender Error:', err.message);
    res.status(500).json({ success: false, error: 'AI processing failed. Please try again.' });
  }
});

// POST /api/paypal/create-order — calculate server-side totals and create order
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { items, shipping_address } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'Cart items are required.' });
    }

    // Secure calculation on backend
    const verifiedOrder = paypal.validateAndCalculateOrder(items, shipping_address);
    const result = await paypal.createPayPalSandboxOrder(verifiedOrder);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Create Order Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/paypal/capture-order — capture approved PayPal Sandbox order
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { order_id, paypal_order_id } = req.body;

    if (!order_id && !paypal_order_id) {
      return res.status(400).json({ success: false, error: 'order_id or paypal_order_id is required.' });
    }

    const result = await paypal.capturePayPalSandboxOrder(order_id, paypal_order_id);
    res.json(result);
  } catch (err) {
    console.error('Capture Order Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/paypal/cancel-order — record buyer cancellation
app.post('/api/paypal/cancel-order', (req, res) => {
  try {
    const { order_id, paypal_order_id } = req.body;

    if (!order_id && !paypal_order_id) {
      return res.status(400).json({ success: false, error: 'order_id or paypal_order_id is required.' });
    }

    const result = paypal.cancelPayPalOrder(order_id, paypal_order_id);
    res.json(result);
  } catch (err) {
    console.error('Cancel Order Error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/paypal/demo-simulate — demo offline payment completion when credentials not set
app.post('/api/paypal/demo-simulate', (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, error: 'order_id is required.' });
    }

    const result = paypal.recordDemoSimulationOrder(order_id);
    res.json(result);
  } catch (err) {
    console.error('Demo simulate error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:id — get order receipt and verification
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, order });
  } catch (err) {
    console.error('Fetch order error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve order' });
  }
});

// Root route serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Process-level safety handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server if run directly
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`⚡ AgentCart AI Server running at http://localhost:${PORT}`);
    console.log(`📦 SQLite database ready with 24 technical jackets`);
    console.log(`🤖 AI Stylist initialized (${process.env.GEMINI_API_KEY ? 'Gemini 2.5 Active' : 'Heuristic Demo Fallback Active'})`);
    console.log(`💳 PayPal Checkout initialized (${process.env.PAYPAL_CLIENT_ID ? 'Sandbox Active' : 'Demo Guidance Mode Active'})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = { app, server };
