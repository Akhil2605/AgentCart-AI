const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');

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
      const pragmaOrders = dbInstance.prepare("PRAGMA table_info(orders)").all();
      const orderCols = pragmaOrders.map(c => c.name);
      if (!orderCols.includes('charged_amount')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN charged_amount REAL;");
      }
      if (!orderCols.includes('charged_currency')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN charged_currency TEXT DEFAULT 'USD';");
      }
      if (!orderCols.includes('user_id')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN user_id TEXT DEFAULT 'user_akhil';");
      }
      if (!orderCols.includes('country')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN country TEXT DEFAULT 'India';");
      }
      if (!orderCols.includes('exchange_rate')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN exchange_rate REAL DEFAULT 85.0;");
      }
      if (!orderCols.includes('estimated_delivery')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN estimated_delivery TEXT;");
      }
      if (!orderCols.includes('actual_delivery_date')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN actual_delivery_date TEXT;");
      }
      if (!orderCols.includes('stock_deducted')) {
        dbInstance.exec("ALTER TABLE orders ADD COLUMN stock_deducted INTEGER DEFAULT 0;");
      }
    } catch (e) {
      console.error('Error running orders migrations:', e.message);
    }

    // Schema migrations for products table
    try {
      const pragmaProducts = dbInstance.prepare("PRAGMA table_info(products)").all();
      const prodCols = pragmaProducts.map(c => c.name);
      if (!prodCols.includes('is_active')) {
        dbInstance.exec("ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1;");
      }
    } catch (e) {
      console.error('Error running products migrations:', e.message);
    }

    seedIfEmpty();
    ensureDefaultProfile();
    ensureAdminAccount();
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

// ============================================================================
// ADMIN AUTH & CREDENTIAL MANAGEMENT
// ============================================================================

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function ensureAdminAccount() {
  const existing = dbInstance.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const password = process.env.ADMIN_PASSWORD || 'Admin@AgentCart2026!';
    const passwordHash = hashPassword(password, salt);

    dbInstance.prepare(`
      INSERT INTO admin_users (id, username, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin_primary', 'admin', passwordHash, salt, 'admin');

    console.log('[SQLite] Authorized admin account initialized with salted scrypt hash.');
  }
}

function verifyAdminCredentials(username, password) {
  if (!username || !password) return null;
  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username.trim());
  if (!admin) return null;

  const testHash = hashPassword(password, admin.salt);
  if (crypto.timingSafeEqual(Buffer.from(admin.password_hash, 'hex'), Buffer.from(testHash, 'hex'))) {
    return {
      id: admin.id,
      username: admin.username,
      role: admin.role
    };
  }
  return null;
}

function createAdminSession(adminId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  // 24 hours expiry
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO admin_sessions (token, admin_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, adminId, expiresAt);

  return { token, expiresAt };
}

function validateAdminSession(token) {
  if (!token) return null;
  const db = getDb();
  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id as admin_id, u.username, u.role
    FROM admin_sessions s
    JOIN admin_users u ON s.admin_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `).get(token);

  return session || null;
}

function deleteAdminSession(token) {
  if (!token) return;
  const db = getDb();
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

function migrateExistingOrders() {
  dbInstance.prepare(`
    UPDATE orders 
    SET user_id = 'user_akhil' 
    WHERE user_id IS NULL OR user_id = ''
  `).run();

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

  // Clear refunds for user's orders
  db.prepare(`
    DELETE FROM refunds 
    WHERE user_id = ? OR user_id IS NULL
  `).run(userId);

  // Clear returns for user's orders
  db.prepare(`
    DELETE FROM returns 
    WHERE user_id = ? OR user_id IS NULL
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

  // Clear notifications for user
  db.prepare(`
    DELETE FROM notifications 
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
        waterproof_rating, breathability, weight, fit, featured, is_active
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, 1
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

// ============================================================================
// PRODUCT RETRIEVAL & FILTERING
// ============================================================================

function getAllProducts(filters = {}, includeInactive = false) {
  const db = getDb();
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (!includeInactive) {
    query += ' AND (is_active = 1 OR is_active IS NULL)';
  }

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
  
  // Attach colors, sizes, and variants to each product
  const getVariants = db.prepare('SELECT id, size, color_name, color_hex, stock FROM product_variants WHERE product_id = ?');

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

    const totalStock = variants.reduce((acc, curr) => acc + curr.stock, 0);

    return {
      ...r,
      features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []),
      featured: Boolean(r.featured),
      is_active: r.is_active !== 0,
      total_stock: totalStock,
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
  });
}

function getProductById(id) {
  if (!id) return null;
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;

  const variants = db.prepare('SELECT id, size, color_name, color_hex, stock FROM product_variants WHERE product_id = ?').all(id);
  const uniqueSizes = [...new Set(variants.map(v => v.size))];
  const uniqueColors = [];
  const colorSeen = new Set();
  for (const v of variants) {
    if (!colorSeen.has(v.color_name)) {
      colorSeen.add(v.color_name);
      uniqueColors.push({ name: v.color_name, hex: v.color_hex });
    }
  }

  const totalStock = variants.reduce((acc, curr) => acc + curr.stock, 0);

  return {
    ...product,
    features: typeof product.features === 'string' ? JSON.parse(product.features) : (product.features || []),
    featured: Boolean(product.featured),
    is_active: product.is_active !== 0,
    total_stock: totalStock,
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

  // Base total spent in INR (for PAID / DELIVERED / active paid orders)
  const spentInr = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM orders 
    WHERE user_id = ? AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST')
  `).get(userId).total;

  // Base total spent in USD
  const spentUsd = db.prepare(`
    SELECT COALESCE(SUM(charged_amount), 0) as total FROM orders 
    WHERE user_id = ? AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST')
  `).get(userId).total;

  // Subtract refunded amounts from total spending
  const refundedInr = db.prepare(`
    SELECT COALESCE(SUM(inr_amount), 0) as total FROM refunds 
    WHERE user_id = ? AND status = 'COMPLETED'
  `).get(userId).total;

  const refundedUsd = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM refunds 
    WHERE user_id = ? AND status = 'COMPLETED'
  `).get(userId).total;

  const netSpentInr = Math.max(0, Number(spentInr || 0) - Number(refundedInr || 0));
  const netSpentUsd = netSpentInr === 0 ? 0 : Math.max(0, Number((Number(spentUsd || (netSpentInr / 85)) - Number(refundedUsd || 0)).toFixed(2)));

  // Wishlist count
  const wishlistCount = db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?').get(userId).count;

  // Returns count
  const returnsCount = db.prepare('SELECT COUNT(*) as count FROM returns WHERE user_id = ?').get(userId).count;

  // Recent activity (5 most recent orders)
  const recentOrders = db.prepare(`
    SELECT id, total_amount, currency, charged_amount, charged_currency, status, created_at, updated_at
    FROM orders 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(userId);

  return {
    total_orders: totalOrders,
    active_orders: activeOrders,
    delivered_orders: deliveredOrders,
    cancelled_orders: cancelledOrders,
    total_spent_inr: netSpentInr,
    total_spent_usd: netSpentUsd,
    wishlist_count: wishlistCount,
    returns_count: returnsCount,
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
      exchange_rate, estimated_delivery, actual_delivery_date, status, payment_provider, provider_order_id, stock_deducted
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, 0
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

  // Send in-app notification to customer
  createNotification(orderData.user_id || 'user_akhil', {
    order_id: orderData.id,
    type: 'ORDER_PLACED',
    title: 'Order Placed Successfully',
    message: `Your order ${orderData.id} has been registered and is awaiting payment confirmation.`
  });

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
    createNotification(existing.user_id, {
      order_id: existing.id,
      type: 'ORDER_PROCESSING',
      title: 'Order In Processing',
      message: `Order ${existing.id} is being inspected and prepared for shipment.`
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
    createNotification(existing.user_id, {
      order_id: existing.id,
      type: 'SHIPPED',
      title: 'Order Dispatched',
      message: `Your technical outerwear for order ${existing.id} has shipped via Express Air.`
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
    createNotification(existing.user_id, {
      order_id: existing.id,
      type: 'OUT_FOR_DELIVERY',
      title: 'Out for Delivery',
      message: `Order ${existing.id} is out for delivery to your shipping address today.`
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
    createNotification(existing.user_id, {
      order_id: existing.id,
      type: 'DELIVERED',
      title: 'Order Delivered',
      message: `Order ${existing.id} was successfully delivered. Enjoy your technical outerwear!`
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
  const refunds = db.prepare('SELECT * FROM refunds WHERE order_id = ?').all(order.id);

  return {
    ...order,
    items,
    tracking_events: trackingEvents,
    payment,
    refunds
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

// ============================================================================
// INVENTORY RULES: STOCK CHECKS, DEDUCTION ON CAPTURE, AND RESTOCKING
// ============================================================================

function checkOrderStockAvailable(items) {
  const db = getDb();
  for (const it of items) {
    const qty = Number(it.quantity) || 1;
    const size = it.size || 'M';
    const prod = db.prepare('SELECT name FROM products WHERE id = ?').get(it.id);
    if (!prod) {
      throw new Error(`Product not found in catalog: ${it.id}`);
    }

    const variant = db.prepare(`
      SELECT * FROM product_variants 
      WHERE product_id = ? AND size = ? 
      LIMIT 1
    `).get(it.id, size);

    if (!variant || variant.stock < qty) {
      const name = prod.name;
      const available = variant ? variant.stock : 0;
      throw new Error(`Insufficient inventory: "${name}" (Size ${size}) only has ${available} units available (requested ${qty}).`);
    }
  }
  return true;
}

function deductOrderStock(orderId) {
  const db = getDb();
  const order = getOrderById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found.`);
  if (order.stock_deducted === 1) {
    console.log(`[Inventory] Stock already deducted for order ${orderId}. Skipping.`);
    return true;
  }

  // Deduct in transaction
  db.exec('BEGIN TRANSACTION');
  try {
    for (const item of order.items) {
      const size = item.size || 'M';
      // Find best matching variant (by size and color if possible, or size)
      let variant = db.prepare(`
        SELECT id, stock FROM product_variants 
        WHERE product_id = ? AND size = ? AND color_name = ?
      `).get(item.product_id, size, item.color);

      if (!variant) {
        variant = db.prepare(`
          SELECT id, stock FROM product_variants 
          WHERE product_id = ? AND size = ?
          LIMIT 1
        `).get(item.product_id, size);
      }

      if (variant) {
        const newStock = Math.max(0, variant.stock - item.quantity);
        db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, variant.id);
        console.log(`[Inventory] Deducted ${item.quantity} units for ${item.product_name} (${size}). New stock: ${newStock}`);
      }
    }

    db.prepare('UPDATE orders SET stock_deducted = 1 WHERE id = ?').run(orderId);
    db.exec('COMMIT');
    return true;
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(`[Inventory Error] Stock deduction failed for order ${orderId}:`, err.message);
    throw err;
  }
}

function restockReturnItems(returnId) {
  const db = getDb();
  const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(returnId);
  if (!ret) throw new Error(`Return ${returnId} not found.`);

  if (ret.product_id) {
    const size = ret.size || 'M';
    let variant = db.prepare(`
      SELECT id, stock FROM product_variants 
      WHERE product_id = ? AND size = ?
      LIMIT 1
    `).get(ret.product_id, size);

    if (variant) {
      const newStock = variant.stock + (ret.quantity || 1);
      db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, variant.id);
      console.log(`[Inventory] Restocked ${ret.quantity || 1} units of ${ret.product_name} (${size}). New stock: ${newStock}`);
      return newStock;
    }
  }
  return null;
}

// ============================================================================
// WISHLIST / SAVE FOR LATER
// ============================================================================

function getUserWishlist(userId = 'user_akhil') {
  const db = getDb();
  const rows = db.prepare(`
    SELECT w.id as wishlist_id, w.created_at as saved_at, p.*
    FROM wishlist w
    JOIN products p ON w.product_id = p.id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(userId);

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

    const totalStock = variants.reduce((acc, curr) => acc + curr.stock, 0);

    return {
      ...r,
      features: typeof r.features === 'string' ? JSON.parse(r.features) : (r.features || []),
      featured: Boolean(r.featured),
      total_stock: totalStock,
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

function isInWishlist(userId = 'user_akhil', productId) {
  if (!productId) return false;
  const db = getDb();
  const row = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(userId, productId);
  return Boolean(row);
}

function toggleWishlist(userId = 'user_akhil', productId) {
  if (!productId) throw new Error('Product ID is required.');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(userId, productId);

  if (existing) {
    db.prepare('DELETE FROM wishlist WHERE id = ?').run(existing.id);
    return { in_wishlist: false, product_id: productId };
  } else {
    // Verify product exists
    const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!prod) throw new Error(`Product ${productId} does not exist in catalog.`);

    db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)').run(userId, productId);
    return { in_wishlist: true, product_id: productId };
  }
}

function removeFromWishlist(userId = 'user_akhil', productId) {
  const db = getDb();
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(userId, productId);
  return { success: true, product_id: productId };
}

// ============================================================================
// IN-APP NOTIFICATIONS
// ============================================================================

function createNotification(userId = 'user_akhil', { order_id = null, type, title, message }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO notifications (user_id, order_id, type, title, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
  `);
  stmt.run(userId, order_id, type, title, message);

  return db.prepare('SELECT * FROM notifications WHERE rowid = last_insert_rowid()').get();
}

function getUserNotifications(userId = 'user_akhil', limit = 25) {
  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(userId, limit);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(userId).count;

  return {
    notifications,
    unread_count: unreadCount
  };
}

function markNotificationRead(notificationId, userId = 'user_akhil') {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
  return getUserNotifications(userId);
}

function markAllNotificationsRead(userId = 'user_akhil') {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  return getUserNotifications(userId);
}

// ============================================================================
// RETURNS & REFUNDS MANAGEMENT
// ============================================================================

function createReturnRequest(data) {
  const db = getDb();
  const { order_id, user_id = 'user_akhil', product_id, product_name, size, color, quantity = 1, reason, description } = data;

  if (!order_id || !reason) {
    throw new Error('order_id and reason are required for return request.');
  }

  const order = getOrderById(order_id);
  if (!order) {
    throw new Error(`Order ${order_id} not found.`);
  }

  // Ensure order is paid or delivered
  if (!['PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST'].includes(order.status)) {
    throw new Error(`Cannot request return on an order with status: ${order.status}`);
  }

  const returnId = 'RET-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

  // If item details not specified, infer from first order item
  const item = order.items && order.items[0];
  const prodId = product_id || item?.product_id || 'unknown';
  const prodName = product_name || item?.product_name || 'Technical Jacket';
  const sz = size || item?.size || 'M';
  const col = color || item?.color || 'Standard';

  db.prepare(`
    INSERT INTO returns (
      id, order_id, user_id, product_id, product_name, size, color, quantity, reason, description, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED')
  `).run(
    returnId,
    order.id,
    user_id,
    prodId,
    prodName,
    sz,
    col,
    quantity,
    reason,
    description || ''
  );

  createNotification(user_id, {
    order_id: order.id,
    type: 'RETURN_REQUESTED',
    title: 'Return Request Registered',
    message: `Your return request ${returnId} for "${prodName}" (Order ${order.id}) is being reviewed by our team.`
  });

  return getReturnById(returnId);
}

function getReturnById(returnId) {
  const db = getDb();
  return db.prepare('SELECT * FROM returns WHERE id = ?').get(returnId) || null;
}

function getUserReturns(userId = 'user_akhil') {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, o.total_amount, o.charged_amount, o.charged_currency, o.payment_id
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);
}

function getAllReturns() {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, o.customer_name, o.customer_email, o.total_amount, o.charged_amount, o.charged_currency, o.payment_id
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    ORDER BY r.created_at DESC
  `).all();
}

function updateReturnStatus(returnId, status, adminNotes = '') {
  const db = getDb();
  const existing = getReturnById(returnId);
  if (!existing) throw new Error(`Return ${returnId} not found.`);

  db.prepare(`
    UPDATE returns 
    SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, adminNotes || null, returnId);

  // If received, automatically restock inventory
  if (status === 'RECEIVED') {
    restockReturnItems(returnId);
    createNotification(existing.user_id, {
      order_id: existing.order_id,
      type: 'RETURN_RECEIVED',
      title: 'Return Package Received',
      message: `Your returned package for ${existing.product_name} has arrived at our logistics facility and passed inspection.`
    });
  } else if (status === 'APPROVED') {
    createNotification(existing.user_id, {
      order_id: existing.order_id,
      type: 'RETURN_APPROVED',
      title: 'Return Request Approved',
      message: `Return ${returnId} for ${existing.product_name} has been approved. Please follow return shipping instructions.`
    });
  } else if (status === 'REJECTED') {
    createNotification(existing.user_id, {
      order_id: existing.order_id,
      type: 'RETURN_REJECTED',
      title: 'Return Request Declined',
      message: `Return ${returnId} was not approved: ${adminNotes || 'Does not meet warranty criteria.'}`
    });
  }

  return getReturnById(returnId);
}

function createRefundRecord(data) {
  const db = getDb();
  const {
    return_id = null,
    order_id,
    user_id = 'user_akhil',
    payment_id = null,
    paypal_refund_id = null,
    capture_id = null,
    amount,
    currency = 'USD',
    inr_amount,
    reason = 'Customer return refund',
    status = 'COMPLETED',
    error_message = null
  } = data;

  const refundId = 'REF-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

  db.prepare(`
    INSERT INTO refunds (
      id, return_id, order_id, user_id, payment_id, paypal_refund_id, capture_id,
      amount, currency, inr_amount, reason, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    refundId,
    return_id,
    order_id,
    user_id,
    payment_id,
    paypal_refund_id,
    capture_id,
    amount,
    currency,
    inr_amount,
    reason,
    status,
    error_message
  );

  // If linked to return, update return status to REFUNDED
  if (return_id) {
    db.prepare("UPDATE returns SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(return_id);
  }

  // Create notification
  createNotification(user_id, {
    order_id,
    type: 'REFUND_ISSUED',
    title: 'Refund Successfully Processed',
    message: `A refund of $${Number(amount).toFixed(2)} USD (₹${inr_amount}) has been credited back to your original payment method for Order ${order_id}.`
  });

  return db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
}

function getOrderRefunds(orderId) {
  const db = getDb();
  return db.prepare('SELECT * FROM refunds WHERE order_id = ?').all(orderId);
}

// ============================================================================
// ADMIN PRODUCT & INVENTORY MANAGEMENT
// ============================================================================

function adminGetAllProducts() {
  return getAllProducts({}, true);
}

function adminCreateProduct(data) {
  const db = getDb();
  const id = data.id || ('jacket-' + Date.now().toString(36));
  const name = data.name.trim();
  const category = data.category || 'Technical Windbreakers';
  const style = data.style || category;
  const price = Number(data.price);
  const original_price = data.original_price ? Number(data.original_price) : null;
  const material = data.material || 'Technical Ripstop Nylon';
  const features = JSON.stringify(Array.isArray(data.features) ? data.features : [data.features || 'Waterproof outer shell']);
  const description = data.description || 'Premium technical outerwear.';
  const image = data.image || 'assets/images/jackets/cyber-shell-black.png';

  db.prepare(`
    INSERT INTO products (
      id, name, category, style, price, original_price, material,
      features, description, image, rating, reviews_count, stock_status,
      waterproof_rating, breathability, weight, fit, featured, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, name, category, style, price, original_price, material,
    features, description, image, data.rating || 4.5, data.reviews_count || 0,
    data.stock_status || 'In Stock', data.waterproof_rating || '15,000mm',
    data.breathability || '10,000g/m²', data.weight || '420g', data.fit || 'Modern Athletic',
    data.featured ? 1 : 0
  );

  // Add default variants
  const sizes = ['S', 'M', 'L', 'XL'];
  const insertVariant = db.prepare(`
    INSERT INTO product_variants (product_id, size, color_name, color_hex, stock)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const s of sizes) {
    insertVariant.run(id, s, 'Stealth Black', '#18181b', 10);
  }

  return getProductById(id);
}

function adminUpdateProduct(id, data) {
  const db = getDb();
  const existing = getProductById(id);
  if (!existing) throw new Error(`Product ${id} not found.`);

  const name = data.name !== undefined ? data.name.trim() : existing.name;
  const category = data.category !== undefined ? data.category.trim() : existing.category;
  const price = data.price !== undefined ? Number(data.price) : existing.price;
  const original_price = data.original_price !== undefined ? (data.original_price ? Number(data.original_price) : null) : existing.original_price;
  const description = data.description !== undefined ? data.description.trim() : existing.description;
  const material = data.material !== undefined ? data.material.trim() : existing.material;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;

  db.prepare(`
    UPDATE products 
    SET name = ?, category = ?, price = ?, original_price = ?,
        description = ?, material = ?, is_active = ?
    WHERE id = ?
  `).run(name, category, price, original_price, description, material, is_active ? 1 : 0, id);

  return getProductById(id);
}

function adminToggleProductActive(id) {
  const db = getDb();
  const prod = getProductById(id);
  if (!prod) throw new Error(`Product ${id} not found.`);
  const newStatus = prod.is_active ? 0 : 1;
  db.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(newStatus, id);
  return { id, is_active: Boolean(newStatus) };
}

function adminUpdateVariantStock(variantId, newStock) {
  const db = getDb();
  const stockNum = Math.max(0, parseInt(newStock, 10) || 0);
  db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(stockNum, variantId);
  return db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
}

function adminGetDashboardStats() {
  const db = getDb();
  
  // Total Revenue (USD & INR)
  const revInr = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM orders 
    WHERE status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST')
  `).get().total;

  const revUsd = db.prepare(`
    SELECT COALESCE(SUM(charged_amount), 0) as total FROM orders 
    WHERE status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST')
  `).get().total;

  const refInr = db.prepare("SELECT COALESCE(SUM(inr_amount), 0) as total FROM refunds WHERE status = 'COMPLETED'").get().total;
  const refUsd = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE status = 'COMPLETED'").get().total;

  const netRevInr = Math.max(0, revInr - refInr);
  const netRevUsd = Math.max(0, Number((revUsd - refUsd).toFixed(2)));

  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('PAID', 'PROCESSING')").get().c;
  const pendingReturns = db.prepare("SELECT COUNT(*) as c FROM returns WHERE status = 'REQUESTED'").get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products').get().c;

  // Low stock variants (stock < 5)
  const lowStockVariants = db.prepare(`
    SELECT v.id, v.product_id, v.size, v.color_name, v.stock, p.name as product_name, p.image
    FROM product_variants v
    JOIN products p ON v.product_id = p.id
    WHERE v.stock < 5
    ORDER BY v.stock ASC
  `).all();

  return {
    net_revenue_inr: netRevInr,
    net_revenue_usd: netRevUsd,
    total_orders: totalOrders,
    pending_orders: pendingOrders,
    pending_returns: pendingReturns,
    total_products: totalProducts,
    low_stock_count: lowStockVariants.length,
    low_stock_items: lowStockVariants
  };
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
  TRACKING_STAGES,
  // Auth & Sessions
  ensureAdminAccount,
  verifyAdminCredentials,
  createAdminSession,
  validateAdminSession,
  deleteAdminSession,
  // Inventory
  checkOrderStockAvailable,
  deductOrderStock,
  restockReturnItems,
  // Wishlist
  getUserWishlist,
  isInWishlist,
  toggleWishlist,
  removeFromWishlist,
  // Notifications
  createNotification,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  // Returns & Refunds
  createReturnRequest,
  getReturnById,
  getUserReturns,
  getAllReturns,
  updateReturnStatus,
  createRefundRecord,
  getOrderRefunds,
  // Admin Management
  adminGetAllProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminToggleProductActive,
  adminUpdateVariantStock,
  adminGetDashboardStats
};
