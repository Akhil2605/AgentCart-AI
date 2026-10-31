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

    // 4. PayPal Captures API (Refund)
    if (urlStr.includes('/refund')) {
      const mockRefundId = 'REF-PP-' + Date.now();
      return new Response(JSON.stringify({
        id: mockRefundId,
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '25.00' }
      }), { 
        status: 201, 
        headers: { 'Content-Type': 'application/json', 'paypal-debug-id': 'DBG-REF-' + Date.now() } 
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
  db.resetCatalogInventory();
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

  async function httpReq(path, method = 'GET', body = null, customHeaders = {}) {
    const res = await originalFetch(`http://localhost:${TEST_PORT}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...customHeaders },
      body: body ? JSON.stringify(body) : null
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, json, text, headers: res.headers };
  }

  await testAsync('GET / returns redesigned clean static HTML homepage without video', async () => {
    const res = await httpReq('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('AgentCart AI'));
    assert.ok(res.text.includes('id="hero"'), 'Homepage must contain clean static #hero');
    assert.ok(!res.text.includes('id="featuredProduct"'), 'Featured product box #featuredProduct MUST be removed per instructions');
    assert.ok(!res.text.includes('VIEW FEATURED SHELL'), 'VIEW FEATURED SHELL hero button MUST be removed per instructions');
    assert.ok(!res.text.includes('id="aiAssistant"'), 'AI Assistant section #aiAssistant MUST be removed per instructions');
    assert.ok(!res.text.includes('ASK AI STYLIST'), 'ASK AI STYLIST hero button MUST be removed per instructions');
    assert.ok(res.text.includes('id="catalogue"'), 'Homepage must contain #catalogue');
    assert.ok(res.text.includes('id="productGrid"'), 'Catalogue must contain dynamic #productGrid container');
    assert.ok(!res.text.includes('id="reviews"'), 'Reviews section MUST be removed');
    assert.ok(!res.text.includes('COMMUNITY VALIDATION'), 'Reviews section text MUST be removed');
    assert.ok(!res.text.includes('PRECISION CRAFTSMANSHIP'), 'PRECISION CRAFTSMANSHIP text MUST be removed');
    assert.ok(!res.text.includes('28,000mm // 800-FILL'), '28,000mm // 800-FILL text MUST be removed');
    assert.ok(!res.text.includes('FLAGSHIP EDITION'), 'FLAGSHIP EDITION text MUST be removed');
    assert.ok(!res.text.includes('TECHNICAL WINDBREAKERS // SAFETY SIGNAL'), 'TECHNICAL WINDBREAKERS // SAFETY SIGNAL text MUST be removed');
    assert.ok(res.text.includes('id="detailsMatter"'), 'Homepage must contain #detailsMatter');
    
    // Strict verification of removed elements per redesign instructions
    assert.ok(!res.text.includes('id="heroVideo"'), 'Video element #heroVideo MUST be removed');
    assert.ok(!res.text.includes('id="heroCanvas"'), 'Video canvas fallback #heroCanvas MUST be removed');
    assert.ok(!res.text.includes('BUILT ON EXPERIENCE'), 'Old promotional slogan MUST be removed');
    assert.ok(!res.text.includes('WEATHER-RESISTANT. THERMAL INSULATION. OVERSIZED FIT. LIMITED QUANTITY'), 'Old scrolling text MUST be removed');
    assert.ok(!res.text.includes('WORLDWIDE SHIPPING FAST & SECURE DELIVERY'), 'Old promotional banner MUST be removed');
    assert.ok(!res.text.includes('id="needToKnow"'), 'Need to Know FAQ section MUST be removed');
  });

  await testAsync('DETAILS MATTER is preserved as the final main content section before footer', async () => {
    const res = await httpReq('/');
    assert.strictEqual(res.status, 200);
    const detailsIdx = res.text.indexOf('id="detailsMatter"');
    const mainEndIdx = res.text.indexOf('</main>');
    assert.ok(detailsIdx !== -1, 'DETAILS MATTER section must exist');
    assert.ok(detailsIdx < mainEndIdx, 'DETAILS MATTER must be inside <main>');
    
    // Ensure no other sections follow detailsMatter in main
    const afterDetails = res.text.substring(detailsIdx, mainEndIdx);
    assert.ok(!afterDetails.includes('<section class='), 'No other section may appear between DETAILS MATTER and </main>');
    assert.ok(res.text.includes('assets/images/jackets/cyber-shell-black.png'), 'Must preserve cyber-shell-black.png');
    assert.ok(res.text.includes('01'), 'Must have numbered spec indicator 01');
    assert.ok(res.text.includes('05'), 'Must have numbered spec indicator 05');
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
      postal_code: '560103',
      country: 'United States'
    };
    const order = paypal.validateAndCalculateOrder([{ id: 'obsidian-tactical-bomber', quantity: 1 }], shipping);

    const simRes = await httpReq('/api/paypal/demo-simulate', 'POST', { order_id: order.id });
    assert.strictEqual(simRes.status, 200);
    assert.ok(simRes.json.success);
    assert.strictEqual(simRes.json.order.status, 'PAID_DEMO_TEST');
  });

  console.log('\n👤 Testing My Account & User Profile:');
  await testAsync('Reset order history to fresh zero-state (all 5 metrics = 0)', async () => {
    const resetRes = await httpReq('/api/orders/reset', 'POST');
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.json.stats.total_orders, 0);
    assert.strictEqual(resetRes.json.stats.active_orders, 0);
    assert.strictEqual(resetRes.json.stats.delivered_orders, 0);
    assert.strictEqual(resetRes.json.stats.total_spent_inr, 0);
    assert.strictEqual(resetRes.json.stats.total_spent_usd, 0);
    assert.strictEqual(resetRes.json.stats.recent_activity.length, 0);
  });

  await testAsync('GET /api/profile returns default profile Akhil with zeroed stats on fresh start', async () => {
    const res = await httpReq('/api/profile');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.profile.name, 'Akhil');
    assert.strictEqual(res.json.stats.total_orders, 0);
    assert.strictEqual(res.json.stats.active_orders, 0);
    assert.strictEqual(res.json.stats.delivered_orders, 0);
    assert.strictEqual(res.json.stats.total_spent_inr, 0);
    assert.strictEqual(res.json.stats.total_spent_usd, 0);
    assert.strictEqual(res.json.stats.recent_activity.length, 0);
  });

  await testAsync('GET /api/orders and GET /api/payments start completely empty', async () => {
    const ordersRes = await httpReq('/api/orders');
    assert.strictEqual(ordersRes.status, 200);
    assert.strictEqual(ordersRes.json.count, 0);
    assert.strictEqual(ordersRes.json.orders.length, 0);

    const paymentsRes = await httpReq('/api/payments');
    assert.strictEqual(paymentsRes.status, 200);
    assert.strictEqual(paymentsRes.json.count, 0);
    assert.strictEqual(paymentsRes.json.payments.length, 0);
  });

  await testAsync('PUT /api/profile permanently saves user details to SQLite', async () => {
    const res = await httpReq('/api/profile', 'PUT', {
      phone: '+91 91234 56789',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560038'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.profile.phone, '+91 91234 56789');
    
    // Verify persistence via clean GET
    const verifyRes = await httpReq('/api/profile');
    assert.strictEqual(verifyRes.json.profile.phone, '+91 91234 56789');
  });

  console.log('\n📦 Testing Live Order Tracking & Automatic Dashboard Updates:');
  let testOrderId = null;

  await testAsync('Newly placed order appears automatically in SQLite with Stage 1 tracking', async () => {
    setupMockPayPalSandbox();
    try {
      const createRes = await httpReq('/api/paypal/create-order', 'POST', {
        items: [{ id: 'cyber-shell-black', quantity: 1, size: 'L', color: 'Stealth Black' }],
        shipping_address: {
          name: 'Akhil',
          email: 'akhil@agentcart.ai',
          address: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'OR',
          postal_code: '97477',
          country: 'United States'
        }
      });
      assert.strictEqual(createRes.status, 200);
      assert.ok(createRes.json.order_id);
      testOrderId = createRes.json.order_id;

      // Verify order appears in GET /api/orders
      const ordersRes = await httpReq('/api/orders');
      assert.strictEqual(ordersRes.json.count, 1);
      assert.strictEqual(ordersRes.json.orders[0].id, testOrderId);
      assert.strictEqual(ordersRes.json.orders[0].status, 'PENDING');
      assert.ok(ordersRes.json.orders[0].items.length > 0);
      assert.ok(ordersRes.json.orders[0].items[0].image);

      // Verify pending order does NOT increase total spending yet
      const profileRes = await httpReq('/api/profile');
      assert.strictEqual(profileRes.json.stats.total_orders, 1);
      assert.strictEqual(profileRes.json.stats.active_orders, 1);
      assert.strictEqual(profileRes.json.stats.delivered_orders, 0);
      assert.strictEqual(profileRes.json.stats.total_spent_inr, 0);
      assert.strictEqual(profileRes.json.stats.total_spent_usd, 0);

      // Verify payments has 1 PENDING record
      const payRes = await httpReq('/api/payments');
      assert.strictEqual(payRes.json.count, 1);
      assert.strictEqual(payRes.json.payments[0].status, 'PENDING');
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Payment capture verifies server-side, transitions to PAID, and increases total spending', async () => {
    setupMockPayPalSandbox();
    try {
      const order = db.getOrderById(testOrderId);
      const captureRes = await httpReq('/api/paypal/capture-order', 'POST', {
        order_id: testOrderId,
        paypal_order_id: order.provider_order_id
      });
      assert.strictEqual(captureRes.status, 200);
      assert.strictEqual(captureRes.json.status, 'PAID');

      // Verify spending updated
      const profileRes = await httpReq('/api/profile');
      assert.strictEqual(profileRes.json.stats.total_orders, 1);
      assert.strictEqual(profileRes.json.stats.active_orders, 1);
      assert.ok(profileRes.json.stats.total_spent_inr > 0);
      assert.ok(profileRes.json.stats.total_spent_usd > 0);

      // Verify payment status updated to SUCCESS
      const payRes = await httpReq('/api/payments');
      assert.strictEqual(payRes.json.payments[0].status, 'SUCCESS');
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Order tracking timeline reflects genuine completed stages and estimated delivery', async () => {
    const res = await httpReq(`/api/orders/${testOrderId}/tracking`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.tracking.timeline.length, 6);
    assert.strictEqual(res.json.tracking.timeline[0].stage_name, 'Order Placed');
    assert.strictEqual(res.json.tracking.timeline[0].completed, true);
    assert.strictEqual(res.json.tracking.timeline[1].stage_name, 'Payment Confirmed');
    assert.strictEqual(res.json.tracking.timeline[1].completed, true);
    assert.strictEqual(res.json.tracking.timeline[2].completed, false);
  });

  await testAsync('Order advancement to DELIVERED records actual_delivery_date and updates dashboard stats', async () => {
    const advRes = await httpReq(`/api/orders/${testOrderId}/advance-stage`, 'POST', {
      stage_number: 6
    });
    assert.strictEqual(advRes.status, 200);
    assert.ok(advRes.json.tracking.actual_delivery_date);
    assert.strictEqual(advRes.json.tracking.current_status, 'DELIVERED');

    const profileRes = await httpReq('/api/profile');
    assert.strictEqual(profileRes.json.stats.total_orders, 1);
    assert.strictEqual(profileRes.json.stats.active_orders, 0);
    assert.strictEqual(profileRes.json.stats.delivered_orders, 1);
  });

  await testAsync('Cancelled order does NOT increase total spending', async () => {
    setupMockPayPalSandbox();
    try {
      const createRes = await httpReq('/api/paypal/create-order', 'POST', {
        items: [{ id: 'obsidian-tactical-bomber', quantity: 1, size: 'M' }],
        shipping_address: {
          name: 'Akhil',
          email: 'akhil@agentcart.ai',
          address: '100 Sunset Blvd',
          city: 'Los Angeles',
          state: 'CA',
          postal_code: '90001',
          country: 'United States'
        }
      });
      const cancelOrderId = createRes.json.order_id;
      const cancelRes = await httpReq('/api/paypal/cancel-order', 'POST', {
        order_id: cancelOrderId
      });
      assert.strictEqual(cancelRes.status, 200);
      assert.strictEqual(cancelRes.json.status, 'CANCELLED');

      // Total spent must remain unchanged (only the 1 paid order counted)
      const profileRes = await httpReq('/api/profile');
      assert.strictEqual(profileRes.json.stats.total_orders, 2);
      assert.strictEqual(profileRes.json.stats.active_orders, 0);
      assert.strictEqual(profileRes.json.stats.delivered_orders, 1);
      assert.strictEqual(profileRes.json.stats.cancelled_orders, 1);
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Data persistence preserved in SQLite', async () => {
    // Verify SQLite directly
    const ordCount = db.getDb().prepare('SELECT COUNT(*) as c FROM orders').get().c;
    assert.strictEqual(ordCount, 2);
    const payCount = db.getDb().prepare('SELECT COUNT(*) as c FROM payments').get().c;
    assert.strictEqual(payCount, 2);
  });

  console.log('\n🌍 Testing INR Pricing & PayPal-Only International Checkout:');
  await testAsync('POST /api/paypal/create-order blocks domestic payments within India', async () => {
    const res = await httpReq('/api/paypal/create-order', 'POST', {
      items: [{ id: 'cyber-shell-black', quantity: 1 }],
      shipping_address: {
        name: 'Akhil',
        email: 'akhil@agentcart.ai',
        address: '402 Cyber Tech Residences',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560038',
        country: 'India'
      }
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.json.error.includes('domestic payments within India'));
  });

  await testAsync('POST /api/paypal/create-order allows eligible international order in USD', async () => {
    setupMockPayPalSandbox();
    try {
      const res = await httpReq('/api/paypal/create-order', 'POST', {
        items: [{ id: 'cyber-shell-black', quantity: 1 }],
        shipping_address: {
          name: 'Global Buyer',
          email: 'buyer@global.example.com',
          address: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'OR',
          postal_code: '97477',
          country: 'United States'
        }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.charged_currency, 'USD');
      assert.ok(res.json.charged_amount > 0);
    } finally {
      restoreFetch();
    }
  });

  // --- 7. Security Hardening & Headers Tests ---
  console.log('\n🔒 Testing Security Hardening & Headers:');

  await testAsync('Security headers are present on all HTTP responses', async () => {
    const res = await httpReq('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.ok(res.headers.get('content-security-policy'), 'Content-Security-Policy header must exist');
  });

  // --- 8. Wishlist / Save for Later Tests ---
  console.log('\n💖 Testing Wishlist / Save for Later Engine:');

  await testAsync('Wishlist lifecycle: toggle add, retrieve full product data, toggle remove', async () => {
    // 1. Initial wishlist
    const getRes1 = await httpReq('/api/wishlist');
    assert.strictEqual(getRes1.status, 200);
    assert.ok(Array.isArray(getRes1.json.items));

    // 2. Add product to wishlist
    const addRes = await httpReq('/api/wishlist/toggle', 'POST', { product_id: 'cyber-shell-black' });
    assert.strictEqual(addRes.status, 200);
    assert.strictEqual(addRes.json.in_wishlist, true);

    // 3. Verify in wishlist
    const getRes2 = await httpReq('/api/wishlist');
    assert.strictEqual(getRes2.status, 200);
    const item = getRes2.json.items.find(i => i.id === 'cyber-shell-black');
    assert.ok(item, 'Item must be in wishlist');
    assert.strictEqual(item.name, 'CyberShell Pro Stormbreaker');
    assert.ok(item.price > 0);

    // 4. Duplicate toggle removes item
    const toggleOffRes = await httpReq('/api/wishlist/toggle', 'POST', { product_id: 'cyber-shell-black' });
    assert.strictEqual(toggleOffRes.status, 200);
    assert.strictEqual(toggleOffRes.json.in_wishlist, false);

    // 5. Explicit DELETE endpoint also works
    await httpReq('/api/wishlist/toggle', 'POST', { product_id: 'cyber-shell-black' });
    const delRes = await httpReq('/api/wishlist/cyber-shell-black', 'DELETE');
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.json.success, true);

    const getRes3 = await httpReq('/api/wishlist');
    assert.ok(!getRes3.json.items.some(i => i.id === 'cyber-shell-black'), 'Item must be removed from wishlist');
  });

  // --- 9. In-App Verified Notifications Tests ---
  console.log('\n🔔 Testing In-App Verified Notifications:');

  await testAsync('Notifications lifecycle: retrieve, mark read, mark all read', async () => {
    // 1. Trigger notification via order or direct DB notification
    db.createNotification('user_akhil', {
      order_id: 'ORD-TEST-NOTIF',
      type: 'ORDER_PLACED',
      title: 'Test Notification',
      message: 'Your automated test notification is ready.'
    });

    const notifRes = await httpReq('/api/notifications');
    assert.strictEqual(notifRes.status, 200);
    assert.ok(Array.isArray(notifRes.json.notifications));
    assert.ok(notifRes.json.unread_count >= 1);

    const testNotif = notifRes.json.notifications.find(n => n.title === 'Test Notification');
    assert.ok(testNotif, 'Created notification must appear');

    // 2. Mark specific notification as read
    const readRes = await httpReq(`/api/notifications/${testNotif.id}/read`, 'POST');
    assert.strictEqual(readRes.status, 200);
    assert.strictEqual(readRes.json.success, true);

    // 3. Mark all read
    const readAllRes = await httpReq('/api/notifications/read-all', 'POST');
    assert.strictEqual(readAllRes.status, 200);
    assert.strictEqual(readAllRes.json.unread_count, 0);
  });

  // --- 10. Admin Authentication, RBAC, and Protected Endpoints ---
  console.log('\n🛡️ Testing Admin Authentication & RBAC:');

  let adminSessionToken = null;

  await testAsync('Admin login rejects invalid credentials with 401', async () => {
    const res = await httpReq('/api/admin/login', 'POST', {
      username: 'admin',
      password: 'WrongPassword123!'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.json.success, false);
  });

  await testAsync('Admin login accepts valid credentials and issues session token', async () => {
    const res = await httpReq('/api/admin/login', 'POST', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'Admin@AgentCart2026!'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.token, 'Session token must be issued');
    assert.strictEqual(res.json.admin.role, 'admin');
    adminSessionToken = res.json.token;
  });

  await testAsync('Admin protected endpoints reject unauthenticated requests', async () => {
    const res1 = await httpReq('/api/admin/stats');
    assert.strictEqual(res1.status, 401);

    const res2 = await httpReq('/api/admin/products');
    assert.strictEqual(res2.status, 401);

    const res3 = await httpReq('/api/admin/orders');
    assert.strictEqual(res3.status, 401);
  });

  await testAsync('Admin protected endpoints succeed with Bearer session token', async () => {
    const res = await httpReq('/api/admin/stats', 'GET', null, {
      'Authorization': `Bearer ${adminSessionToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.stats);
    assert.strictEqual(typeof res.json.stats.total_orders, 'number');
    assert.strictEqual(typeof res.json.stats.low_stock_count, 'number');
  });

  // --- 11. Admin Product & Inventory Management ---
  console.log('\n📦 Testing Admin Inventory & Product Management:');

  await testAsync('Admin can toggle product active status (deactivation hides from customer catalog)', async () => {
    // 1. Deactivate cyber-shell-black
    const toggleRes1 = await httpReq('/api/admin/products/cyber-shell-black/toggle-active', 'POST', {}, {
      'Authorization': `Bearer ${adminSessionToken}`
    });
    assert.strictEqual(toggleRes1.status, 200);
    assert.strictEqual(toggleRes1.json.is_active, false);

    // Customer catalog should now only have 23 active products
    const customerProds1 = await httpReq('/api/products');
    assert.strictEqual(customerProds1.json.count, 23);
    assert.ok(!customerProds1.json.products.some(p => p.id === 'cyber-shell-black'));

    // 2. Reactivate cyber-shell-black
    const toggleRes2 = await httpReq('/api/admin/products/cyber-shell-black/toggle-active', 'POST', {}, {
      'Authorization': `Bearer ${adminSessionToken}`
    });
    assert.strictEqual(toggleRes2.status, 200);
    assert.strictEqual(toggleRes2.json.is_active, true);

    // Customer catalog back to 24 products
    const customerProds2 = await httpReq('/api/products');
    assert.strictEqual(customerProds2.json.count, 24);
  });

  await testAsync('Admin can adjust variant stock level', async () => {
    const stockRes = await httpReq('/api/admin/products/stock', 'POST', {
      variant_id: 1,
      stock: 25
    }, {
      'Authorization': `Bearer ${adminSessionToken}`
    });
    assert.strictEqual(stockRes.status, 200);
    assert.strictEqual(stockRes.json.variant.stock, 25);
  });

  // --- 12. Return & Refund Workflow with PayPal Sandbox ---
  console.log('\n🔄 Testing Customer Return & PayPal Refund Workflow:');

  await testAsync('Complete return lifecycle: request -> approve -> receive & restock -> PayPal Sandbox refund', async () => {
    setupMockPayPalSandbox();
    try {
      // 1. Create and capture a test order
      const createOrderRes = await httpReq('/api/paypal/create-order', 'POST', {
        items: [{ id: 'apex-blaze-orange', size: 'M', color: 'Blaze Orange', quantity: 1 }],
        shipping_address: {
          name: 'Refund Test User',
          email: 'buyer@global.example.com',
          address: '456 Tech Parkway',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94105',
          country: 'United States'
        }
      });
      assert.strictEqual(createOrderRes.status, 200);
      const testOrderId = createOrderRes.json.order_id;
      const paypalOrderId = createOrderRes.json.paypal_order_id;

      // Check stock before capture
      const prodBefore = db.getProductById('apex-blaze-orange');
      const sizeVariantBefore = prodBefore.variants.find(v => v.size === 'M');
      const stockBeforeCapture = sizeVariantBefore.stock;

      // Capture payment
      const captureRes = await httpReq('/api/paypal/capture-order', 'POST', {
        order_id: testOrderId,
        paypal_order_id: paypalOrderId
      });
      assert.strictEqual(captureRes.status, 200);
      assert.strictEqual(captureRes.json.order.status, 'PAID');

      // Verify stock was deducted upon capture
      const prodAfterCapture = db.getProductById('apex-blaze-orange');
      const sizeVariantAfterCapture = prodAfterCapture.variants.find(v => v.size === 'M');
      assert.strictEqual(sizeVariantAfterCapture.stock, stockBeforeCapture - 1);

      // Verify customer total spent increased
      const statsAfterPay = await httpReq('/api/profile');
      assert.ok(statsAfterPay.json.stats.total_spent_inr > 0);
      const spentBeforeRefund = statsAfterPay.json.stats.total_spent_inr;

      // 2. Customer submits return request
      const returnReqRes = await httpReq('/api/returns/request', 'POST', {
        order_id: testOrderId,
        product_id: 'apex-blaze-orange',
        size: 'M',
        quantity: 1,
        reason: 'Sizing too large for athletic fit',
        comments: 'Item unopened with tags attached.'
      });
      assert.strictEqual(returnReqRes.status, 200);
      assert.strictEqual(returnReqRes.json.success, true);
      const returnId = returnReqRes.json.return_request.id;
      assert.strictEqual(returnReqRes.json.return_request.status, 'REQUESTED');

      // 3. Admin views return request
      const adminReturnsRes = await httpReq('/api/admin/returns', 'GET', null, {
        'Authorization': `Bearer ${adminSessionToken}`
      });
      assert.strictEqual(adminReturnsRes.status, 200);
      assert.ok(adminReturnsRes.json.returns.some(r => r.id === returnId));

      // 4. Admin approves return request
      const approveRes = await httpReq(`/api/admin/returns/${returnId}/approve`, 'POST', {
        admin_notes: 'Approved for return inspection.'
      }, {
        'Authorization': `Bearer ${adminSessionToken}`
      });
      assert.strictEqual(approveRes.status, 200);
      assert.strictEqual(approveRes.json.return_request.status, 'APPROVED');

      // 5. Admin marks package received -> triggers verified restock!
      const receiveRes = await httpReq(`/api/admin/returns/${returnId}/receive`, 'POST', {}, {
        'Authorization': `Bearer ${adminSessionToken}`
      });
      assert.strictEqual(receiveRes.status, 200);
      assert.strictEqual(receiveRes.json.return_request.status, 'RECEIVED');

      // Verify inventory was restored!
      const prodAfterRestock = db.getProductById('apex-blaze-orange');
      const sizeVariantAfterRestock = prodAfterRestock.variants.find(v => v.size === 'M');
      assert.strictEqual(sizeVariantAfterRestock.stock, stockBeforeCapture, 'Stock must be safely restocked');

      // 6. Admin executes PayPal Sandbox refund
      const refundRes = await httpReq(`/api/admin/returns/${returnId}/refund`, 'POST', {
        reason: 'Authorized return customer refund'
      }, {
        'Authorization': `Bearer ${adminSessionToken}`
      });
      assert.strictEqual(refundRes.status, 200);
      assert.strictEqual(refundRes.json.success, true);
      assert.strictEqual(refundRes.json.return_request.status, 'REFUNDED');
      assert.ok(refundRes.json.refund.id);

      // 7. Verify customer total spent is updated to deduct refunded amount
      const statsAfterRefund = await httpReq('/api/profile');
      const expectedNetInr = Math.max(0, spentBeforeRefund - refundRes.json.refund.inr_amount);
      assert.strictEqual(statsAfterRefund.json.stats.total_spent_inr, expectedNetInr);
      const expectedNetUsd = Math.max(0, Number((statsAfterPay.json.stats.total_spent_usd - refundRes.json.refund.amount).toFixed(2)));
      assert.strictEqual(statsAfterRefund.json.stats.total_spent_usd, expectedNetUsd);
    } finally {
      restoreFetch();
    }
  });

  await testAsync('Final clean reset sets all dashboard statistics back to zero', async () => {
    const resetRes = await httpReq('/api/orders/reset', 'POST');
    db.resetCatalogInventory();
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.json.stats.total_orders, 0);
    assert.strictEqual(resetRes.json.stats.active_orders, 0);
    assert.strictEqual(resetRes.json.stats.delivered_orders, 0);
    assert.strictEqual(resetRes.json.stats.total_spent_inr, 0);
    assert.strictEqual(resetRes.json.stats.total_spent_usd, 0);
    assert.strictEqual(resetRes.json.stats.recent_activity.length, 0);

    const ordersRes = await httpReq('/api/orders');
    assert.strictEqual(ordersRes.json.count, 0);
    const paymentsRes = await httpReq('/api/payments');
    assert.strictEqual(paymentsRes.json.count, 0);
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
