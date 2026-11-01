const db = require('../database/db');
const config = require('./config');

const {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  PAYPAL_API_BASE,
  PAYPAL_CURRENCY,
  INR_TO_USD_RATE
} = config;

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

  // Validate stock availability prior to creating the order
  db.checkOrderStockAvailable(items);

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

  const country = (shippingAddress.country || '').trim();
  const isDomesticIndia = /^(india|in|ind)$/i.test(country);
  if (isDomesticIndia) {
    throw new Error(
      'PayPal does not support domestic payments within India between Indian residents and merchants under RBI regulations. ' +
      'Only international cross-border transactions in USD are supported. Please select an international destination to test PayPal checkout.'
    );
  }

  const deliveryFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  const totalAmount = subtotal + deliveryFee;
  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

  const orderRecord = {
    id: orderId,
    user_id: shippingAddress.user_id || 'user_akhil',
    customer_name: shippingAddress.name.trim(),
    customer_email: shippingAddress.email.trim(),
    shipping_address: shippingAddress.address.trim(),
    city: shippingAddress.city?.trim() || 'Bengaluru',
    state: shippingAddress.state?.trim() || 'Karnataka',
    postal_code: shippingAddress.postal_code?.trim() || '560001',
    country: country || 'United States',
    phone: shippingAddress.phone?.trim() || '',
    subtotal,
    delivery_fee: deliveryFee,
    total_amount: totalAmount,
    currency: 'INR',
    exchange_rate: INR_TO_USD_RATE,
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

  const rawCurrency = (process.env.PAYPAL_CURRENCY || PAYPAL_CURRENCY || 'USD').trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';
  // Use shared fixed exchange rate for USD conversion (1 USD = 85 INR)
  const rate = currency === 'USD' ? INR_TO_USD_RATE : 1;

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
  const chargedAmountNum = Number(totalInCurrency);

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
    payer: (order.customer_email && order.customer_email.includes('@') && !order.customer_email.endsWith('@agentcart.ai')) ? {
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
  
  // Link paypal order id and explicitly record charged gateway amount and currency in SQLite
  db.getDb().prepare(`
    UPDATE orders 
    SET provider_order_id = ?, charged_amount = ?, charged_currency = ?, exchange_rate = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(paypalData.id, chargedAmountNum, currency, rate, order.id);

  // Update payments record to link provider_order_id
  db.updatePaymentStatus(order.id, 'PENDING', {
    provider_order_id: paypalData.id,
    amount: chargedAmountNum,
    currency: currency,
    payer_email: order.customer_email
  });

  const approveLink = (paypalData.links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action')?.href 
    || `https://www.sandbox.paypal.com/checkoutnow?token=${paypalData.id}`;

  return {
    success: true,
    is_configured: true,
    paypal_order_id: paypalData.id,
    order_id: order.id,
    charged_amount: chargedAmountNum,
    charged_currency: currency,
    approve_url: approveLink,
    order: db.getOrderById(order.id)
  };
}

/**
 * Capture payment from PayPal Sandbox API
 */
async function capturePayPalSandboxOrder(localOrderId, paypalOrderId) {
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
    db.updatePaymentStatus(localOrder.id, 'FAILED', {
      provider_order_id: paypalOrderId,
      debug_id: debugId,
      error_message: errText
    });
    db.createNotification(localOrder.user_id, {
      order_id: localOrder.id,
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      message: `Payment capture failed for order ${localOrder.id}. Please try again.`
    });
    throw new Error(`PayPal Capture Failed (HTTP ${res.status}, Debug-ID: ${debugId}): ${errText}`);
  }

  const captureData = await res.json();
  const captureStatus = captureData.status;
  console.log(`[PayPal Diagnostics] Capture response status: ${captureStatus}`);

  if (captureStatus !== 'COMPLETED') {
    db.updateOrderStatus(localOrder.id, 'FAILED', captureData.id || null);
    db.updatePaymentStatus(localOrder.id, 'FAILED', {
      provider_order_id: paypalOrderId,
      transaction_id: captureData.id || null,
      debug_id: debugId,
      error_message: `Incomplete capture status: ${captureStatus}`
    });
    throw new Error(`PayPal capture incomplete. Status: ${captureStatus} (Debug-ID: ${debugId})`);
  }

  const captureItem = captureData.purchase_units?.[0]?.payments?.captures?.[0];
  const captureId = captureItem?.id || captureData.id;
  const capturedAmountVal = captureItem?.amount?.value ? Number(captureItem.amount.value) : localOrder.charged_amount;
  const capturedCurrencyVal = captureItem?.amount?.currency_code || localOrder.charged_currency || 'USD';

  // Deduct stock in SQLite transaction now that payment is genuinely captured
  if (!localOrder.stock_deducted) {
    try {
      db.deductOrderStock(localOrder.id);
    } catch (stockErr) {
      console.warn(`[Inventory Warning] Stock deduction note for ${localOrder.id}:`, stockErr.message);
    }
  }

  // Update order as PAID in SQLite, storing captured payment ID, charged amount and currency
  db.getDb().prepare(`
    UPDATE orders 
    SET status = 'PAID', payment_id = ?, charged_amount = COALESCE(?, charged_amount), charged_currency = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(captureId, capturedAmountVal, capturedCurrencyVal, localOrder.id);

  // Add Stage 2 tracking event: Payment Confirmed
  db.addTrackingEvent(localOrder.id, {
    stage_number: 2,
    stage_name: 'Payment Confirmed',
    status_code: 'PAYMENT_CONFIRMED',
    title: 'Payment Confirmed',
    description: `Payment authorized and verified via PayPal Sandbox capture (Txn ID: ${captureId}).`,
    location: 'PayPal Gateway Engine'
  });

  // Update payment record to SUCCESS in payments table
  db.updatePaymentStatus(localOrder.id, 'SUCCESS', {
    provider_order_id: paypalOrderId,
    transaction_id: captureId,
    amount: capturedAmountVal,
    currency: capturedCurrencyVal,
    debug_id: debugId
  });

  // Notify customer
  db.createNotification(localOrder.user_id, {
    order_id: localOrder.id,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment Confirmed',
    message: `Payment of $${Number(capturedAmountVal).toFixed(2)} ${capturedCurrencyVal} confirmed for Order ${localOrder.id}.`
  });

  const updatedOrder = db.getOrderById(localOrder.id);
  console.log(`[PayPal Diagnostics] Order ${localOrder.id} marked as PAID. Capture ID: ${captureId}, Charged: ${capturedCurrencyVal} ${capturedAmountVal}`);

  return {
    success: true,
    status: 'PAID',
    paypal_capture_id: captureId,
    amount_captured: captureItem?.amount || { currency_code: capturedCurrencyVal, value: capturedAmountVal != null ? capturedAmountVal.toFixed(2) : null },
    order: updatedOrder
  };
}

/**
 * Refund captured payment from PayPal Sandbox API
 */
async function refundPayPalCapture(captureId, amount, currency = 'USD', reason = 'Customer return refund') {
  if (!captureId) {
    throw new Error('captureId is required to issue a refund.');
  }

  const accessToken = await getPayPalAccessToken();

  // If credentials are not set or captureId is simulated, execute sandbox fallback
  if (!accessToken || captureId.startsWith('DEMO-') || captureId.startsWith('TEST-')) {
    const simRefundId = 'REF-SIM-' + Date.now().toString(36).toUpperCase();
    console.log(`[PayPal Diagnostics] Executed sandbox demo refund for capture ${captureId}. Refund ID: ${simRefundId}`);
    return {
      success: true,
      refund_id: simRefundId,
      status: 'COMPLETED',
      amount: { value: Number(amount).toFixed(2), currency_code: currency },
      is_simulated: true
    };
  }

  console.log(`[PayPal Diagnostics] Issuing refund for capture ${captureId}, amount: ${currency} ${amount}`);

  const payload = {
    amount: {
      value: Number(amount).toFixed(2),
      currency_code: currency
    },
    note_to_payer: reason.substring(0, 255)
  };

  const res = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const debugId = res.headers.get('paypal-debug-id') || 'n/a';
  console.log(`[PayPal Diagnostics] Refund HTTP status: ${res.status} (Debug-ID: ${debugId})`);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[PayPal Diagnostics] Refund failed: ${errText} (Debug-ID: ${debugId})`);
    throw new Error(`PayPal Refund Failed (HTTP ${res.status}, Debug-ID: ${debugId}): ${errText}`);
  }

  const refundData = await res.json();
  const refundStatus = refundData.status; // 'COMPLETED' or 'PENDING'

  return {
    success: true,
    refund_id: refundData.id,
    status: refundStatus === 'PENDING' ? 'PENDING' : 'COMPLETED',
    amount: refundData.amount,
    details: refundData
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
  db.updatePaymentStatus(localOrder.id, 'CANCELLED', {
    provider_order_id: paypalOrderId || localOrder.provider_order_id
  });
  console.log(`[PayPal Diagnostics] Order ${localOrder.id} status transitioned to CANCELLED.`);
  return {
    success: true,
    status: 'CANCELLED',
    order: updatedOrder
  };
}

/**
 * Demo fallback: Local test order simulation
 */
function recordDemoSimulationOrder(localOrderId) {
  const localOrder = db.getOrderById(localOrderId);
  if (!localOrder) {
    throw new Error(`Local order ${localOrderId} not found.`);
  }
  
  const demoChargedAmount = Number((localOrder.total_amount / INR_TO_USD_RATE).toFixed(2));
  const demoTxnId = 'DEMO-TXN-' + Date.now();

  // Deduct stock for offline demo purchase as well
  if (!localOrder.stock_deducted) {
    try {
      db.deductOrderStock(localOrder.id);
    } catch (e) {
      console.warn('[Inventory Warning] Demo stock deduction:', e.message);
    }
  }

  db.getDb().prepare(`
    UPDATE orders 
    SET status = 'PAID_DEMO_TEST', payment_id = ?, charged_amount = ?, charged_currency = 'USD', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(demoTxnId, demoChargedAmount, localOrder.id);

  db.addTrackingEvent(localOrder.id, {
    stage_number: 2,
    stage_name: 'Payment Confirmed',
    status_code: 'PAYMENT_CONFIRMED',
    title: 'Payment Confirmed',
    description: 'Payment authorized and verified via verified offline sandbox simulation.',
    location: 'PayPal Sandbox Simulator'
  });

  db.updatePaymentStatus(localOrder.id, 'SUCCESS', {
    transaction_id: demoTxnId,
    amount: demoChargedAmount,
    currency: 'USD',
    payment_method: 'PayPal Demo Simulation'
  });

  db.createNotification(localOrder.user_id, {
    order_id: localOrder.id,
    type: 'PAYMENT_SUCCESS',
    title: 'Payment Confirmed (Demo Sandbox)',
    message: `Payment simulation of $${demoChargedAmount.toFixed(2)} USD confirmed for Order ${localOrder.id}.`
  });

  const updatedOrder = db.getOrderById(localOrder.id);
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
  PAYPAL_CURRENCY,
  INR_TO_USD_RATE,
  getSanitizedCredentials,
  validateAndCalculateOrder,
  getPayPalAccessToken,
  createPayPalSandboxOrder,
  capturePayPalSandboxOrder,
  refundPayPalCapture,
  cancelPayPalOrder,
  recordDemoSimulationOrder
};
