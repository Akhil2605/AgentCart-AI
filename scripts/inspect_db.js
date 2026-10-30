const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'agentcart.sqlite');
const db = new DatabaseSync(dbPath);

const itemCount = db.prepare("SELECT count(*) as count FROM order_items").get();
console.log('Total order items:', itemCount);

const sampleOrderWithItems = db.prepare(`
  SELECT o.id, o.status, o.total_amount, count(i.id) as item_count 
  FROM orders o 
  LEFT JOIN order_items i ON o.id = i.order_id 
  GROUP BY o.id 
  LIMIT 5
`).all();
console.log('Sample orders with item counts:', sampleOrderWithItems);

const itemWithProduct = db.prepare(`
  SELECT i.*, p.image 
  FROM order_items i 
  LEFT JOIN products p ON i.product_id = p.id 
  LIMIT 3
`).all();
console.log('Sample item joined with products:', itemWithProduct);
