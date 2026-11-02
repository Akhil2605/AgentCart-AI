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

    // Schema migrations for returns table (tiered fee deductions)
    try {
      const pragmaReturns = dbInstance.prepare("PRAGMA table_info(returns)").all();
      const retCols = pragmaReturns.map(c => c.name);
      if (!retCols.includes('days_elapsed')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN days_elapsed INTEGER DEFAULT 0;");
      }
      if (!retCols.includes('deduction_fee_inr')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN deduction_fee_inr INTEGER DEFAULT 0;");
      }
      if (!retCols.includes('deduction_fee_usd')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN deduction_fee_usd REAL DEFAULT 0.0;");
      }
      if (!retCols.includes('deduction_rate')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN deduction_rate REAL DEFAULT 0.0;");
      }
      if (!retCols.includes('refund_amount_inr')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN refund_amount_inr INTEGER;");
      }
      if (!retCols.includes('refund_amount_usd')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN refund_amount_usd REAL;");
      }
      if (!retCols.includes('policy_tier')) {
        dbInstance.exec("ALTER TABLE returns ADD COLUMN policy_tier TEXT DEFAULT 'IMMEDIATE_FULL';");
      }
    } catch (e) {
      console.error('Error running returns migrations:', e.message);
    }

    // Ensure wallet_transactions table exists with UNIQUE(return_id) constraint
    try {
      dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('CREDIT', 'DEBIT')),
          source TEXT NOT NULL CHECK(source IN ('RETURN_REFUND', 'ORDER_PAYMENT', 'ADMIN_ADJUSTMENT')),
          amount_inr INTEGER NOT NULL,
          amount_usd REAL NOT NULL,
          balance_after_inr INTEGER NOT NULL,
          balance_after_usd REAL NOT NULL,
          return_id TEXT UNIQUE,
          order_id TEXT NOT NULL,
          reference TEXT UNIQUE NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (return_id) REFERENCES returns(id) ON DELETE SET NULL
        );
      `);
    } catch (e) {
      console.error('Error running wallet_transactions migration:', e.message);
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

function resetCatalogInventory() {
  const db = getDb();
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  const updateVariant = db.prepare(`
    UPDATE product_variants 
    SET stock = ? 
    WHERE product_id = ? AND size = ? AND color_name = ?
  `);
  
  db.exec('BEGIN TRANSACTION');
  try {
    for (const p of catalog) {
      for (const sizeObj of p.sizes) {
        for (const col of p.colors) {
          updateVariant.run(sizeObj.stock, p.id, sizeObj.size, col.name);
        }
      }
    }
    db.prepare('UPDATE products SET is_active = 1').run();
    db.exec('COMMIT');
    console.log('[SQLite] All 24 catalog jacket inventory stocks and active statuses reset to catalog baseline.');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('Error resetting catalog inventory:', err.message);
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

function getWalletBalance(userId = 'user_akhil') {
  const db = getDb();
  const lastTx = db.prepare(`
    SELECT balance_after_inr, balance_after_usd 
    FROM wallet_transactions 
    WHERE user_id = ? 
    ORDER BY created_at DESC, id DESC 
    LIMIT 1
  `).get(userId);

  if (lastTx) {
    return {
      balance_inr: Number(lastTx.balance_after_inr) || 0,
      balance_usd: Number(lastTx.balance_after_usd) || 0.0
    };
  }
  return {
    balance_inr: 0,
    balance_usd: 0.0
  };
}

function getWalletTransactions(userId = 'user_akhil') {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM wallet_transactions 
    WHERE user_id = ? 
    ORDER BY created_at DESC, id DESC
  `).all(userId);
}

function getUserStats(userId = 'user_akhil') {
  const db = getDb();
  
  // Total orders in user view (excluding returned / refunded orders)
  const totalOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ?
      AND status NOT IN ('RETURNED', 'REFUNDED')
      AND id NOT IN (SELECT order_id FROM returns WHERE status IN ('APPROVED', 'RECEIVED', 'REFUNDED'))
  `).get(userId).count;

  // Active orders (PENDING, PAID, PROCESSING, SHIPPED, OUT_FOR_DELIVERY) - excluding returned
  const activeOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ? 
      AND status IN ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY')
      AND status NOT IN ('RETURNED', 'REFUNDED', 'CANCELLED')
      AND id NOT IN (SELECT order_id FROM returns WHERE status IN ('APPROVED', 'RECEIVED', 'REFUNDED'))
  `).get(userId).count;

  // Delivered orders (excluding returned)
  const deliveredOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ? 
      AND status = 'DELIVERED'
      AND id NOT IN (SELECT order_id FROM returns WHERE status IN ('APPROVED', 'RECEIVED', 'REFUNDED'))
  `).get(userId).count;

  // Cancelled orders
  const cancelledOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE user_id = ? AND status = 'CANCELLED'
  `).get(userId).count;

  // Base total spent in INR (for PAID / DELIVERED / active paid / returned orders)
  const spentInr = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM orders 
    WHERE user_id = ? AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST', 'RETURNED')
  `).get(userId).total;

  // Base total spent in USD
  const spentUsd = db.prepare(`
    SELECT COALESCE(SUM(charged_amount), 0) as total FROM orders 
    WHERE user_id = ? AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAID_DEMO_TEST', 'RETURNED')
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

  // Authoritative wallet balance derived directly from wallet_transactions ledger
  const walletBal = getWalletBalance(userId);
  const walletBalanceInr = walletBal.balance_inr;
  const walletBalanceUsd = walletBal.balance_usd;

  const netSpentInr = Math.max(0, Number(spentInr || 0) - walletBalanceInr);
  const netSpentUsd = netSpentInr === 0 ? 0 : Math.max(0, Number((Number(spentUsd || (netSpentInr / 85)) - walletBalanceUsd).toFixed(2)));

  // Wishlist count
  const wishlistCount = db.prepare('SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?').get(userId).count;

  // Returns count
  const returnsCount = db.prepare('SELECT COUNT(*) as count FROM returns WHERE user_id = ?').get(userId).count;

  // Recent activity (exclude returned orders from customer activity)
  const recentOrders = db.prepare(`
    SELECT id, total_amount, currency, charged_amount, charged_currency, status, created_at, updated_at
    FROM orders 
    WHERE user_id = ? 
      AND status NOT IN ('RETURNED', 'REFUNDED')
      AND id NOT IN (SELECT order_id FROM returns WHERE status IN ('APPROVED', 'RECEIVED', 'REFUNDED'))
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
    wallet_balance_inr: walletBalanceInr,
    wallet_balance_usd: walletBalanceUsd,
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
  let query = `
    SELECT * FROM orders 
    WHERE user_id = ?
      AND status NOT IN ('RETURNED', 'REFUNDED')
      AND id NOT IN (SELECT order_id FROM returns WHERE status IN ('APPROVED', 'RECEIVED', 'REFUNDED'))
  `;
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
  const db = getDb();
  const order = getOrderById(orderId);
  if (!order) return null;

  const completedEvents = order.tracking_events || [];
  const completedStageMap = new Map();
  for (const ev of completedEvents) {
    completedStageMap.set(ev.stage_number, ev);
  }

  // Look up returns, refunds, and wallet transactions for this order
  const returnRec = db.prepare(`
    SELECT * FROM returns WHERE order_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(orderId);

  const refundRec = db.prepare(`
    SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(orderId);

  const walletTx = db.prepare(`
    SELECT * FROM wallet_transactions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(orderId);

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

  let return_info = null;
  if (returnRec) {
    return_info = {
      id: returnRec.id,
      order_id: returnRec.order_id,
      status: returnRec.status,
      product_name: returnRec.product_name,
      reason: returnRec.reason,
      description: returnRec.description,
      admin_notes: returnRec.admin_notes,
      refund_amount_inr: returnRec.refund_amount_inr || order.total_amount,
      refund_amount_usd: returnRec.refund_amount_usd || order.charged_amount,
      deduction_fee_inr: returnRec.deduction_fee_inr || 0,
      deduction_fee_usd: returnRec.deduction_fee_usd || 0.0,
      policy_tier: returnRec.policy_tier || 'IMMEDIATE_FULL',
      created_at: returnRec.created_at,
      updated_at: returnRec.updated_at
    };

    timeline.push({
      stage_number: 7,
      stage_name: 'Return Requested',
      status_code: 'RETURN_REQUESTED',
      title: 'Return Request Registered',
      description: `Return ${returnRec.id} filed for ${returnRec.product_name}. Reason: ${returnRec.reason}.`,
      location: 'AgentCart Online Showroom',
      completed: true,
      completed_at: returnRec.created_at
    });
  }

  let refund_info = null;
  const isApprovedReturn = returnRec && ['APPROVED', 'RECEIVED', 'REFUNDED'].includes(returnRec.status);
  if (refundRec || walletTx || isApprovedReturn) {
    const isWallet = !!walletTx || (refundRec && (refundRec.payment_id === 'STORE_WALLET' || (refundRec.reason && refundRec.reason.includes('Store Wallet')))) || (!refundRec?.paypal_refund_id);
    const destination = isWallet ? 'AgentCart Store Wallet' : (refundRec?.paypal_refund_id ? 'PayPal Sandbox' : 'AgentCart Store Wallet');
    const amountInr = returnRec?.refund_amount_inr || refundRec?.inr_amount || walletTx?.amount_inr || order.total_amount;
    const amountUsd = returnRec?.refund_amount_usd ? Number(returnRec.refund_amount_usd) : (refundRec?.amount ? Number(refundRec.amount) : (walletTx?.amount_usd ? Number(walletTx.amount_usd) : Number((amountInr / 85).toFixed(2))));
    const completedAt = walletTx?.created_at || refundRec?.created_at || returnRec?.updated_at || order.updated_at;

    refund_info = {
      id: refundRec ? refundRec.id : (walletTx ? walletTx.id : 'REF-INTERNAL'),
      return_id: returnRec ? returnRec.id : (refundRec ? refundRec.return_id : null),
      order_id: orderId,
      status: refundRec ? refundRec.status : 'COMPLETED',
      amount_inr: amountInr,
      amount_usd: amountUsd,
      destination,
      reference: walletTx?.reference || refundRec?.paypal_refund_id || refundRec?.id || 'WTX-INTERNAL',
      completed_at: completedAt
    };

    const stage8Ev = completedStageMap.get(8);
    timeline.push({
      stage_number: 8,
      stage_name: 'Return Approved & Refunded',
      status_code: 'RETURN_REFUNDED',
      title: 'Return Approved — Refund Credited to Store Wallet',
      description: stage8Ev ? stage8Ev.description : `Refund of ₹${amountInr} ($${amountUsd} USD) credited to ${destination}.`,
      location: stage8Ev ? stage8Ev.location : 'AgentCart Store Wallet Engine',
      completed: true,
      completed_at: stage8Ev ? stage8Ev.completed_at : completedAt
    });
  }

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
    payment: order.payment,
    return_info,
    refund_info
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

    let variant = null;
    if (it.color) {
      variant = db.prepare(`
        SELECT * FROM product_variants 
        WHERE product_id = ? AND size = ? AND (color_name = ? OR color_name LIKE ?)
        LIMIT 1
      `).get(it.id, size, it.color, `%${it.color}%`);
    }

    if (variant) {
      if (variant.stock < qty) {
        throw new Error(`Insufficient inventory: "${prod.name}" (Size ${size}, Color: ${variant.color_name}) only has ${variant.stock} units available (requested ${qty}).`);
      }
    } else {
      const variantsForSize = db.prepare(`
        SELECT * FROM product_variants 
        WHERE product_id = ? AND size = ?
      `).all(it.id, size);

      const totalStock = variantsForSize.reduce((acc, curr) => acc + curr.stock, 0);
      if (variantsForSize.length === 0 || totalStock < qty) {
        throw new Error(`Insufficient inventory: "${prod.name}" (Size ${size}) only has ${totalStock} units available (requested ${qty}).`);
      }
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
      let variant = null;
      if (item.color) {
        variant = db.prepare(`
          SELECT id, stock, color_name FROM product_variants 
          WHERE product_id = ? AND size = ? AND (color_name = ? OR color_name LIKE ?)
          LIMIT 1
        `).get(item.product_id, size, item.color, `%${item.color}%`);
      }

      if (!variant || variant.stock < item.quantity) {
        // Fallback to variant with sufficient stock
        variant = db.prepare(`
          SELECT id, stock, color_name FROM product_variants 
          WHERE product_id = ? AND size = ? AND stock >= ?
          LIMIT 1
        `).get(item.product_id, size, item.quantity);

        if (!variant) {
          variant = db.prepare(`
            SELECT id, stock, color_name FROM product_variants 
            WHERE product_id = ? AND size = ?
            LIMIT 1
          `).get(item.product_id, size);
        }
      }

      if (variant) {
        const newStock = Math.max(0, variant.stock - item.quantity);
        db.prepare('UPDATE product_variants SET stock = ? WHERE id = ?').run(newStock, variant.id);
        console.log(`[Inventory] Deducted ${item.quantity} units for ${item.product_name} (${size}, ${variant.color_name}). New stock: ${newStock}`);
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

/**
 * Dynamic Time-Based Return Policy Engine
 * - Immediate (0-2 days): 100% full refund (0% restocking fee cut)
 * - Few days later (3-7 days): 15% restocking & handling fee cut (85% net refund)
 * - Extended (8+ days): 25% extended handling fee cut (75% net refund)
 */
function calculateReturnRefundBreakdown(orderCreatedAt, orderTotalInr, orderTotalUsd, exchangeRate = 85.0, simulatedDays = null) {
  let daysElapsed = 0;
  if (simulatedDays !== null && simulatedDays !== undefined && !isNaN(Number(simulatedDays))) {
    daysElapsed = Math.max(0, Number(simulatedDays));
  } else if (orderCreatedAt) {
    const dateStr = String(orderCreatedAt).trim();
    const orderDate = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - orderDate.getTime());
    daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  let deductionRate = 0.0;
  let policyTier = 'IMMEDIATE_FULL';
  let tierLabel = 'Immediate Return Guarantee (0-2 days): 100% Full Refund';

  if (daysElapsed > 7) {
    deductionRate = 0.25;
    policyTier = 'EXTENDED_RESTOCKING_FEE';
    tierLabel = `Extended Return Fee (${daysElapsed} days elapsed): 25% Fee Cut`;
  } else if (daysElapsed > 2) {
    deductionRate = 0.15;
    policyTier = 'LATE_RESTOCKING_FEE';
    tierLabel = `Standard Return Handling Fee (${daysElapsed} days elapsed): 15% Restocking Fee Cut`;
  }

  const grossInr = Number(orderTotalInr || 0);
  const grossUsd = Number(orderTotalUsd || (grossInr / exchangeRate));

  const deductionInr = Math.round(grossInr * deductionRate);
  const deductionUsd = Number((grossUsd * deductionRate).toFixed(2));

  const netRefundInr = Math.max(0, grossInr - deductionInr);
  const netRefundUsd = Math.max(0, Number((grossUsd - deductionUsd).toFixed(2)));

  return {
    days_elapsed: daysElapsed,
    deduction_rate: deductionRate,
    policy_tier: policyTier,
    tier_label: tierLabel,
    gross_inr: grossInr,
    gross_usd: grossUsd,
    deduction_fee_inr: deductionInr,
    deduction_fee_usd: deductionUsd,
    refund_amount_inr: netRefundInr,
    refund_amount_usd: netRefundUsd
  };
}

function createReturnRequest(data) {
  const db = getDb();
  const {
    order_id,
    user_id = 'user_akhil',
    product_id,
    product_name,
    size,
    color,
    quantity = 1,
    reason,
    description,
    days_elapsed = null
  } = data;

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

  const breakdown = calculateReturnRefundBreakdown(
    order.created_at,
    order.total_amount,
    order.charged_amount,
    order.exchange_rate || 85.0,
    days_elapsed
  );

  const returnId = 'RET-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

  // If item details not specified, infer from first order item
  const item = order.items && order.items[0];
  const prodId = product_id || item?.product_id || 'unknown';
  const prodName = product_name || item?.product_name || 'Technical Jacket';
  const sz = size || item?.size || 'M';
  const col = color || item?.color || 'Standard';

  db.prepare(`
    INSERT INTO returns (
      id, order_id, user_id, product_id, product_name, size, color, quantity,
      reason, description, status,
      days_elapsed, deduction_fee_inr, deduction_fee_usd, deduction_rate,
      refund_amount_inr, refund_amount_usd, policy_tier
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?, ?, ?)
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
    description || '',
    breakdown.days_elapsed,
    breakdown.deduction_fee_inr,
    breakdown.deduction_fee_usd,
    breakdown.deduction_rate,
    breakdown.refund_amount_inr,
    breakdown.refund_amount_usd,
    breakdown.policy_tier
  );

  const deductionMsg = breakdown.deduction_fee_inr > 0
    ? ` ${Math.round(breakdown.deduction_rate * 100)}% restocking fee (-₹${breakdown.deduction_fee_inr} / -$${breakdown.deduction_fee_usd} USD) deducted for return requested ${breakdown.days_elapsed} days after order. Net ₹${breakdown.refund_amount_inr} ($${breakdown.refund_amount_usd} USD) will be credited to wallet upon approval.`
    : ` Full 100% refund of ₹${breakdown.refund_amount_inr} ($${breakdown.refund_amount_usd} USD) will be credited to store wallet upon approval (Immediate Return Guarantee).`;

  createNotification(user_id, {
    order_id: order.id,
    type: 'RETURN_REQUESTED',
    title: 'Return Request Registered',
    message: `Your return request ${returnId} for "${prodName}" (Order ${order.id}) is being reviewed by our team. ${deductionMsg}`
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
    SELECT r.*, o.total_amount, o.charged_amount, o.charged_currency, o.payment_id, o.created_at as order_created_at,
           ref.id as refund_id, ref.status as refund_status, ref.amount as refund_usd, ref.inr_amount as refund_inr
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN refunds ref ON r.id = ref.return_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(userId);
}

function getAllReturns() {
  const db = getDb();
  return db.prepare(`
    SELECT r.*, o.customer_name, o.customer_email, o.total_amount, o.charged_amount, o.charged_currency, o.payment_id, o.created_at as order_created_at,
           ref.id as refund_id, ref.status as refund_status, ref.amount as refund_usd, ref.inr_amount as refund_inr
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN refunds ref ON r.id = ref.return_id
    ORDER BY r.created_at DESC
  `).all();
}

function creditWalletForReturn(returnId, adminNotes = '') {
  const db = getDb();
  const existing = getReturnById(returnId);
  if (!existing) throw new Error(`Return ${returnId} not found.`);

  // Deduplication check: A return can only generate one refund credit
  const existingTx = db.prepare('SELECT * FROM wallet_transactions WHERE return_id = ?').get(returnId);
  if (existingTx) {
    return {
      already_credited: true,
      return: getReturnById(returnId),
      transaction: existingTx,
      wallet: getWalletBalance(existing.user_id)
    };
  }

  const order = getOrderById(existing.order_id);
  const amountInr = existing.refund_amount_inr || (order ? order.total_amount : 2049);
  const amountUsd = existing.refund_amount_usd ? Number(existing.refund_amount_usd) : (order ? Number(order.charged_amount) : Number((amountInr / 85).toFixed(2)));

  const currentBal = getWalletBalance(existing.user_id);
  const newBalInr = currentBal.balance_inr + amountInr;
  const newBalUsd = Number((currentBal.balance_usd + amountUsd).toFixed(2));

  const txId = 'WTX-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
  const ref = 'REFUND-CREDIT-' + returnId;
  const desc = `Store wallet refund credit for return ${returnId} (Order: ${existing.order_id})`;

  // Atomic SQLite transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Insert into wallet_transactions
    db.prepare(`
      INSERT INTO wallet_transactions (
        id, user_id, type, source, amount_inr, amount_usd, balance_after_inr, balance_after_usd,
        return_id, order_id, reference, description
      ) VALUES (?, ?, 'CREDIT', 'RETURN_REFUND', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txId, existing.user_id, amountInr, amountUsd, newBalInr, newBalUsd,
      returnId, existing.order_id, ref, desc
    );

    // 2. Update return status to APPROVED
    db.prepare(`
      UPDATE returns 
      SET status = 'APPROVED', admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(adminNotes || null, returnId);

    // 3. Update order status to RETURNED
    db.prepare(`
      UPDATE orders 
      SET status = 'RETURNED', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(existing.order_id);

    // 4. Record refund in refunds table (destination: STORE_WALLET)
    const refundId = 'REF-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
    const existingRefund = db.prepare('SELECT id FROM refunds WHERE return_id = ?').get(returnId);
    if (!existingRefund) {
      db.prepare(`
        INSERT INTO refunds (
          id, return_id, order_id, user_id, payment_id,
          amount, currency, inr_amount, reason, status
        ) VALUES (?, ?, ?, ?, 'STORE_WALLET', ?, 'USD', ?, ?, 'COMPLETED')
      `).run(
        refundId, returnId, existing.order_id, existing.user_id,
        amountUsd, amountInr, 'Return Approved — Refund Credited to Store Wallet'
      );
    } else {
      db.prepare(`
        UPDATE refunds 
        SET status = 'COMPLETED', reason = 'Return Approved — Refund Credited to Store Wallet',
            amount = ?, inr_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(amountUsd, amountInr, existingRefund.id);
    }

    // 5. Insert stage 8 order tracking event
    const existingEv8 = db.prepare('SELECT id FROM order_tracking_events WHERE order_id = ? AND stage_number = 8').get(existing.order_id);
    if (!existingEv8) {
      db.prepare(`
        INSERT INTO order_tracking_events (
          order_id, stage_number, stage_name, status_code, title, description, location
        ) VALUES (?, 8, 'Return Approved & Refunded', 'RETURN_REFUNDED',
                  'Return Approved — Refund Credited to Store Wallet',
                  ?, 'AgentCart Store Wallet Engine')
      `).run(
        existing.order_id,
        `Refund of ₹${amountInr} ($${amountUsd} USD) credited to AgentCart Store Wallet for Return ${returnId}.`
      );
    }

    // 6. Create customer notification
    const feeMsg = existing.deduction_fee_inr > 0
      ? ` Net ₹${amountInr} ($${amountUsd} USD) has been credited to your store wallet (${Math.round((existing.deduction_rate || 0.15) * 100)}% fee of ₹${existing.deduction_fee_inr} deducted).`
      : ` Full ₹${amountInr} ($${amountUsd} USD) has been credited to your store wallet (100% immediate return).`;

    createNotification(existing.user_id, {
      order_id: existing.order_id,
      type: 'RETURN_APPROVED',
      title: 'Return Request Approved & Credited to Store Wallet',
      message: `Return ${returnId} for ${existing.product_name} has been approved.${feeMsg}`
    });

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return {
    already_credited: false,
    return: getReturnById(returnId),
    transaction: db.prepare('SELECT * FROM wallet_transactions WHERE id = ?').get(txId),
    wallet: getWalletBalance(existing.user_id)
  };
}

function updateReturnStatus(returnId, status, adminNotes = '') {
  const db = getDb();
  const existing = getReturnById(returnId);
  if (!existing) throw new Error(`Return ${returnId} not found.`);

  // If approved, execute atomic wallet credit & synchronization
  if (status === 'APPROVED') {
    const credRes = creditWalletForReturn(returnId, adminNotes);
    return credRes.return;
  }

  db.prepare(`
    UPDATE returns 
    SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, adminNotes || null, returnId);

  if (status === 'RECEIVED') {
    restockReturnItems(returnId);
    createNotification(existing.user_id, {
      order_id: existing.order_id,
      type: 'RETURN_RECEIVED',
      title: 'Return Package Received',
      message: `Your returned package for ${existing.product_name} has arrived at our logistics facility and passed inspection.`
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

  // Check if a refund record already exists for this return_id
  const existingRefund = return_id ? db.prepare('SELECT id FROM refunds WHERE return_id = ?').get(return_id) : null;
  if (existingRefund) {
    db.prepare(`
      UPDATE refunds SET
        paypal_refund_id = COALESCE(?, paypal_refund_id),
        capture_id = COALESCE(?, capture_id),
        amount = ?,
        currency = ?,
        inr_amount = ?,
        reason = ?,
        status = ?,
        error_message = ?
      WHERE id = ?
    `).run(paypal_refund_id, capture_id, amount, currency, inr_amount, reason, status, error_message, existingRefund.id);

    if (return_id) {
      db.prepare("UPDATE returns SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(return_id);
    }
    return db.prepare('SELECT * FROM refunds WHERE id = ?').get(existingRefund.id);
  }

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

function ensureSampleReturnOrder() {
  const db = getDb();
  const existingOrder = db.prepare('SELECT id FROM orders WHERE id = ?').get('ORD-MVY09K6S-8390');
  
  if (!existingOrder) {
    db.prepare(`
      INSERT INTO orders (
        id, user_id, customer_name, customer_email, phone,
        shipping_address, city, state, postal_code, country,
        subtotal, delivery_fee, total_amount, currency,
        charged_amount, charged_currency, exchange_rate,
        payment_provider, payment_id, provider_order_id,
        status, estimated_delivery, actual_delivery_date, stock_deducted,
        created_at, updated_at
      ) VALUES (
        'ORD-MVY09K6S-8390', 'user_akhil', 'Akhil', 'akhil@agentcart.ai', '+91 91234 56789',
        '402 Cyber Tech Residences, Indiranagar', 'Bengaluru', 'Karnataka', '560038', 'India',
        1899, 150, 2049, 'INR',
        24.10, 'USD', 85.0,
        'PAYPAL_SANDBOX', '2GG83902847192', '5C83902847192',
        'RETURNED', 'Wed, 4 Nov, 2026', 'Sun, 1 Nov, 2026', 1,
        '2026-11-01 10:30:00', '2026-11-01 11:15:00'
      )
    `).run();

    db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, size, color, unit_price, quantity, line_total
      ) VALUES (
        'ORD-MVY09K6S-8390', 'jacket-008',
        'Apex Signal Hi-Vis Shell', 'S', 'Blaze Orange', 1899, 1, 1899
      )
    `).run();

    db.prepare(`
      INSERT INTO payments (
        id, order_id, transaction_id, provider_order_id, amount, currency, inr_amount, exchange_rate, status,
        payment_method, created_at
      ) VALUES (
        'PAY-MVY09K6S-8390', 'ORD-MVY09K6S-8390', '2GG83902847192', '5C83902847192',
        24.10, 'USD', 2049, 85.0, 'SUCCESS',
        'PAYPAL_SANDBOX', '2026-11-01 10:30:00'
      )
    `).run();
  } else {
    // Ensure existing order is marked as RETURNED
    db.prepare(`
      UPDATE orders 
      SET status = 'RETURNED' 
      WHERE id = 'ORD-MVY09K6S-8390'
    `).run();
  }

  const existingReturn = db.prepare('SELECT id FROM returns WHERE id = ?').get('RET-MVY0CDLC-899');
  if (!existingReturn) {
    db.prepare(`
      INSERT INTO returns (
        id, order_id, user_id, product_id, product_name, size, color, quantity,
        reason, description, admin_notes, status,
        days_elapsed, deduction_fee_inr, deduction_fee_usd, deduction_rate,
        refund_amount_inr, refund_amount_usd, policy_tier,
        created_at, updated_at
      ) VALUES (
        'RET-MVY0CDLC-899', 'ORD-MVY09K6S-8390', 'user_akhil', 'jacket-008',
        'Apex Signal Hi-Vis Shell', 'S', 'Blaze Orange', 1,
        'Changed Mind', 'did not liked this product ',
        'Approved by admin for return inspection', 'APPROVED',
        0, 0, 0.0, 0.0,
        2049, 24.10, 'IMMEDIATE_FULL',
        '2026-11-01 11:00:00', '2026-11-01 11:15:00'
      )
    `).run();
  } else {
    db.prepare(`
      UPDATE returns 
      SET status = 'APPROVED',
          admin_notes = 'Approved by admin for return inspection',
          reason = 'Changed Mind',
          description = 'did not liked this product ',
          days_elapsed = 0,
          deduction_fee_inr = 0,
          deduction_fee_usd = 0.0,
          deduction_rate = 0.0,
          refund_amount_inr = 2049,
          refund_amount_usd = 24.10,
          policy_tier = 'IMMEDIATE_FULL'
      WHERE id = 'RET-MVY0CDLC-899'
    `).run();
  }

  // Ensure completed refund record exists
  const existingRefund = db.prepare('SELECT id FROM refunds WHERE return_id = ? OR order_id = ?').get('RET-MVY0CDLC-899', 'ORD-MVY09K6S-8390');
  if (!existingRefund) {
    db.prepare(`
      INSERT INTO refunds (
        id, return_id, order_id, user_id, payment_id, paypal_refund_id, capture_id,
        amount, currency, inr_amount, reason, status, created_at
      ) VALUES (
        'REF-MVY0CDLC-899', 'RET-MVY0CDLC-899', 'ORD-MVY09K6S-8390', 'user_akhil',
        'PAY-MVY09K6S-8390', 'WALLET_CREDIT_RET-MVY0CDLC-899', '2GG83902847192',
        24.10, 'USD', 2049, 'Return approved: credited to store wallet', 'COMPLETED',
        '2026-11-01 11:15:00'
      )
    `).run();
  } else {
    db.prepare(`
      UPDATE refunds
      SET status = 'COMPLETED',
          inr_amount = 2049,
          amount = 24.10,
          reason = 'Return approved: credited to store wallet'
      WHERE id = ?
    `).run(existingRefund.id);
  }
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
  resetCatalogInventory,
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
  calculateReturnRefundBreakdown,
  ensureSampleReturnOrder,
  // Wallet
  getWalletBalance,
  getWalletTransactions,
  creditWalletForReturn,
  // Admin Management
  adminGetAllProducts,
  adminCreateProduct,
  adminUpdateProduct,
  adminToggleProductActive,
  adminUpdateVariantStock,
  adminGetDashboardStats
};
