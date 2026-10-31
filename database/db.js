const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'agentcart.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const CATALOG_PATH = path.join(__dirname, 'catalog.json');

const TRACKING_STAGES = [
  {
    stage_number: 1,
    stage_name: 'Order Placed',
    status_code: 'ORDER_PLACED',
    title: 'Order Placed',
    description: 'Order confirmed and registered in AgentCart system.',
    location: 'AgentCart Online Showroom'
  },
  {
    stage_number: 2,
    stage_name: 'Payment Confirmed',
    status_code: 'PAYMENT_CONFIRMED',
    title: 'Payment Confirmed',
    description: 'Payment authorized and verified via PayPal Sandbox capture.',
    location: 'PayPal Gateway Engine'
  },
  {
    stage_number: 3,
    stage_name: 'Order Processing',
    status_code: 'ORDER_PROCESSING',
    title: 'Order Processing',
    description: 'Garments inspected, tagged, and sealed in technical protective pack.',
    location: 'Bengaluru Fulfillment Center, IN'
  },
  {
    stage_number: 4,
    stage_name: 'Shipped',
    status_code: 'SHIPPED',
    title: 'Shipped',
    description: 'Package dispatched with global express courier. AWB tracking active.',
    location: 'Bengaluru Air Cargo Terminal'
  },
  {
    stage_number: 5,
    stage_name: 'Out for Delivery',
    status_code: 'OUT_FOR_DELIVERY',
    title: 'Out for Delivery',
    description: 'Courier agent en route for doorstep delivery.',
    location: 'Destination Hub'
  },
  {
    stage_number: 6,
    stage_name: 'Delivered',
    status_code: 'DELIVERED',
    title: 'Delivered',
    description: 'Package delivered successfully and signed for.',
    location: 'Delivery Address'
  }
];

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbInstance = new DatabaseSync(DB_PATH);
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    dbInstance.exec(schema);

    // Schema migrations for orders table
    try {
      const pragma = dbInstance.prepare("PRAGMA table_info(orders)").all();
      const colNames = pragma.map(c => c.name);
      if (!colNames.includes('charged_amount')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN charged_amount REAL;");
      }
      if (!colNames.includes('charged_currency')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN charged_currency TEXT DEFAULT 'USD';");
      }
      if (!colNames.includes('user_id')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN user_id TEXT DEFAULT 'user_akhil';");
      }
      if (!colNames.includes('country')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN country TEXT DEFAULT 'India';");
      }
      if (!colNames.includes('exchange_rate')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN exchange_rate REAL DEFAULT 85.0;");
      }
      if (!colNames.includes('estimated_delivery')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN estimated_delivery TEXT;");
      }
      if (!colNames.includes('actual_delivery_date')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN actual_delivery_date TEXT;");
      }
    } catch (e) {
      console.error('Error running orders migrations:', e.message);
    }

    seedIfEmpty();
    ensureDefaultProfile();
    migrateExistingOrders();
  }
  return dbInstance;
}

function initTables() {
  return getDb();
}

function ensureDefaultProfile() {
  const existing = dbInstance.prepare('SELECT * FROM user_profiles WHERE id = ?').get('user_akhil');
  if (!existing) {
    dbInstance.prepare(`
      INSERT INTO user_profiles (
        id, name, email, phone, shipping_address, city, state, postal_code, country
      ) VALUES (
        'user_akhil', 'Akhil', 'akhil@agentcart.ai', '+91 98765 43210',
        '402 Cyber Tech Residences, Indiranagar', 'Bengaluru', 'Karnataka', '560038', 'India'
      )
    `).run();
    console.log('[SQLite] Default persistent user profile "Akhil" initialized.');
  }
}

function migrateExistingOrders() {
  // Associate all orders with default profile Akhil
  dbInstance.prepare(`
    UPDATE orders 
    SET user_id = 'user_akhil' 
    WHERE user_id IS NULL OR user_id = ''
  `).run();

  // Ensure default country for orders if missing
  dbInstance.prepare(`
    UPDATE orders 
    SET country = 'India' 
    WHERE country IS NULL OR country = ''
  `).run();
}

function resetOrderHistory(userId = 'user_akhil') {
  const db = getDb();

  // Clear tracking events for user's orders
  db.prepare(`
    DELETE FROM order_tracking_events 
    WHERE order_id IN (SELECT id FROM orders WHERE user_id = ? OR user_id IS NULL)
  `).run(userId);

  // Clear payments for user's orders
  db.prepare(`
    DELETE FROM payments 
    WHERE order_id IN (SELECT id FROM orders WHERE user_id = ? OR user_id IS NULL)
  `).run(userId);

  // Clear order items for user's orders
  db.prepare(`
    DELETE FROM order_items 
    WHERE order_id IN (SELECT id FROM orders WHERE user_id = ? OR user_id IS NULL)
  `).run(userId);

  // Clear orders
  db.prepare(`
    DELETE FROM orders 
    WHERE user_id = ? OR user_id IS NULL
  `).run(userId);

  // Clean up any remaining orphan tracking/payment/item rows
  db.prepare('DELETE FROM order_tracking_events WHERE order_id NOT IN (SELECT id FROM orders)').run();
  db.prepare('DELETE FROM payments WHERE order_id NOT IN (SELECT id FROM orders)').run();
  db.prepare('DELETE FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)').run();

  console.log(`[SQLite] Order history and transaction records completely reset for user: ${userId}`);
  return getUserStats(userId);
}

function seedIfEmpty() {
  const row = dbInstance.prepare('SELECT COUNT(*) as cnt FROM products').get();
  if (row.cnt === 0) {
    console.log('Database empty. Seeding catalog into SQLite...');
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    
    const insertProduct = dbInstance.prepare(`
      INSERT INTO products (
        id, name, category, style, price, original_price, material,
        features, description, image, rating, reviews_count, stock_status,
        waterproof_rating, breathability, weight, fit, featured
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const insertVariant = dbInstance.prepare(`
      INSERT INTO product_variants (product_id, size, color_name, color_hex, stock)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of catalog) {
      insertProduct.run(
        p.id,
        p.name,
        p.category,
        p.style,
        p.price,
        p.original_price || null,
        p.material,
        JSON.stringify(p.features),
        p.description,
        p.image,
        p.rating || 4.5,
        p.reviews_count || 0,
        p.stock_status || 'In Stock',
        p.waterproof_rating || null,
        p.breathability || null,
        p.weight || null,
        p.fit || null,
        p.featured ? 1 : 0
      );

      // Seed variants
      for (const sizeObj of p.sizes) {
        for (const col of p.colors) {
          insertVariant.run(p.id, sizeObj.size, col.name, col.hex, sizeObj.stock);
        }
      }
    }
    console.log(`Seeded ${catalog.length} jackets into SQLite database.`);
  }
}

function getAllProducts(filters = {}) {
  const db = getDb();
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (filters.category && filters.category !== 'All') {
    query += ' AND category = ?';
    params.push(filters.category);
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(material) LIKE ? OR LOWER(features) LIKE ? OR LOWER(description) LIKE ?)';
    params.push(term, term, term, term, term);
  }

  if (filters.minPrice) {
    query += ' AND price >= ?';
    params.push(Number(filters.minPrice));
  }

  if (filters.maxPrice) {
    query += ' AND price <= ?';
    params.push(Number(filters.maxPrice));
  }

  // Sorting
  switch (filters.sort) {
    case 'price-asc':
      query += ' ORDER BY price ASC';
      break;
    case 'price-desc':
      query += ' ORDER BY price DESC';
      break;
    case 'name-asc':
      query += ' ORDER BY name ASC';
      break;
    case 'rating-desc':
      query += ' ORDER BY rating DESC';
      break;
    default:
      query += ' ORDER BY featured DESC, price ASC';
  }

  const rows = db.prepare(query).all(...params);
  
  // Attach colors and sizes to each product
  const getVariants = db.prepare('SELECT size, color_name, color_hex, stock FROM product_variants WHERE product_id = ?');

  return rows.map(r => {
    const variants = getVariants.all(r.id);
    const uniqueSizes = [...new Set(variants.map(v => v.size))];
    const uniqueColors = [];
    const colorSeen = new Set();
    for (const v of variants) {
      if (!colorSeen.has(v.color_name)) {
        colorSeen.add(v.color_name);
        uniqueColors.push({ name: v.color_name, hex: v.color_hex });
      }
    }

    return {
      ...r,
      features: JSON.parse(r.features),
      featured: Boolean(r.featured),
      sizes: uniqueSizes.map(s => {
        const matching = variants.filter(v => v.size === s);
        return {
          size: s,
          stock: matching.reduce((acc, curr) => acc + curr.stock, 0)
        };
      }),
      colors: uniqueColors
    };
  });
}

function getProductById(id) {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;

  const variants = db.prepare('SELECT size, color_name, color_hex, stock FROM product_variants WHERE product_id = ?').all(id);
  const uniqueSizes = [...new Set(variants.map(v => v.size))];
  const uniqueColors = [];
  const colorSeen = new Set();
  for (const v of variants) {
    if (!colorSeen.has(v.color_name)) {
      colorSeen.add(v.color_name);
      uniqueColors.push({ name: v.color_name, hex: v.color_hex });
    }
  }

  return {
    ...product,
    features: JSON.parse(product.features),
    featured: Boolean(product.featured),
    sizes: uniqueSizes.map(s => {
      const matching = variants.filter(v => v.size === s);
      return {
        size: s,
        stock: matching.reduce((acc, curr) => acc + curr.stock, 0)
      };
    }),
    colors: uniqueColors,
    variants
  };
}

// ============================================================================
// PROFILE MANAGEMENT (Persistent SQLite Profile: Akhil)
// ============================================================================

function getUserProfile(userId = 'user_akhil') {
  const db = getDb();
  let user = db.prepare('SELECT * FROM user_profiles WHERE id = ?').get(userId);
  if (!user && userId === 'user_akhil') {
    ensureDefaultProfile();
    user = db.prepare('SELECT * FROM user_profiles WHERE id = ?').get('user_akhil');
  }
  return user || null;
}

function updateUserProfile(userId = 'user_akhil', profileData = {}) {
  const db = getDb();
  const existing = getUserProfile(userId);
  if (!existing) {
    throw new Error(`User profile ${userId} not found.`);
  }

  const name = (profileData.name || existing.name).trim();
  const email = (profileData.email || existing.email).trim();
  const phone = profileData.phone !== undefined ? profileData.phone.trim() : (existing.phone || '');
  const shipping_address = (profileData.shipping_address || profileData.delivery_address || existing.shipping_address || '').trim();
  const city = (profileData.city || existing.city || 'Bengaluru').trim();
  const state = (profileData.state || existing.state || 'Karnataka').trim();
  const postal_code = (profileData.postal_code || profileData.pin_code || existing.postal_code || '560038').trim();
  const country = (profileData.country || existing.country || 'India').trim();

  if (!name || !email) {
    throw new Error('Name and email are required fields.');
  }

  db.prepare(`
    UPDATE user_profiles 
    SET name = ?, email = ?, phone = ?, shipping_address = ?,
        city = ?, state = ?, postal_code = ?, country = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, email, phone, shipping_address, city, state, postal_code, country, userId);

  return getUserProfile(userId);
}

function getUserStats(userId = 'user_akhil') {
  const db = getDb();
  
  // Total orders
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(userId).count;

  // Active orders (PENDING, PAID, PROCESSING, SHIPPED, OUT_FOR_DELIVERY)
  const activeOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ? AND status IN ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY')
  `).get(userId).count;

  // Delivered orders
  const deliveredOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ? AND status = 'DELIVERED'
  `).get(userId).count;

  // Cancelled orders
  const cancelledOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ? AND status = 'CANCELLED'
  `).get(userId).count;

  // Total spent in INR (for PAID / DELIVERED / active paid orders)
  const spentInr = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM orders 
    WHERE user_id = ? AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST')
  `).get(userId).total;

  // Total spent in USD
  const spentUsd = db.prepare(`
    SELECT COALESCE(SUM(charged_amount), 0) as total FROM orders 
    WHERE user_id = ? AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST')
  `).get(userId).total;

  // Recent activity (5 most recent orders)
  const recentOrders = db.prepare(`
    SELECT id, total_amount, currency, charged_amount, charged_currency, status, created_at, updated_at
    FROM orders 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(userId);

  const totalSpentInr = Number(spentInr || 0);
  const totalSpentUsd = totalSpentInr === 0 ? 0 : Number((spentUsd || (totalSpentInr / 85)).toFixed(2));

  return {
    total_orders: totalOrders,
    active_orders: activeOrders,
    delivered_orders: deliveredOrders,
    cancelled_orders: cancelledOrders,
    total_spent_inr: totalSpentInr,
    total_spent_usd: totalSpentUsd,
    recent_activity: recentOrders
  };
}

// ============================================================================
// ORDERS & ORDER TRACKING
// ============================================================================

function createOrder(orderData, items) {
  const db = getDb();
  
  // Calculate realistic estimated delivery (3-5 business days)
  const now = new Date();
  const estDeliveryDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const estDeliveryFormatted = estDeliveryDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, user_id, customer_name, customer_email, shipping_address,
      city, state, postal_code, country, phone, subtotal, delivery_fee,
      total_amount, currency, charged_amount, charged_currency,
      exchange_rate, estimated_delivery, actual_delivery_date, status, payment_provider, provider_order_id
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  const insertItem = db.prepare(`
    INSERT INTO order_items (
      order_id, product_id, product_name, size, color, unit_price, quantity, line_total
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  insertOrder.run(
    orderData.id,
    orderData.user_id || 'user_akhil',
    orderData.customer_name,
    orderData.customer_email,
    orderData.shipping_address,
    orderData.city || 'Bengaluru',
    orderData.state || 'Karnataka',
    orderData.postal_code || '560001',
    orderData.country || 'India',
    orderData.phone || '',
    orderData.subtotal,
    orderData.delivery_fee,
    orderData.total_amount,
    orderData.currency || 'INR',
    orderData.charged_amount != null ? orderData.charged_amount : null,
    orderData.charged_currency || 'USD',
    orderData.exchange_rate || 85.0,
    orderData.estimated_delivery || estDeliveryFormatted,
    orderData.actual_delivery_date || null,
    orderData.status || 'PENDING',
    orderData.payment_provider || 'PAYPAL_SANDBOX',
    orderData.provider_order_id || null
  );

  for (const it of items) {
    insertItem.run(
      orderData.id,
      it.product_id,
      it.product_name,
      it.size,
      it.color,
      it.unit_price,
      it.quantity,
      it.line_total
    );
  }

  // Record Stage 1 tracking event: Order Placed
  addTrackingEvent(orderData.id, {
    stage_number: 1,
    stage_name: 'Order Placed',
    status_code: 'ORDER_PLACED',
    title: 'Order Placed',
    description: 'Order confirmed and registered in AgentCart system.',
    location: 'AgentCart Online Showroom'
  });

  // Record PENDING payment record in payments table
  const payId = 'PAY-' + orderData.id;
  const chargedAmt = orderData.charged_amount != null ? orderData.charged_amount : Number((orderData.total_amount / (orderData.exchange_rate || 85)).toFixed(2));
  
  db.prepare(`
    INSERT OR REPLACE INTO payments (
      id, order_id, provider_order_id, transaction_id, payment_method,
      amount, currency, inr_amount, exchange_rate, status, payer_email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payId,
    orderData.id,
    orderData.provider_order_id || null,
    null,
    'PayPal Sandbox',
    chargedAmt,
    orderData.charged_currency || 'USD',
    orderData.total_amount,
    orderData.exchange_rate || 85.0,
    'PENDING',
    orderData.customer_email
  );

  return getOrderById(orderData.id);
}

function updateOrderStatus(orderId, status, paymentId = null, actualDeliveryDate = null) {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) {
    throw new Error(`Order ${orderId} not found.`);
  }

  let actualDeliv = actualDeliveryDate;
  if (status === 'DELIVERED' && !actualDeliv) {
    actualDeliv = new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  const stmt = db.prepare(`
    UPDATE orders 
    SET status = ?, 
        payment_id = COALESCE(?, payment_id), 
        actual_delivery_date = COALESCE(?, actual_delivery_date),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(status, paymentId, actualDeliv, existing.id);

  // Automatically record tracking event if matching stage
  if (['PAID', 'PAID_DEMO_TEST'].includes(status)) {
    addTrackingEvent(existing.id, {
      stage_number: 2,
      stage_name: 'Payment Confirmed',
      status_code: 'PAYMENT_CONFIRMED',
      title: 'Payment Confirmed',
      description: status === 'PAID_DEMO_TEST' 
        ? 'Payment verified via verified offline sandbox simulation.'
        : `Payment verified and captured via PayPal Sandbox (Txn ID: ${paymentId || 'Verified'}).`,
      location: 'PayPal Gateway Engine'
    });
  } else if (status === 'PROCESSING') {
    addTrackingEvent(existing.id, {
      stage_number: 3,
      stage_name: 'Order Processing',
      status_code: 'ORDER_PROCESSING',
      title: 'Order Processing',
      description: 'Garments inspected, tagged, and sealed in technical protective pack.',
      location: 'Bengaluru Fulfillment Center, IN'
    });
  } else if (status === 'SHIPPED') {
    addTrackingEvent(existing.id, {
      stage_number: 4,
      stage_name: 'Shipped',
      status_code: 'SHIPPED',
      title: 'Shipped',
      description: 'Package dispatched with global express courier. AWB tracking active.',
      location: 'Bengaluru Air Cargo Terminal'
    });
  } else if (status === 'OUT_FOR_DELIVERY') {
    addTrackingEvent(existing.id, {
      stage_number: 5,
      stage_name: 'Out for Delivery',
      status_code: 'OUT_FOR_DELIVERY',
      title: 'Out for Delivery',
      description: 'Courier agent en route for doorstep delivery.',
      location: 'Destination Hub'
    });
  } else if (status === 'DELIVERED') {
    addTrackingEvent(existing.id, {
      stage_number: 6,
      stage_name: 'Delivered',
      status_code: 'DELIVERED',
      title: 'Delivered',
      description: 'Package delivered successfully and signed for.',
      location: 'Delivery Address',
      completed_at: actualDeliv
    });
  }

  return getOrderById(existing.id);
}

function getOrderById(orderId) {
  if (!orderId) return null;
  const db = getDb();
  let order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    order = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(orderId);
  }
  if (!order) return null;

  const items = db.prepare(`
    SELECT i.*, p.image, p.category 
    FROM order_items i 
    LEFT JOIN products p ON i.product_id = p.id 
    WHERE i.order_id = ?
  `).all(order.id);

  const trackingEvents = db.prepare(`
    SELECT * FROM order_tracking_events 
    WHERE order_id = ? 
    ORDER BY stage_number ASC, completed_at ASC
  `).all(order.id);

  const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id) || null;

  return {
    ...order,
    items,
    tracking_events: trackingEvents,
    payment
  };
}

function getOrderByProviderOrderId(providerOrderId) {
  if (!providerOrderId) return null;
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(providerOrderId);
  if (!order) return null;
  return getOrderById(order.id);
}

function getUserOrders(userId = 'user_akhil', options = {}) {
  const db = getDb();
  let query = 'SELECT * FROM orders WHERE user_id = ?';
  const params = [userId];

  if (options.status && options.status !== 'ALL') {
    if (options.status === 'ACTIVE') {
      query += " AND status IN ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY')";
    } else if (options.status === 'DELIVERED') {
      query += " AND status = 'DELIVERED'";
    } else if (options.status === 'CANCELLED') {
      query += " AND status = 'CANCELLED'";
    } else {
      query += ' AND status = ?';
      params.push(options.status);
    }
  }

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(id) LIKE ? OR LOWER(provider_order_id) LIKE ? OR LOWER(payment_id) LIKE ?)';
    params.push(term, term, term);
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(Number(options.limit));
    if (options.offset) {
      query += ' OFFSET ?';
      params.push(Number(options.offset));
    }
  }

  const orders = db.prepare(query).all(...params);

  const getItemStmt = db.prepare(`
    SELECT i.*, p.image, p.category 
    FROM order_items i 
    LEFT JOIN products p ON i.product_id = p.id 
    WHERE i.order_id = ?
  `);

  const getTrackingStmt = db.prepare(`
    SELECT * FROM order_tracking_events 
    WHERE order_id = ? 
    ORDER BY stage_number ASC
  `);

  const getPaymentStmt = db.prepare('SELECT * FROM payments WHERE order_id = ?');

  return orders.map(ord => ({
    ...ord,
    items: getItemStmt.all(ord.id),
    tracking_events: getTrackingStmt.all(ord.id),
    payment: getPaymentStmt.get(ord.id) || null
  }));
}

function addTrackingEvent(orderId, eventData) {
  const db = getDb();
  // Check if this stage event already exists for this order
  const existing = db.prepare(`
    SELECT id FROM order_tracking_events 
    WHERE order_id = ? AND stage_number = ?
  `).get(orderId, eventData.stage_number);

  if (existing) {
    return existing;
  }

  const insert = db.prepare(`
    INSERT INTO order_tracking_events (
      order_id, stage_number, stage_name, status_code, title, description, location, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `);

  insert.run(
    orderId,
    eventData.stage_number,
    eventData.stage_name,
    eventData.status_code,
    eventData.title,
    eventData.description,
    eventData.location || null,
    eventData.completed_at || null
  );

  return db.prepare('SELECT * FROM order_tracking_events WHERE order_id = ? AND stage_number = ?').get(orderId, eventData.stage_number);
}

function getOrderTracking(orderId) {
  const order = getOrderById(orderId);
  if (!order) return null;

  // Build full 6-stage timeline with genuine completion status
  const completedEvents = order.tracking_events || [];
  const completedStageMap = new Map();
  for (const ev of completedEvents) {
    completedStageMap.set(ev.stage_number, ev);
  }

  const timeline = TRACKING_STAGES.map(stage => {
    const isCompleted = completedStageMap.has(stage.stage_number);
    const eventRecord = completedStageMap.get(stage.stage_number);
    return {
      stage_number: stage.stage_number,
      stage_name: stage.stage_name,
      status_code: stage.status_code,
      title: eventRecord ? eventRecord.title : stage.title,
      description: eventRecord ? eventRecord.description : stage.description,
      location: eventRecord ? eventRecord.location : stage.location,
      completed: isCompleted,
      completed_at: eventRecord ? eventRecord.completed_at : null
    };
  });

  return {
    order_id: order.id,
    current_status: order.status,
    customer_name: order.customer_name,
    shipping_address: `${order.shipping_address}, ${order.city}, ${order.state} ${order.postal_code}, ${order.country}`,
    estimated_delivery: order.estimated_delivery || '3-5 Business Days',
    actual_delivery_date: order.actual_delivery_date || null,
    created_at: order.created_at,
    updated_at: order.updated_at,
    timeline,
    items: order.items,
    payment: order.payment
  };
}

// ============================================================================
// PAYMENTS MANAGEMENT
// ============================================================================

function getPayments(options = {}) {
  const db = getDb();
  let query = `
    SELECT p.*, o.customer_name, o.customer_email as order_email, o.shipping_address, o.city
    FROM payments p
    LEFT JOIN orders o ON p.order_id = o.id
    WHERE 1=1
  `;
  const params = [];

  if (options.status && options.status !== 'ALL') {
    query += ' AND p.status = ?';
    params.push(options.status);
  }

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(p.id) LIKE ? OR LOWER(p.order_id) LIKE ? OR LOWER(p.provider_order_id) LIKE ? OR LOWER(p.transaction_id) LIKE ?)';
    params.push(term, term, term, term);
  }

  query += ' ORDER BY p.created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(Number(options.limit));
    if (options.offset) {
      query += ' OFFSET ?';
      params.push(Number(options.offset));
    }
  }

  return db.prepare(query).all(...params);
}

function getPaymentById(id) {
  if (!id) return null;
  const db = getDb();
  return db.prepare(`
    SELECT p.*, o.customer_name, o.customer_email as order_email
    FROM payments p
    LEFT JOIN orders o ON p.order_id = o.id
    WHERE p.id = ? OR p.order_id = ? OR p.transaction_id = ? OR p.provider_order_id = ?
  `).get(id, id, id, id) || null;
}

function updatePaymentStatus(orderId, status, details = {}) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
  
  if (!existing) {
    // If payment doesn't exist yet, insert it
    const order = getOrderById(orderId);
    if (!order) return null;
    db.prepare(`
      INSERT INTO payments (
        id, order_id, provider_order_id, transaction_id, payment_method,
        amount, currency, inr_amount, exchange_rate, status, payer_email,
        debug_id, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      'PAY-' + order.id,
      order.id,
      details.provider_order_id || order.provider_order_id || null,
      details.transaction_id || order.payment_id || null,
      details.payment_method || 'PayPal Sandbox',
      details.amount || order.charged_amount || Number((order.total_amount / 85).toFixed(2)),
      details.currency || order.charged_currency || 'USD',
      order.total_amount,
      85.0,
      status,
      details.payer_email || order.customer_email,
      details.debug_id || null,
      details.error_message || null
    );
  } else {
    db.prepare(`
      UPDATE payments 
      SET status = ?, 
          transaction_id = COALESCE(?, transaction_id),
          provider_order_id = COALESCE(?, provider_order_id),
          debug_id = COALESCE(?, debug_id),
          error_message = COALESCE(?, error_message),
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(
      status,
      details.transaction_id || null,
      details.provider_order_id || null,
      details.debug_id || null,
      details.error_message || null,
      orderId
    );
  }

  return db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId);
}

module.exports = {
  getDb,
  initTables,
  getAllProducts,
  getProductById,
  getUserProfile,
  updateUserProfile,
  getUserStats,
  resetOrderHistory,
  createOrder,
  updateOrderStatus,
  getOrderById,
  getOrderByProviderOrderId,
  getUserOrders,
  addTrackingEvent,
  getOrderTracking,
  getPayments,
  getPaymentById,
  updatePaymentStatus,
  TRACKING_STAGES
};
