require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../database/db');
const gemini = require('./gemini');
const paypal = require('./paypal');
const config = require('./config');
const { createRateLimiter, securityHeaders, requireAdminAuth } = require('./security');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Dedicated rate limiters
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});

const checkoutLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many checkout requests. Please wait a few moments.'
});

const refundLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many refund actions. Please wait a few moments.'
});

// Serve static assets and frontend files
const frontendPath = path.join(__dirname, '..', 'frontend');
const videoPath = path.join(__dirname, '..', 'video');

app.use(express.static(frontendPath));
app.use('/assets', express.static(path.join(frontendPath, 'assets')));
app.use('/data', express.static(path.join(__dirname, '..', 'database')));
app.use('/video', express.static(videoPath));

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

// GET /api/products — list and filter products (active products only for shoppers)
app.get('/api/products', (req, res) => {
  try {
    const products = db.getAllProducts(req.query, false);
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

// POST /api/ai/recommend — AI jacket stylist and recommender (backend logic preserved)
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

// ============================================================================
// PAYPAL CHECKOUT ENGINE
// ============================================================================

// POST /api/paypal/create-order — calculate server-side totals and create order
app.post('/api/paypal/create-order', checkoutLimiter, async (req, res) => {
  try {
    const { items, shipping_address } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'Cart items are required.' });
    }

    // Secure calculation and inventory verification on backend
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

// POST /api/paypal/capture-order — capture approved PayPal Sandbox order & deduct inventory
app.post('/api/paypal/capture-order', checkoutLimiter, async (req, res) => {
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

// ============================================================================
// PROFILE APIS (Persistent SQLite Profile: Akhil)
// ============================================================================

// GET /api/profile — fetch Akhil's profile & statistics
app.get('/api/profile', (req, res) => {
  try {
    const profile = db.getUserProfile('user_akhil');
    const stats = db.getUserStats('user_akhil');
    res.json({
      success: true,
      profile,
      stats
    });
  } catch (err) {
    console.error('Fetch profile error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
  }
});

// PUT /api/profile — update profile details
app.put('/api/profile', (req, res) => {
  try {
    const updated = db.updateUserProfile('user_akhil', req.body);
    const stats = db.getUserStats('user_akhil');
    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updated,
      stats
    });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// ORDERS & TRACKING APIS
// ============================================================================

// POST /api/orders/reset — reset orders, tracking, and payments to fresh zero state
app.post('/api/orders/reset', (req, res) => {
  try {
    const stats = db.resetOrderHistory('user_akhil');
    res.json({
      success: true,
      message: 'Order history, tracking events, and payment records reset to zero.',
      stats
    });
  } catch (err) {
    console.error('Reset orders error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to reset order history' });
  }
});

// GET /api/orders — list orders for profile
app.get('/api/orders', (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    const orders = db.getUserOrders('user_akhil', { status, search, limit, offset });
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    console.error('Fetch orders error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
  }
});

// GET /api/orders/:id/tracking — get tracking timeline and stage completion
app.get('/api/orders/:id/tracking', (req, res) => {
  try {
    const tracking = db.getOrderTracking(req.params.id);
    if (!tracking) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, tracking });
  } catch (err) {
    console.error('Fetch tracking error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve tracking details' });
  }
});

// POST /api/orders/:id/advance-stage — advance order stage (demonstration & lifecycle testing)
app.post('/api/orders/:id/advance-stage', (req, res) => {
  try {
    const { stage_number } = req.body;
    const stageNum = Number(stage_number);
    if (!stageNum || stageNum < 1 || stageNum > 6) {
      return res.status(400).json({ success: false, error: 'stage_number must be an integer between 1 and 6' });
    }

    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const stageMap = {
      1: { status: 'PENDING', code: 'ORDER_PLACED', name: 'Order Placed', title: 'Order Placed', desc: 'Order placed by customer.' },
      2: { status: 'PAID', code: 'PAYMENT_CONFIRMED', name: 'Payment Confirmed', title: 'Payment Confirmed', desc: 'Payment verified and captured via PayPal Sandbox.' },
      3: { status: 'PROCESSING', code: 'ORDER_PROCESSING', name: 'Order Processing', title: 'Order Processing', desc: 'Garments inspected and packed in technical box.' },
      4: { status: 'SHIPPED', code: 'SHIPPED', name: 'Shipped', title: 'Shipped', desc: 'Dispatched with express air courier.' },
      5: { status: 'OUT_FOR_DELIVERY', code: 'OUT_FOR_DELIVERY', name: 'Out for Delivery', title: 'Out for Delivery', desc: 'Courier agent en route for delivery.' },
      6: { status: 'DELIVERED', code: 'DELIVERED', name: 'Delivered', title: 'Delivered', desc: 'Package delivered and signed for.' }
    };

    const target = stageMap[stageNum];

    for (let s = 1; s <= stageNum; s++) {
      const st = stageMap[s];
      db.addTrackingEvent(order.id, {
        stage_number: s,
        stage_name: st.name,
        status_code: st.code,
        title: st.title,
        description: st.desc
      });
    }

    db.updateOrderStatus(order.id, target.status);
    const updatedTracking = db.getOrderTracking(order.id);

    res.json({
      success: true,
      message: `Order transitioned to Stage ${stageNum}: ${target.name}`,
      tracking: updatedTracking
    });
  } catch (err) {
    console.error('Advance stage error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// PAYMENT HISTORY APIS
// ============================================================================

// GET /api/payments — list all verified payment transactions
app.get('/api/payments', (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    const payments = db.getPayments({ status, search, limit, offset });
    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (err) {
    console.error('Fetch payments error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve payment history' });
  }
});

// GET /api/payments/:id — get payment details
app.get('/api/payments/:id', (req, res) => {
  try {
    const payment = db.getPaymentById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }
    res.json({ success: true, payment });
  } catch (err) {
    console.error('Fetch payment error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve payment details' });
  }
});

// ============================================================================
// 1. WISHLIST / SAVE FOR LATER APIS
// ============================================================================

// GET /api/wishlist — retrieve user's saved wishlist items
app.get('/api/wishlist', (req, res) => {
  try {
    const items = db.getUserWishlist('user_akhil');
    res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (err) {
    console.error('Fetch wishlist error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve wishlist items' });
  }
});

// POST /api/wishlist/toggle — toggle product in wishlist (add/remove)
app.post('/api/wishlist/toggle', (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res.status(400).json({ success: false, error: 'product_id is required' });
    }
    const result = db.toggleWishlist('user_akhil', product_id);
    const stats = db.getUserStats('user_akhil');
    res.json({
      success: true,
      ...result,
      stats
    });
  } catch (err) {
    console.error('Toggle wishlist error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/wishlist/:productId — remove product from wishlist
app.delete('/api/wishlist/:productId', (req, res) => {
  try {
    const result = db.removeFromWishlist('user_akhil', req.params.productId);
    const stats = db.getUserStats('user_akhil');
    res.json({
      success: true,
      ...result,
      stats
    });
  } catch (err) {
    console.error('Remove wishlist error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. IN-APP NOTIFICATIONS APIS
// ============================================================================

// GET /api/notifications — get user notifications with unread count
app.get('/api/notifications', (req, res) => {
  try {
    const result = db.getUserNotifications('user_akhil', 30);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Fetch notifications error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve notifications' });
  }
});

// POST /api/notifications/:id/read — mark notification as read
app.post('/api/notifications/:id/read', (req, res) => {
  try {
    const result = db.markNotificationRead(req.params.id, 'user_akhil');
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Mark notification read error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/read-all — mark all notifications as read
app.post('/api/notifications/read-all', (req, res) => {
  try {
    const result = db.markAllNotificationsRead('user_akhil');
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Mark all notifications read error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 3. CUSTOMER RETURNS APIS
// ============================================================================

// GET /api/returns — fetch returns for customer
app.get('/api/returns', (req, res) => {
  try {
    const returns = db.getUserReturns('user_akhil');
    res.json({
      success: true,
      count: returns.length,
      returns
    });
  } catch (err) {
    console.error('Fetch user returns error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve returns' });
  }
});

// GET /api/wallet/transactions — fetch authoritative store wallet ledger and balance
app.get('/api/wallet/transactions', (req, res) => {
  try {
    const userId = req.query.user_id || 'user_akhil';
    const balance = db.getWalletBalance(userId);
    const transactions = db.getWalletTransactions(userId);
    res.json({
      success: true,
      balance_inr: balance.balance_inr,
      balance_usd: balance.balance_usd,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    console.error('Fetch wallet transactions error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve wallet transactions' });
  }
});

// GET /api/returns/policy-estimate - get return policy tier, fee deduction, and refund estimate
app.get('/api/returns/policy-estimate', (req, res) => {
  try {
    const { order_id, days_elapsed } = req.query;
    if (!order_id) return res.status(400).json({ success: false, error: 'order_id is required' });

    const order = db.getOrderById(order_id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const breakdown = db.calculateReturnRefundBreakdown(
      order.created_at,
      order.total_amount,
      order.charged_amount,
      order.exchange_rate || 85.0,
      days_elapsed !== undefined && days_elapsed !== '' ? Number(days_elapsed) : null
    );

    res.json({ success: true, order_id: order.id, ...breakdown, breakdown });
  } catch (err) {
    console.error('Policy estimate error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/returns/request — request a return for an order item
app.post('/api/returns/request', (req, res) => {
  try {
    const { order_id, product_id, product_name, size, color, quantity, reason, description, days_elapsed } = req.body;
    if (!order_id || !reason) {
      return res.status(400).json({ success: false, error: 'order_id and return reason are required.' });
    }

    const returnRequest = db.createReturnRequest({
      order_id,
      user_id: 'user_akhil',
      product_id,
      product_name,
      size,
      color,
      quantity: quantity || 1,
      reason,
      description,
      days_elapsed: days_elapsed !== undefined ? Number(days_elapsed) : null
    });

    res.json({
      success: true,
      message: 'Return request submitted successfully. Our team will review it promptly.',
      return_request: returnRequest
    });
  } catch (err) {
    console.error('Create return request error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 4. ADMIN AUTHENTICATION APIS
// ============================================================================

// POST /api/admin/login — authenticate administrator (rate limited)
app.post('/api/admin/login', authLimiter, (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const admin = db.verifyAdminCredentials(username, password);
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials. Access denied.' });
    }

    const session = db.createAdminSession(admin.id);
    res.json({
      success: true,
      message: 'Admin authenticated successfully',
      token: session.token,
      expires_at: session.expiresAt,
      admin
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ success: false, error: 'Authentication failed.' });
  }
});

// POST /api/admin/logout — invalidate admin session
app.post('/api/admin/logout', (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    let token = null;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-admin-token']) {
      token = String(req.headers['x-admin-token']).trim();
    }

    if (token) {
      db.deleteAdminSession(token);
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Admin logout error:', err.message);
    res.status(500).json({ success: false, error: 'Logout failed.' });
  }
});

// GET /api/admin/check-auth — verify if current token is valid
app.get('/api/admin/check-auth', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  }

  const session = token ? db.validateAdminSession(token) : null;
  if (!session) {
    return res.json({ success: true, authenticated: false });
  }

  res.json({
    success: true,
    authenticated: true,
    admin: {
      id: session.admin_id,
      username: session.username,
      role: session.role
    }
  });
});

// ============================================================================
// 5. PROTECTED ADMIN MANAGEMENT APIS (Role-Protected via requireAdminAuth)
// ============================================================================

// GET /api/admin/stats — overview dashboard metrics & alerts
app.get('/api/admin/stats', requireAdminAuth, (req, res) => {
  try {
    const stats = db.adminGetDashboardStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve admin stats' });
  }
});

// GET /api/admin/products — retrieve all products including inactive & inventory
app.get('/api/admin/products', requireAdminAuth, (req, res) => {
  try {
    const products = db.adminGetAllProducts();
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    console.error('Admin products error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve products' });
  }
});

// POST /api/admin/products — create new jacket product
app.post('/api/admin/products', requireAdminAuth, (req, res) => {
  try {
    const product = db.adminCreateProduct(req.body);
    res.json({ success: true, message: 'Product created successfully', product });
  } catch (err) {
    console.error('Admin create product error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/products/:id — update existing product
app.put('/api/admin/products/:id', requireAdminAuth, (req, res) => {
  try {
    const product = db.adminUpdateProduct(req.params.id, req.body);
    res.json({ success: true, message: 'Product updated successfully', product });
  } catch (err) {
    console.error('Admin update product error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/admin/products/:id/toggle-active — activate or deactivate product
app.post('/api/admin/products/:id/toggle-active', requireAdminAuth, (req, res) => {
  try {
    const result = db.adminToggleProductActive(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Admin toggle product error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/admin/products/stock — update variant inventory quantity
app.post('/api/admin/products/stock', requireAdminAuth, (req, res) => {
  try {
    const { variant_id, stock } = req.body;
    if (!variant_id || stock === undefined) {
      return res.status(400).json({ success: false, error: 'variant_id and stock are required' });
    }
    const updated = db.adminUpdateVariantStock(variant_id, stock);
    res.json({ success: true, variant: updated });
  } catch (err) {
    console.error('Admin stock update error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/admin/orders — list all orders for administration
app.get('/api/admin/orders', requireAdminAuth, (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    // For admin, query orders across all users
    const dbInst = db.getDb();
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'ALL') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(id) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(provider_order_id) LIKE ?)';
      params.push(term, term, term, term);
    }
    query += ' ORDER BY created_at DESC';
    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }

    const orders = dbInst.prepare(query).all(...params);
    const getItemStmt = dbInst.prepare(`SELECT i.*, p.image FROM order_items i LEFT JOIN products p ON i.product_id = p.id WHERE i.order_id = ?`);
    const getPaymentStmt = dbInst.prepare('SELECT * FROM payments WHERE order_id = ?');

    const fullOrders = orders.map(ord => ({
      ...ord,
      items: getItemStmt.all(ord.id),
      payment: getPaymentStmt.get(ord.id) || null
    }));

    res.json({ success: true, count: fullOrders.length, orders: fullOrders });
  } catch (err) {
    console.error('Admin fetch orders error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
  }
});

// POST /api/admin/orders/:id/status — advance or update order status
app.post('/api/admin/orders/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status, stage_number } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const updated = db.updateOrderStatus(order.id, status);
    if (stage_number) {
      const stageNum = Number(stage_number);
      const stageMap = {
        1: { name: 'Order Placed', code: 'ORDER_PLACED', title: 'Order Placed', desc: 'Order confirmed in system.' },
        2: { name: 'Payment Confirmed', code: 'PAYMENT_CONFIRMED', title: 'Payment Confirmed', desc: 'Payment verified.' },
        3: { name: 'Order Processing', code: 'ORDER_PROCESSING', title: 'Order Processing', desc: 'Garments inspected and sealed.' },
        4: { name: 'Shipped', code: 'SHIPPED', title: 'Shipped', desc: 'Dispatched with express air courier.' },
        5: { name: 'Out for Delivery', code: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', desc: 'Courier en route for delivery.' },
        6: { name: 'Delivered', code: 'DELIVERED', title: 'Delivered', desc: 'Package delivered.' }
      };
      if (stageMap[stageNum]) {
        for (let s = 1; s <= stageNum; s++) {
          const st = stageMap[s];
          db.addTrackingEvent(order.id, {
            stage_number: s,
            stage_name: st.name,
            status_code: st.code,
            title: st.title,
            description: st.desc
          });
        }
      }
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Admin update order status error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/admin/returns — retrieve all customer returns
app.get('/api/admin/returns', requireAdminAuth, (req, res) => {
  try {
    const returns = db.getAllReturns();
    res.json({ success: true, count: returns.length, returns });
  } catch (err) {
    console.error('Admin returns error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve returns' });
  }
});

// POST /api/admin/returns/:id/approve — approve a return request
app.post('/api/admin/returns/:id/approve', requireAdminAuth, (req, res) => {
  try {
    const updated = db.updateReturnStatus(req.params.id, 'APPROVED', req.body.admin_notes || 'Approved for return shipping');
    res.json({ success: true, message: 'Return approved', return_request: updated });
  } catch (err) {
    console.error('Admin approve return error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/admin/returns/:id/reject — reject a return request
app.post('/api/admin/returns/:id/reject', requireAdminAuth, (req, res) => {
  try {
    const updated = db.updateReturnStatus(req.params.id, 'REJECTED', req.body.admin_notes || 'Return request declined');
    res.json({ success: true, message: 'Return rejected', return_request: updated });
  } catch (err) {
    console.error('Admin reject return error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/admin/returns/:id/receive — mark return received and automatically restock
app.post('/api/admin/returns/:id/receive', requireAdminAuth, (req, res) => {
  try {
    const updated = db.updateReturnStatus(req.params.id, 'RECEIVED', req.body.admin_notes || 'Package received and restocked');
    res.json({ success: true, message: 'Return marked as received and items restocked into inventory.', return_request: updated });
  } catch (err) {
    console.error('Admin receive return error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/admin/returns/:id/refund — execute PayPal Sandbox refund for a return
app.post('/api/admin/returns/:id/refund', requireAdminAuth, refundLimiter, async (req, res) => {
  try {
    const ret = db.getReturnById(req.params.id);
    if (!ret) {
      return res.status(404).json({ success: false, error: 'Return request not found' });
    }

    if (ret.status === 'REFUNDED') {
      return res.status(400).json({ success: false, error: 'Return has already been refunded.' });
    }

    const order = db.getOrderById(ret.order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Associated order not found' });
    }

    // Determine capture ID
    const captureId = order.payment_id || order.payment?.transaction_id;
    if (!captureId) {
      return res.status(400).json({ success: false, error: 'No capture or transaction ID found for this order to refund.' });
    }

    // Determine refund amount in USD and INR (taking into account tiered fee deduction if present)
    const refundUsd = req.body.amount
      ? Number(req.body.amount)
      : (ret.refund_amount_usd || order.charged_amount || Number((order.total_amount / 85).toFixed(2)));
    const refundInr = ret.refund_amount_inr || Number((refundUsd * (order.exchange_rate || 85)).toFixed(0));
    const currency = order.charged_currency || 'USD';
    const reason = req.body.reason || `Refund for return ${ret.id}: ${ret.reason}`;

    // Execute PayPal Sandbox refund via official PayPal API or sandbox fallback
    const paypalResult = await paypal.refundPayPalCapture(captureId, refundUsd, currency, reason);

    // Save refund record to SQLite
    const refundRecord = db.createRefundRecord({
      return_id: ret.id,
      order_id: order.id,
      user_id: ret.user_id,
      payment_id: order.payment?.id || null,
      paypal_refund_id: paypalResult.refund_id || null,
      capture_id: captureId,
      amount: refundUsd,
      currency,
      inr_amount: refundInr,
      reason,
      status: paypalResult.status === 'PENDING' ? 'PENDING' : 'COMPLETED'
    });

    res.json({
      success: true,
      message: `Refund of $${refundUsd.toFixed(2)} USD successfully processed via PayPal Sandbox.`,
      paypal_result: paypalResult,
      refund: refundRecord,
      return_request: db.getReturnById(ret.id)
    });
  } catch (err) {
    console.error('Admin refund error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Root route serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
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
      console.error(`❌ Port ${PORT} is already in use by another process. Please close it or set PORT in .env.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

module.exports = { app, server };
