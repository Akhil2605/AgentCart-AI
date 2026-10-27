/**
 * Comprehensive Automated Test Suite for AgentCart AI
 * Tests Database, Logic, Server Endpoints, AI Recommender, and PayPal Checkout
 */
const assert = require('assert');
const http = require('http');
const db = require('../server/db');
const gemini = require('../server/gemini');
const paypal = require('../server/paypal');
const { app } = require('../server/server');

const TEST_PORT = 3001;

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

  // --- 5. Order Lifecycle & SQLite Persistence ---
  console.log('\n💾 Testing Order Lifecycle & SQLite Persistence:');

  test('Order status transitions properly from PENDING to PAID', () => {
    const shipping = {
      name: 'Order Lifecycle Test',
      email: 'order@test.com',
      address: '42 Matrix Lane',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560002'
    };
    const order = paypal.validateAndCalculateOrder([{ id: 'apex-blaze-orange', quantity: 1 }], shipping);
    assert.strictEqual(order.status, 'PENDING');

    const updated = db.updateOrderStatus(order.id, 'PAID', 'TEST-TXN-12345');
    assert.strictEqual(updated.status, 'PAID');
    assert.strictEqual(updated.payment_id, 'TEST-TXN-12345');
  });

  // --- 6. Live HTTP Endpoint Tests ---
  console.log('\n🌐 Testing Live Express HTTP Endpoints:');

  const testServer = await new Promise(resolve => {
    const s = app.listen(TEST_PORT, () => resolve(s));
  });

  async function httpReq(path, method = 'GET', body = null) {
    const res = await fetch(`http://localhost:${TEST_PORT}${path}`, {
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
  });

  await testAsync('GET /api/config returns shipping rules & provider status', async () => {
    const res = await httpReq('/api/config');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.free_shipping_threshold, 2000);
    assert.strictEqual(res.json.standard_shipping_fee, 150);
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

  await testAsync('POST /api/paypal/create-order and /api/paypal/demo-simulate completes order', async () => {
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
    const orderId = createRes.json.order.id;
    assert.strictEqual(createRes.json.order.subtotal, 1999 * 2);

    const simRes = await httpReq('/api/paypal/demo-simulate', 'POST', { order_id: orderId });
    assert.strictEqual(simRes.status, 200);
    assert.ok(simRes.json.success);
    assert.strictEqual(simRes.json.order.status, 'PAID_DEMO_TEST');
  });

  await new Promise(resolve => testServer.close(resolve));
  try {
    db.getDb().close();
  } catch (e) {}

  console.log(`\n========================================`);
  console.log(`🏁 Test Results: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`========================================\n`);
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
