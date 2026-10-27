const db = require('./db');

const FREE_SHIPPING_THRESHOLD = 2000;
const STANDARD_SHIPPING_FEE = 150;
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

/**
 * Server-side calculation and security validation.
 * NEVER trust prices sent by the client.
 */
function validateAndCalculateOrder(items, shippingAddress) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Order items must be a non-empty array.');
  }

  if (!shippingAddress || !shippingAddress.name || !shippingAddress.email || !shippingAddress.address) {
    throw new Error('Valid shipping details (name, email, street address) are required.');
  }

  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    if (!item.id || !item.quantity || item.quantity <= 0) {
      throw new Error(`Invalid item or quantity for item ID: ${item.id}`);
    }

    const product = db.getProductById(item.id);
    if (!product) {
      throw new Error(`Product not found in catalog: ${item.id}`);
    }

    const qty = parseInt(item.quantity, 10);
    const lineTotal = product.price * qty;
    subtotal += lineTotal;

    verifiedItems.push({
      product_id: product.id,
      product_name: product.name,
      size: item.size || 'M',
      color: item.color || product.colors[0]?.name || 'Default',
      unit_price: product.price,
      quantity: qty,
      line_total: lineTotal
    });
  }

  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  const totalAmount = subtotal + deliveryFee;
  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

  const orderRecord = {
    id: orderId,
    customer_name: shippingAddress.name.trim(),
    customer_email: shippingAddress.email.trim(),
    shipping_address: shippingAddress.address.trim(),
    city: shippingAddress.city?.trim() || 'Bengaluru',
    state: shippingAddress.state?.trim() || 'Karnataka',
    postal_code: shippingAddress.postal_code?.trim() || '560001',
    phone: shippingAddress.phone?.trim() || '',
    subtotal,
    delivery_fee: deliveryFee,
    total_amount: totalAmount,
    currency: 'INR',
    status: 'PENDING',
    payment_provider: 'PAYPAL_SANDBOX'
  };

  // Persist order with PENDING status in SQLite
  const savedOrder = db.createOrder(orderRecord, verifiedItems);
  return savedOrder;
}

/**
 * Obtain OAuth2 Access Token from PayPal Sandbox
 */
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'your_paypal_client_id_here') {
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to authenticate with PayPal Sandbox: ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Create order on PayPal Sandbox API
 */
async function createPayPalSandboxOrder(order) {
  const accessToken = await getPayPalAccessToken();
  
  if (!accessToken) {
    return {
      is_configured: false,
      order,
      message: 'PayPal Sandbox credentials not configured. Operating in test sandbox guidance mode.'
    };
  }

  // Convert INR to USD for standard PayPal sandbox test accounts if needed,
  // or use INR if merchant account has Indian Rupee currency enabled.
  // Default PayPal Sandbox test accounts typically support USD.
  const currency = process.env.PAYPAL_CURRENCY || 'USD';
  // Approximate conversion rate for Sandbox testing if USD selected (1 USD = ~85 INR)
  const rate = currency === 'USD' ? 85 : 1;
  const totalInCurrency = (order.total_amount / rate).toFixed(2);
  const subtotalInCurrency = (order.subtotal / rate).toFixed(2);
  const shippingInCurrency = (order.delivery_fee / rate).toFixed(2);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: order.id,
        description: `AgentCart AI Order ${order.id}`,
        amount: {
          currency_code: currency,
          value: totalInCurrency,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: subtotalInCurrency
            },
            shipping: {
              currency_code: currency,
              value: shippingInCurrency
            }
          }
        },
        items: order.items.map(it => ({
          name: it.product_name.substring(0, 127),
          quantity: it.quantity.toString(),
          unit_amount: {
            currency_code: currency,
            value: (it.unit_price / rate).toFixed(2)
          }
        }))
      }
    ]
  };

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PayPal Order Creation Failed: ${errText}`);
  }

  const paypalData = await res.json();
  
  // Link paypal order id to local order
  db.getDb().prepare('UPDATE orders SET provider_order_id = ? WHERE id = ?').run(paypalData.id, order.id);

  return {
    is_configured: true,
    paypal_order_id: paypalData.id,
    order_id: order.id,
    order
  };
}

/**
 * Capture payment from PayPal Sandbox API
 */
async function capturePayPalSandboxOrder(localOrderId, paypalOrderId) {
  const localOrder = db.getOrderById(localOrderId);
  if (!localOrder) {
    throw new Error(`Local order ${localOrderId} not found.`);
  }

  if (localOrder.status === 'PAID') {
    throw new Error(`Order ${localOrderId} is already paid. Duplicate capture prevented.`);
  }

  const accessToken = await getPayPalAccessToken();

  if (!accessToken) {
    throw new Error('PayPal Sandbox credentials are required to capture a genuine payment.');
  }

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    db.updateOrderStatus(localOrderId, 'FAILED', null);
    throw new Error(`PayPal Capture Failed: ${errText}`);
  }

  const captureData = await res.json();
  const captureStatus = captureData.status; // 'COMPLETED'

  if (captureStatus !== 'COMPLETED') {
    db.updateOrderStatus(localOrderId, captureStatus, captureData.id);
    throw new Error(`PayPal capture incomplete. Status: ${captureStatus}`);
  }

  // Update order as PAID
  const updatedOrder = db.updateOrderStatus(localOrderId, 'PAID', captureData.id);
  return {
    success: true,
    status: 'PAID',
    paypal_capture_id: captureData.id,
    order: updatedOrder
  };
}

/**
 * Demo fallback: Local test order simulation
 * Only executes when PayPal credentials are not configured,
 * clearly marking order as DEMO_SIMULATION.
 */
function recordDemoSimulationOrder(localOrderId) {
  const localOrder = db.getOrderById(localOrderId);
  if (!localOrder) {
    throw new Error(`Local order ${localOrderId} not found.`);
  }
  
  const updatedOrder = db.updateOrderStatus(localOrderId, 'PAID_DEMO_TEST', 'DEMO-TXN-' + Date.now());
  return {
    success: true,
    is_demo_test: true,
    status: 'PAID_DEMO_TEST',
    message: 'Local offline demo test payment recorded. Real PayPal credentials were not configured.',
    order: updatedOrder
  };
}

module.exports = {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  validateAndCalculateOrder,
  createPayPalSandboxOrder,
  capturePayPalSandboxOrder,
  recordDemoSimulationOrder
};
