const db = require('../database/db');

console.log('Testing db.js functions...');

// 1. Profile
const profile = db.getUserProfile();
console.log('User Profile:', profile);
if (!profile || profile.name !== 'Akhil') {
  throw new Error('Default profile Akhil not loaded!');
}

// 2. Stats
const stats = db.getUserStats();
console.log('User Stats:', stats);

// 3. User Orders
const orders = db.getUserOrders('user_akhil', { limit: 3 });
console.log(`Fetched ${orders.length} user orders. First order:`, {
  id: orders[0]?.id,
  status: orders[0]?.status,
  items_count: orders[0]?.items?.length,
  tracking_events_count: orders[0]?.tracking_events?.length,
  payment_status: orders[0]?.payment?.status
});

// 4. Order Tracking
if (orders[0]) {
  const tracking = db.getOrderTracking(orders[0].id);
  console.log('Tracking timeline for order', orders[0].id, ':', tracking.timeline.map(t => `${t.stage_number}. ${t.stage_name} (completed: ${t.completed})`));
}

// 5. Payments
const payments = db.getPayments({ limit: 5 });
console.log(`Fetched ${payments.length} payment records. First payment:`, {
  id: payments[0]?.id,
  order_id: payments[0]?.order_id,
  amount: payments[0]?.amount,
  currency: payments[0]?.currency,
  status: payments[0]?.status
});

console.log('\nAll db.js checks passed successfully!');
