-- AgentCart AI SQLite Database Schema
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  style TEXT NOT NULL,
  price INTEGER NOT NULL,
  original_price INTEGER,
  material TEXT NOT NULL,
  features TEXT NOT NULL, -- JSON array string
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  rating REAL DEFAULT 4.5,
  reviews_count INTEGER DEFAULT 0,
  stock_status TEXT DEFAULT 'In Stock',
  waterproof_rating TEXT,
  breathability TEXT,
  weight TEXT,
  fit TEXT,
  featured INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  size TEXT NOT NULL,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  stock INTEGER DEFAULT 10,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  charged_amount REAL,
  charged_currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'PENDING', -- PENDING, PAID, CANCELLED, FAILED
  payment_provider TEXT DEFAULT 'PAYPAL_SANDBOX',
  provider_order_id TEXT,
  payment_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
