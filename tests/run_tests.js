/**
 * Comprehensive Automated Test Suite for AgentCart AI
 * Tests Database, Logic, Server Endpoints, AI Recommender, and PayPal Sandbox Checkout
 */
const assert = require('assert');
const http = require('http');
const db = require('../database/db');
const gemini = require('../backend/gemini');
const paypal = require('../backend/paypal');
const { app } = require('../backend/server');

const TEST_PORT = 3001;
const originalFetch = global.fetch;
let lastOrderPayload = null;

// Helper to install mock PayPal Sandbox API interceptor strictly for PayPal domains
function setupMockPayPalSandbox(options = {}) {
  global.fetch = async (url, init = {}) => {
    const urlStr = String(url);

    // Only intercept PayPal Sandbox API requests
    if (!urlStr.includes('api-m.sandbox.paypal.com')) {
      return originalFetch(url, init);
    }

    // 1. PayPal OAuth2 Token endpoint
    if (urlStr.includes('/v1/oauth2/token')) {
      if (options.failAuth) {
        return new Response(JSON.stringify({
          error: 'invalid_client',
          error_description: 'Client Authentication failed'
        }), { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-AUTH-401' } 
        });
      }
      return new Response(JSON.stringify({
        access_token: 'MOCK_SANDBOX_ACCESS_TOKEN_ABC123',
        token_type: 'Bearer',
        app_id: 'APP-80W284485P519543T',
        expires_in: 32400
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-AUTH-200' } 
      });
    }

    // 2. PayPal Orders API (Creation)
    if (urlStr.includes('/v2/checkout/orders') && !urlStr.includes('/capture')) {
      if (options.failCreate) {
        return new Response(JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message: 'The requested action failed business validation.',
          details: [{ issue: 'CURRENCY_NOT_ALLOWED', description: 'Currency not allowed.' }]
        }), { 
          status: 422, 
          headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-FAIL-CREATE-999' } 
        });
      }
      const payload = init.body ? JSON.parse(init.body) : {};
      lastOrderPayload = payload;
      const mockOrderId = '5C' + Math.floor(10000000000 + Math.random() * 90000000000);
      return new Response(JSON.stringify({
        id: mockOrderId,
        status: 'CREATED',
        intent: payload.intent || 'CAPTURE',
        purchase_units: payload.purchase_units || []
      }), { 
        status: 201, 
        headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-ORD-' + Date.now() } 
      });
    }

    // 3. PayPal Orders API (Capture)
    if (urlStr.includes('/capture')) {
      if (options.failCapture) {
        return new Response(JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message: 'The requested action could not be performed, payment instrument declined.',
          details: [{ issue: 'INSTRUMENT_DECLINED', description: 'The card was declined.' }]
        }), { 
          status: 422, 
          headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-FAIL-CAP-888' } 
        });
      }
      const captureId = '2GG' + Math.floor(10000000000 + Math.random() * 90000000000);
      return new Response(JSON.stringify({
        id: 'CAP-' + Date.now(),
        status: 'COMPLETED',
        purchase_units: [{
          payments: {
            captures: [{
              id: captureId,
              status: 'COMPLETED',
              amount: { currency_code: 'USD', value: '47.03' }
            }]
          }
        }]
      }), { 
        status: 201, 
        headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-CAP-' + Date.now() } 
      });
    }

    return originalFetch(url, init);
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
}

async function runAllTests() {
  console.log('🧪 Starting AgentCart AI Test Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
    }
  }

  // --- 1. Database & Catalog Tests ---
  console.log('📦 Testing SQLite Database & Catalog Integrity:');
  
  test('Catalog contains at least 20 distinct products (actual: 24)', () => {
    const products = db.getAllProducts();
    assert.ok(products.length >= 20, `Expected at least 20 products, got ${products.length}`);
    assert.strictEqual(products.length, 24);
  });

  test('All 10 required jacket styles are present in catalog', () => {
    const products = db.getAllProducts();
    const categories = new Set(products.map(p => p.category));
    const required = [
      'Technical Windbreakers',
      'Bomber Jackets',
      'Denim Jackets',
      'Puffer Jackets',
      'Hooded Jackets',
      'Lightweight Rain Jackets',
      'Casual Everyday Jackets',
      'Sports and Outdoor Jackets',
      'Minimalist Urban Jackets',
      'Insulated Winter Jackets'
    ];
    for (const req of required) {
      assert.ok(categories.has(req), `Missing required category: ${req}`);
    }
  });

  test('Every product has valid price in INR, image, and sizes', () => {
    const products = db.getAllProducts();
    for (const p of products) {
      assert.ok(p.price > 0, `Product ${p.id} has invalid price: ${p.price}`);
      assert.ok(p.image && p.image.startsWith('assets/images/jackets/'), `Product ${p.id} has invalid image path`);
      assert.ok(Array.isArray(p.sizes) && p.sizes.length > 0, `Product ${p.id} missing sizes`);
      assert.ok(Array.isArray(p.colors) && p.colors.length > 0, `Product ${p.id} missing colors`);
    }
  });

  // --- 2. Search, Filter, Sort Tests ---
  console.log('\n🔍 Testing Search, Filter, and Sort Engine:');

  test('Category filter correctly isolates products', () => {
    const windbreakers = db.getAllProducts({ category: 'Technical Windbreakers' });
    assert.ok(windbreakers.length > 0);
    assert.ok(windbreakers.every(p => p.category === 'Technical Windbreakers'));
  });

  test('Search matches product name, material, features, and description', () => {
    const matches = db.getAllProducts({ search: 'GORE-TEX' });
    assert.ok(matches.length > 0);
    assert.ok(matches.some(p => p.id === 'hyperion-mountain-shell'));
  });

  test('Price sorting works in ascending and descending order', () => {
    const asc = db.getAllProducts({ sort: 'price-asc' });
    for (let i = 0; i < asc.length - 1; i++) {
      assert.ok(asc[i].price <= asc[i + 1].price, `Price ascending sort failed at index ${i}`);
    }

    const desc = db.getAllProducts({ sort: 'price-desc' });
    for (let i = 0; i < desc.length - 1; i++) {
      assert.ok(desc[i].price >= desc[i + 1].price, `Price descending sort failed at index ${i}`);
    }
  });

  // --- 3. Cart & Server-Side Security Pricing Tests ---
  console.log('\n🔒 Testing Server-Side Pricing & Security Validation:');

  test('Server recalculates price strictly from DB and ignores client tampering', () => {
    const clientItems = [
      { id: 'cyber-shell-black', size: 'M', color: 'Onyx', quantity: 1, price: 10 } // Malicious client attempt: price = 10
    ];
    const shipping = {
      name: 'Test Buyer',
      email: 'buyer@test.com',
      address: '123 Tech Park',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560001'
    };

    const calculated = paypal.validateAndCalculateOrder(clientItems, shipping);
    assert.strictEqual(calculated.subtotal, 1999, 'Server must calculate real subtotal of 1999');
    assert.strictEqual(calculated.delivery_fee, 150, 'Delivery fee must be 150 because subtotal < 2000');
    assert.strictEqual(calculated.total_amount, 2149, 'Total must equal subtotal + delivery fee');
  });

  test('Free delivery applies automatically when subtotal >= ₹2,000', () => {
    const clientItems = [
      { id: 'cyber-shell-black', quantity: 1 }, // 1999
      { id: 'veloce-commuter-softshell', quantity: 1 } // 1499
    ]; // Total 3498
    const shipping = {
      name: 'VIP Shopper',
      email: 'vip@test.com',
      address: '77 Cyber Boulevard',
      city: 'Mumbai',
      state: 'Maharashtra',
      postal_code: '400001'
    };

    const calculated = paypal.validateAndCalculateOrder(clientItems, shipping);
    assert.strictEqual(calculated.subtotal, 3498);
    assert.strictEqual(calculated.delivery_fee, 0, 'Delivery fee must be 0 for subtotal >= 2000');
    assert.strictEqual(calculated.total_amount, 3498);
  });

  test('Invalid product ID is rejected with descriptive error', () => {
    assert.throws(() => {
      paypal.validateAndCalculateOrder(
        [{ id: 'non-existent-jacket-xyz', quantity: 1 }],
        { name: 'X', email: 'x@x.com', address: 'X' }
      );
    }, /Product not found in catalog/);
  });

  test('Missing shipping address is rejected with descriptive error', () => {
    assert.throws(() => {
      paypal.validateAndCalculateOrder(
        [{ id: 'cyber-shell-black', quantity: 1 }],
        { name: '', email: '', address: '' }
      );
    }, /Valid shipping details/);
  });

  test('Invalid item quantities (negative, fractional, or non-numeric) are rejected', () => {
    const shipping = { name: 'Q Buyer', email: 'q@test.com', address: '1 Street' };
    
    assert.throws(() => {
      paypal.validateAndCalculateOrder([{ id: 'cyber-shell-black', quantity: 0 }], shipping);
    }, /Invalid item or quantity/);

    assert.throws(() => {
      paypal.validateAndCalculateOrder([{ id: 'cyber-shell-black', quantity: -3 }], shipping);
    }, /Invalid item or quantity/);

    assert.throws(() => {
      paypal.validateAndCalculateOrder([{ id: 'cyber-shell-black', quantity: 1.5 }], shipping);
    }, /Invalid item or quantity/);

    assert.throws(() => {
      paypal.validateAndCalculateOrder([{ id: 'cyber-shell-black', quantity: 'five' }], shipping);
    }, /Invalid item or quantity/);
  });

  // --- 4. AI Jacket Recommender Tests ---
  console.log('\n🤖 Testing AI Jacket Stylist & Grounded Recommendations:');

  await testAsync('AI Assistant extracts budget, color, size, occasion and returns grounded matches', async () => {
    const prompt = 'Find me a black waterproof-style jacket under ₹2,000 in size M for everyday use';
    const result = await gemini.getRecommendations(prompt);
    
    assert.ok(result.recommendations.length > 0, 'Must return recommendations');
    assert.strictEqual(result.extracted_preferences.budget_max, 2000);
    assert.strictEqual(result.extracted_preferences.size, 'M');
    
    const topRec = result.recommendations[0];
    assert.ok(topRec.price <= 2000, `Top recommended jacket should fit budget: ${topRec.price}`);
    assert.ok(topRec.match_reason && topRec.match_reason.length > 10, 'Must provide detailed match reason');
  });

  await testAsync('AI Assistant handles comparison and identifies trade-offs', async () => {
    const prompt = 'Compare CyberShell Stormbreaker and Alpine Shift for winter hiking';
    const result = await gemini.getRecommendations(prompt);
    assert.ok(result.recommendations.length >= 2, 'Should provide at least two items for comparison');
  });

  // --- 5. PayPal Sandbox Orders, Capture, Cancellation & Security ---
  console.log('\n💳 Testing PayPal Sandbox Checkout Engine:');

  await testAsync('PayPal order creation and database linkage with provider_order_id', async () => {
    setupMockPayPalSandbox();
    try {
      const shipping = {
        name: 'Sandbox Buyer',
        email: 'sandbox-buyer@agentcart.ai',
        address: '500 Tech Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001'
      };
      const order = paypal.validateAndCalculateOrder([{ id: 'hyperion-mountain-shell', quantity: 1 }], shipping);
      const res = await paypal.createPayPalSandboxOrder(order);

      assert.strictEqual(res.success, true);
      assert.ok(res.paypal_order_id.startsWith('5C'));
      assert.strictEqual(res.order_id, order.id);

      // Verify database updated with provider_order_id
      const fromDb = db.getOrderById(order.id);
      assert.strictEqual(fromDb.provider_order_id, res.paypal_order_id);
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Order creation payload includes experience_context, user_action PAY_NOW, and valid return/cancel URLs', async () => {
    setupMockPayPalSandbox();
    try {
      const shipping = {
        name: 'Context Test Buyer',
        email: 'context@agentcart.ai',
        address: '600 Tech Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001'
      };
      const order = paypal.validateAndCalculateOrder([{ id: 'cobalt-storm-shield', quantity: 1 }], shipping);
      await paypal.createPayPalSandboxOrder(order);

      assert.ok(lastOrderPayload, 'Payload must be intercepted');
      assert.ok(lastOrderPayload.payment_source?.paypal?.experience_context, 'Must include experience_context');
      const exp = lastOrderPayload.payment_source.paypal.experience_context;
      assert.strictEqual(exp.brand_name, 'AgentCart AI');
      assert.strictEqual(exp.user_action, 'PAY_NOW');
      assert.strictEqual(exp.shipping_preference, 'GET_FROM_FILE');
      assert.ok(exp.return_url.includes('http'), 'Return URL must be valid HTTP');
      assert.ok(exp.cancel_url.includes('http'), 'Cancel URL must be valid HTTP');
    } finally {
      restoreFetch();
    }
  });

  await testAsync('PayPal order creation failure throws descriptive error with debug ID', async () => {
    setupMockPayPalSandbox({ failCreate: true });
    try {
      const shipping = {
        name: 'Fail Order Buyer',
        email: 'failorder@agentcart.ai',
        address: '700 Tech Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001'
      };
      const order = paypal.validateAndCalculateOrder([{ id: 'aerogrid-windrunner', quantity: 1 }], shipping);

      await assert.rejects(async () => {
        await paypal.createPayPalSandboxOrder(order);
      }, err => {
        assert.ok(err.message.includes('PayPal Order Creation Failed'));
        assert.ok(err.message.includes('DBG-FAIL-CREATE-999'));
        return true;
      });
    } finally {
      restoreFetch();
    }
  });

  await testAsync('PayPal order capture verifies status, sets PAID, and records payment_id in DB', async () => {
    setupMockPayPalSandbox();
    try {
      const shipping = {
        name: 'Capture Test Buyer',
        email: 'buyer-capture@agentcart.ai',
        address: '101 Cyber Way',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001'
      };
      const order = paypal.validateAndCalculateOrder([{ id: 'apex-blaze-orange', quantity: 1 }], shipping);
      const created = await paypal.createPayPalSandboxOrder(order);

      const captured = await paypal.capturePayPalSandboxOrder(order.id, created.paypal_order_id);
      assert.strictEqual(captured.success, true);
      assert.strictEqual(captured.status, 'PAID');
      assert.ok(captured.paypal_capture_id.startsWith('2GG'));

      // Check SQLite DB reflects PAID status and payment_id
      const dbOrder = db.getOrderById(order.id);
      assert.strictEqual(dbOrder.status, 'PAID');
      assert.strictEqual(dbOrder.payment_id, captured.paypal_capture_id);
      assert.strictEqual(dbOrder.currency, 'INR');
      assert.strictEqual(dbOrder.charged_currency, 'USD');
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Duplicate capture on already PAID order is safely prevented', async () => {
    setupMockPayPalSandbox();
    try {
      const shipping = {
        name: 'Duplicate Test Buyer',
        email: 'buyer-dup@agentcart.ai',
        address: '102 Cyber Way',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001'
      };
      const order = paypal.validateAndCalculateOrder([{ id: 'aerogrid-windrunner', quantity: 1 }], shipping);
      const created = await paypal.createPayPalSandboxOrder(order);
      await paypal.capturePayPalSandboxOrder(order.id, created.paypal_order_id);

      // Attempt second capture on same order
      await assert.rejects(async () => {
        await paypal.capturePayPalSandboxOrder(order.id, created.paypal_order_id);
      }, /Duplicate capture prevented/);
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Failed PayPal capture marks order as FAILED in SQLite with debug ID', async () => {
    setupMockPayPalSandbox({ failCapture: true });
    try {
      const shipping = {
        name: 'Declined Buyer',
        email: 'buyer-declined@agentcart.ai',
        address: '103 Cyber Way',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001'
      };
      const order = paypal.validateAndCalculateOrder([{ id: 'veloce-commuter-softshell', quantity: 1 }], shipping);
      const created = await paypal.createPayPalSandboxOrder(order);

      await assert.rejects(async () => {
        await paypal.capturePayPalSandboxOrder(order.id, created.paypal_order_id);
      }, err => {
        assert.ok(err.message.includes('PayPal Capture Failed'));
        assert.ok(err.message.includes('DBG-FAIL-CAP-888'));
        return true;
      });

      const dbOrder = db.getOrderById(order.id);
      assert.strictEqual(dbOrder.status, 'FAILED');
    } finally {
      restoreFetch();
    }
  });

  test('Order cancellation transitions status to CANCELLED', () => {
    const shipping = {
      name: 'Cancel Test Buyer',
      email: 'buyer-cancel@agentcart.ai',
      address: '104 Cyber Way',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560001'
    };
    const order = paypal.validateAndCalculateOrder([{ id: 'arctic-expedition-down', quantity: 1 }], shipping);
    assert.strictEqual(order.status, 'PENDING');

    const cancelled = paypal.cancelPayPalOrder(order.id);
    assert.strictEqual(cancelled.status, 'CANCELLED');
    assert.strictEqual(cancelled.order.status, 'CANCELLED');

    const dbOrder = db.getOrderById(order.id);
    assert.strictEqual(dbOrder.status, 'CANCELLED');
  });

  test('Cannot cancel an already PAID order', () => {
    const shipping = {
      name: 'Paid Cancel Buyer',
      email: 'buyer-paidcancel@agentcart.ai',
      address: '105 Cyber Way',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560001'
    };
    const order = paypal.validateAndCalculateOrder([{ id: 'stealth-bomber-ma1', quantity: 1 }], shipping);
    db.updateOrderStatus(order.id, 'PAID', 'TEST-PAID-TXN');

    assert.throws(() => {
      paypal.cancelPayPalOrder(order.id);
    }, /payment has already been captured/);
  });

  await testAsync('PayPal authentication failure returns clear, helpful error without exposing secrets', async () => {
    setupMockPayPalSandbox({ failAuth: true });
    try {
      await assert.rejects(async () => {
        await paypal.getPayPalAccessToken();
      }, err => {
        assert.ok(err.message.includes('PayPal Sandbox Authentication Failed (invalid_client'));
        assert.ok(err.message.includes('developer.paypal.com/dashboard/applications/sandbox'));
        assert.ok(!err.message.includes(process.env.PAYPAL_CLIENT_SECRET || 'SECRET_SHOULD_NOT_LEAK'));
        return true;
      });
    } finally {
      restoreFetch();
    }
  });

  // --- 6. Live HTTP Endpoint Tests ---
  console.log('\n🌐 Testing Live Express HTTP Endpoints:');

  const testServer = await new Promise(resolve => {
    const s = app.listen(TEST_PORT, () => resolve(s));
  });

  async function httpReq(path, method = 'GET', body = null) {
    const res = await originalFetch(`http://localhost:${TEST_PORT}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, json, text };
  }

  await testAsync('GET / returns HTML homepage', async () => {
    const res = await httpReq('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('AgentCart AI'));
    assert.ok(res.text.includes('Find Your Style. Shop Smarter.'));
    assert.ok(res.text.includes('id="heroVideo"'), 'Homepage must contain #heroVideo element');
    assert.ok(res.text.includes('id="heroCanvas"'), 'Homepage must contain #heroCanvas fallback element');
    assert.ok(res.text.includes('id="heroPosterImg"'), 'Homepage must contain #heroPosterImg instant fallback element');
    assert.ok(!res.text.includes('<video id="heroVideo" controls'), 'Hero video MUST NOT have native controls');
  });

  await testAsync('GET /video/manifest.json returns valid scrubbing metadata and 30 frames', async () => {
    const res = await httpReq('/video/manifest.json');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.fps, 30);
    assert.strictEqual(res.json.extracted_frame_count, 30);
    assert.strictEqual(res.json.frames.length, 30);
    assert.strictEqual(res.json.video_url, '/video/hero.mp4');
    assert.ok(res.json.duration > 14);
  });

  await testAsync('GET /video/hero.mp4 serves video with HTTP range support', async () => {
    const rangeRes = await originalFetch(`http://localhost:${TEST_PORT}/video/hero.mp4`, {
      headers: { 'Range': 'bytes=0-1024' }
    });
    assert.strictEqual(rangeRes.status, 206, 'Should return HTTP 206 Partial Content for range request');
    const rangeHeader = rangeRes.headers.get('content-range');
    assert.ok(rangeHeader && rangeHeader.startsWith('bytes 0-1024/'));
  });

  await testAsync('GET /api/config returns config, verified currency, and NEVER leaks PAYPAL_CLIENT_SECRET', async () => {
    const res = await httpReq('/api/config');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.free_shipping_threshold, 2000);
    assert.strictEqual(res.json.standard_shipping_fee, 150);
    assert.strictEqual(res.json.paypal_currency, 'USD');
    assert.strictEqual(res.json.inr_to_usd_rate, 85);
    assert.strictEqual(res.json.client_secret, undefined);
    assert.strictEqual(res.json.paypal_client_secret, undefined);

    const serialized = JSON.stringify(res.json);
    assert.ok(!serialized.includes(process.env.PAYPAL_CLIENT_SECRET), 'Secret MUST NOT leak in /api/config');
  });

  await testAsync('GET /api/products returns 24 products', async () => {
    const res = await httpReq('/api/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.count, 24);
  });

  await testAsync('POST /api/ai/recommend responds to natural language prompt', async () => {
    const res = await httpReq('/api/ai/recommend', 'POST', {
      prompt: 'Find me a warm insulated puffer jacket for winter'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.success);
    assert.ok(res.json.recommendations.length > 0);
  });

  await testAsync('POST /api/paypal/create-order and /api/paypal/capture-order complete full order flow', async () => {
    setupMockPayPalSandbox();
    try {
      const createRes = await httpReq('/api/paypal/create-order', 'POST', {
        items: [{ id: 'cyber-shell-black', size: 'L', color: 'Onyx', quantity: 2 }],
        shipping_address: {
          name: 'Integration Test User',
          email: 'test@agentcart.ai',
          address: '100 Outer Ring Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postal_code: '560103'
        }
      });

      assert.strictEqual(createRes.status, 200);
      assert.ok(createRes.json.success);
      const localOrderId = createRes.json.order_id;
      const paypalOrderId = createRes.json.paypal_order_id;
      assert.strictEqual(createRes.json.order.subtotal, 1999 * 2);

      const captureRes = await httpReq('/api/paypal/capture-order', 'POST', {
        order_id: localOrderId,
        paypal_order_id: paypalOrderId
      });

      assert.strictEqual(captureRes.status, 200);
      assert.ok(captureRes.json.success);
      assert.strictEqual(captureRes.json.status, 'PAID');
      assert.ok(captureRes.json.paypal_capture_id);

      // Verify order receipt via GET /api/orders/:id
      const receiptRes = await httpReq(`/api/orders/${localOrderId}`);
      assert.strictEqual(receiptRes.status, 200);
      assert.strictEqual(receiptRes.json.order.status, 'PAID');
      assert.strictEqual(receiptRes.json.order.payment_id, captureRes.json.paypal_capture_id);
    } finally {
      restoreFetch();
    }
  });

  await testAsync('POST /api/paypal/cancel-order updates status to CANCELLED', async () => {
    setupMockPayPalSandbox();
    try {
      const createRes = await httpReq('/api/paypal/create-order', 'POST', {
        items: [{ id: 'cobalt-storm-shield', size: 'M', color: 'Blue', quantity: 1 }],
        shipping_address: {
          name: 'Cancel Endpoint User',
          email: 'cancel@agentcart.ai',
          address: '200 Outer Ring Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postal_code: '560103'
        }
      });

      assert.strictEqual(createRes.status, 200);
      const localOrderId = createRes.json.order_id;

      const cancelRes = await httpReq('/api/paypal/cancel-order', 'POST', {
        order_id: localOrderId
      });

      assert.strictEqual(cancelRes.status, 200);
      assert.strictEqual(cancelRes.json.status, 'CANCELLED');
    } finally {
      restoreFetch();
    }
  });

  await testAsync('POST /api/paypal/demo-simulate completes fallback offline order', async () => {
    const shipping = {
      name: 'Demo User',
      email: 'demo@agentcart.ai',
      address: '300 Outer Ring Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560103'
    };
    const order = paypal.validateAndCalculateOrder([{ id: 'obsidian-tactical-bomber', quantity: 1 }], shipping);

    const simRes = await httpReq('/api/paypal/demo-simulate', 'POST', { order_id: order.id });
    assert.strictEqual(simRes.status, 200);
    assert.ok(simRes.json.success);
    assert.strictEqual(simRes.json.order.status, 'PAID_DEMO_TEST');
  });

  await new Promise(resolve => {
    testServer.closeIdleConnections();
    testServer.close(resolve);
  });
  await new Promise(resolve => setTimeout(resolve, 80));
  try {
    db.getDb().close();
  } catch (e) {}

  console.log(`\n========================================`);
  console.log(`🏁 Test Results: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
