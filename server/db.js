const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'agentcart.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const CATALOG_PATH = path.join(__dirname, '..', 'data', 'catalog.json');

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
    seedIfEmpty();
  }
  return dbInstance;
}

function initTables() {
  return getDb();
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

function createOrder(orderData, items) {
  const db = getDb();
  
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, customer_name, customer_email, shipping_address,
      city, state, postal_code, phone, subtotal, delivery_fee,
      total_amount, currency, status, payment_provider, provider_order_id
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
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
    orderData.customer_name,
    orderData.customer_email,
    orderData.shipping_address,
    orderData.city,
    orderData.state,
    orderData.postal_code,
    orderData.phone || '',
    orderData.subtotal,
    orderData.delivery_fee,
    orderData.total_amount,
    orderData.currency || 'INR',
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

  return getOrderById(orderData.id);
}

function updateOrderStatus(orderId, status, paymentId = null) {
  const db = getDb();
  const existing = getOrderById(orderId);
  if (!existing) {
    throw new Error(`Order ${orderId} not found.`);
  }
  const stmt = db.prepare(`
    UPDATE orders 
    SET status = ?, payment_id = COALESCE(?, payment_id), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(status, paymentId, existing.id);
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

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return {
    ...order,
    items
  };
}

function getOrderByProviderOrderId(providerOrderId) {
  if (!providerOrderId) return null;
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE provider_order_id = ?').get(providerOrderId);
  if (!order) return null;

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return {
    ...order,
    items
  };
}

module.exports = {
  getDb,
  initTables,
  getAllProducts,
  getProductById,
  createOrder,
  updateOrderStatus,
  getOrderById,
  getOrderByProviderOrderId
};
