const db = require('./db');

const FREE_SHIPPING_THRESHOLD = 2000;
const STANDARD_SHIPPING_FEE = 150;
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

/**
 * Clean environment credentials (strip quotes, trim whitespace)
 */
function getSanitizedCredentials() {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').replace(/^['"]|['"]$/g, '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').replace(/^['"]|['"]$/g, '').trim();
  return { clientId, clientSecret };
}

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
    const qty = Number(item.quantity);
    if (!item.id || !Number.isInteger(qty) || qty <= 0) {
      throw new Error(`Invalid item or quantity for item ID: ${item?.id}`);
    }

    const product = db.getProductById(item.id);
    if (!product) {
      throw new Error(`Product not found in catalog: ${item.id}`);
    }

    if (typeof product.price !== 'number' || isNaN(product.price) || product.price <= 0) {
      throw new Error(`Invalid product price in catalog for item ID: ${item.id}`);
    }

    const lineTotal = product.price * qty;
    subtotal += lineTotal;

    verifiedItems.push({
      product_id: product.id,
      product_name: product.name,
      size: item.size || 'M',
      color: item.color || product.colors?.[0]?.name || 'Default',
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
  const { clientId, clientSecret } = getSanitizedCredentials();

  if (!clientId || !clientSecret || clientId === 'your_paypal_client_id_here' || clientSecret === 'your_paypal_client_secret_here') {
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

  const debugId = res.headers.get('paypal-debug-id') || 'n/a';

  if (!res.ok) {
    let errDetail = '';
    try {
      const errJson = await res.json();
      if (errJson && errJson.error === 'invalid_client') {
        throw new Error(
          `PayPal Sandbox Authentication Failed (invalid_client, Debug-ID: ${debugId}): The credentials in .env were not recognized by the PayPal Sandbox environment. ` +
          'Please verify that your PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET were copied from the "Sandbox" tab (not the "Live" tab) at ' +
          'https://developer.paypal.com/dashboard/applications/sandbox.'
        );
      }
      errDetail = JSON.stringify(errJson);
    } catch (parseErr) {
      if (parseErr.message && parseErr.message.includes('PayPal Sandbox Authentication Failed')) {
        throw parseErr;
      }
      errDetail = await res.text().catch(() => '');
    }
    console.error(`[PayPal Diagnostics] OAuth failed (HTTP ${res.status}, Debug-ID: ${debugId}): ${errDetail}`);
    throw new Error(`Failed to authenticate with PayPal Sandbox (HTTP ${res.status}, Debug-ID: ${debugId}): ${errDetail}`);
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

  const rawCurrency = (process.env.PAYPAL_CURRENCY || 'USD').trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';
  // Standard conversion rate for Sandbox testing if USD selected (1 USD = ~85 INR)
  const rate = currency === 'USD' ? 85 : 1;

  // Ensure item totals strictly match breakdown.item_total without penny rounding drift
  let itemTotalSum = 0;
  const paypalItems = (order.items || []).map(it => {
    const unitPrice = Number((it.unit_price / rate).toFixed(2));
    itemTotalSum += unitPrice * it.quantity;
    return {
      name: it.product_name.substring(0, 127),
      quantity: it.quantity.toString(),
      unit_amount: {
        currency_code: currency,
        value: unitPrice.toFixed(2)
      }
    };
  });

  const subtotalInCurrency = itemTotalSum.toFixed(2);
  const shippingInCurrency = (order.delivery_fee / rate).toFixed(2);
  const totalInCurrency = (Number(subtotalInCurrency) + Number(shippingInCurrency)).toFixed(2);

  console.log(`[PayPal Diagnostics] Creating order for local ID: ${order.id}`);
  console.log(`[PayPal Diagnostics] Intent: CAPTURE, Currency: ${currency}, Subtotal: ${subtotalInCurrency}, Shipping: ${shippingInCurrency}, Total: ${totalInCurrency}`);

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
        items: paypalItems
      }
    ],
    payer: (order.customer_email && order.customer_email.includes('@')) ? {
      email_address: order.customer_email
    } : undefined,
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'AgentCart AI',
          locale: 'en-US',
          shipping_preference: 'GET_FROM_FILE',
          user_action: 'PAY_NOW',
          return_url: 'http://localhost:3000/#paypal-return',
          cancel_url: 'http://localhost:3000/#paypal-cancel'
        }
      }
    }
  };

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const debugId = res.headers.get('paypal-debug-id') || 'n/a';
  console.log(`[PayPal Diagnostics] Create order HTTP status: ${res.status} (Debug-ID: ${debugId})`);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[PayPal Diagnostics] Order creation failed: ${errText} (Debug-ID: ${debugId})`);
    throw new Error(`PayPal Order Creation Failed (HTTP ${res.status}, Debug-ID: ${debugId}): ${errText}`);
  }

  const paypalData = await res.json();
  console.log(`[PayPal Diagnostics] Order created successfully. PayPal Order ID: ${paypalData.id}`);
  
  // Link paypal order id to local SQLite order
  db.getDb().prepare('UPDATE orders SET provider_order_id = ? WHERE id = ?').run(paypalData.id, order.id);

  return {
    success: true,
    is_configured: true,
    paypal_order_id: paypalData.id,
    order_id: order.id,
    order: db.getOrderById(order.id)
  };
}

/**
 * Capture payment from PayPal Sandbox API
 */
async function capturePayPalSandboxOrder(localOrderId, paypalOrderId) {
  // Support lookup by either local order ID or provider order ID
  let localOrder = null;
  if (localOrderId) {
    localOrder = db.getOrderById(localOrderId);
  }
  if (!localOrder && paypalOrderId) {
    localOrder = db.getOrderByProviderOrderId(paypalOrderId);
  }

  if (!localOrder) {
    throw new Error(`Order not found (ID: ${localOrderId || paypalOrderId}).`);
  }

  // Duplicate capture prevention
  if (localOrder.status === 'PAID') {
    console.warn(`[PayPal Diagnostics] Duplicate capture prevented for order: ${localOrder.id}`);
    throw new Error(`Order ${localOrder.id} is already paid. Duplicate capture prevented.`);
  }

  const accessToken = await getPayPalAccessToken();
  if (!accessToken) {
    throw new Error('PayPal Sandbox credentials are required to capture a genuine payment.');
  }

  console.log(`[PayPal Diagnostics] Capturing payment for local ID: ${localOrder.id}, PayPal ID: ${paypalOrderId}`);

  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const debugId = res.headers.get('paypal-debug-id') || 'n/a';
  console.log(`[PayPal Diagnostics] Capture HTTP status: ${res.status} (Debug-ID: ${debugId})`);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[PayPal Diagnostics] Capture failed: ${errText} (Debug-ID: ${debugId})`);
    db.updateOrderStatus(localOrder.id, 'FAILED', null);
    throw new Error(`PayPal Capture Failed (HTTP ${res.status}, Debug-ID: ${debugId}): ${errText}`);
  }

  const captureData = await res.json();
  const captureStatus = captureData.status; // 'COMPLETED'
  console.log(`[PayPal Diagnostics] Capture response status: ${captureStatus}`);

  if (captureStatus !== 'COMPLETED') {
    db.updateOrderStatus(localOrder.id, 'FAILED', captureData.id || null);
    throw new Error(`PayPal capture incomplete. Status: ${captureStatus} (Debug-ID: ${debugId})`);
  }

  const captureItem = captureData.purchase_units?.[0]?.payments?.captures?.[0];
  const captureId = captureItem?.id || captureData.id;

  // Update order as PAID in SQLite
  const updatedOrder = db.updateOrderStatus(localOrder.id, 'PAID', captureId);
  console.log(`[PayPal Diagnostics] Order ${localOrder.id} marked as PAID. Capture ID: ${captureId}`);

  return {
    success: true,
    status: 'PAID',
    paypal_capture_id: captureId,
    amount_captured: captureItem?.amount || null,
    order: updatedOrder
  };
}

/**
 * Cancel a pending order
 */
function cancelPayPalOrder(localOrderId, paypalOrderId) {
  let localOrder = null;
  if (localOrderId) {
    localOrder = db.getOrderById(localOrderId);
  }
  if (!localOrder && paypalOrderId) {
    localOrder = db.getOrderByProviderOrderId(paypalOrderId);
  }

  if (!localOrder) {
    throw new Error(`Order not found for cancellation.`);
  }

  if (localOrder.status === 'PAID') {
    throw new Error(`Cannot cancel order ${localOrder.id} because payment has already been captured.`);
  }

  const updatedOrder = db.updateOrderStatus(localOrder.id, 'CANCELLED');
  console.log(`[PayPal Diagnostics] Order ${localOrder.id} status transitioned to CANCELLED.`);
  return {
    success: true,
    status: 'CANCELLED',
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
  
  const updatedOrder = db.updateOrderStatus(localOrder.id, 'PAID_DEMO_TEST', 'DEMO-TXN-' + Date.now());
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
  PAYPAL_API_BASE,
  getSanitizedCredentials,
  validateAndCalculateOrder,
  getPayPalAccessToken,
  createPayPalSandboxOrder,
  capturePayPalSandboxOrder,
  cancelPayPalOrder,
  recordDemoSimulationOrder
};
