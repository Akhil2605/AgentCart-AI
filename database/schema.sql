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
  is_active INTEGER DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  shipping_address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'India',
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'user_akhil',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  phone TEXT,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  charged_amount REAL,
  charged_currency TEXT DEFAULT 'USD',
  exchange_rate REAL DEFAULT 85.0,
  estimated_delivery TEXT,
  actual_delivery_date TEXT,
  status TEXT DEFAULT 'PENDING', -- PENDING, PAID, PROCESSING, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, FAILED, PAID_DEMO_TEST
  payment_provider TEXT DEFAULT 'PAYPAL_SANDBOX',
  provider_order_id TEXT,
  payment_id TEXT,
  stock_deducted INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(id)
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

CREATE TABLE IF NOT EXISTS order_tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  stage_number INTEGER NOT NULL, -- 1: Order Placed, 2: Payment Confirmed, 3: Order Processing, 4: Shipped, 5: Out for Delivery, 6: Delivered
  stage_name TEXT NOT NULL,
  status_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider_order_id TEXT,
  transaction_id TEXT,
  payment_method TEXT DEFAULT 'PayPal Sandbox',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  inr_amount INTEGER,
  exchange_rate REAL DEFAULT 85.0,
  status TEXT NOT NULL, -- PENDING, SUCCESS, FAILED, CANCELLED
  payer_email TEXT,
  debug_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================================
-- 1. WISHLIST / SAVE FOR LATER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. ADMIN ACCOUNTS & SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  order_id TEXT,
  type TEXT NOT NULL, -- ORDER_PLACED, PAYMENT_SUCCESS, PAYMENT_FAILED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, RETURN_REQUESTED, RETURN_APPROVED, RETURN_REJECTED, RETURN_RECEIVED, REFUND_ISSUED
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. RETURNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  size TEXT,
  color TEXT,
  quantity INTEGER DEFAULT 1,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'REQUESTED', -- REQUESTED, APPROVED, REJECTED, RECEIVED, REFUNDED
  admin_notes TEXT,
  days_elapsed INTEGER DEFAULT 0,
  deduction_fee_inr INTEGER DEFAULT 0,
  deduction_fee_usd REAL DEFAULT 0.0,
  deduction_rate REAL DEFAULT 0.0,
  refund_amount_inr INTEGER,
  refund_amount_usd REAL,
  policy_tier TEXT DEFAULT 'IMMEDIATE_FULL', -- IMMEDIATE_FULL, LATE_RESTOCKING_FEE, EXTENDED_RESTOCKING_FEE
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. REFUNDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  return_id TEXT,
  order_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  payment_id TEXT,
  paypal_refund_id TEXT,
  capture_id TEXT,
  amount REAL NOT NULL, -- USD amount refunded
  currency TEXT DEFAULT 'USD',
  inr_amount INTEGER NOT NULL, -- INR reference amount
  reason TEXT,
  status TEXT DEFAULT 'COMPLETED', -- PENDING, COMPLETED, FAILED
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);
