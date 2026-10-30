const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');

const TEST_PORT = 3097;
const CDP_PORT = 9336;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runVerification() {
  console.log('🚀 Starting Express Server on port', TEST_PORT);
  const server = http.createServer(app).listen(TEST_PORT);

  console.log('🌐 Launching Headless Chrome on port', CDP_PORT);
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1280,960',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--mute-audio',
    'about:blank'
  ]);

  let cdpWs = null;

  try {
    let targets = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (res.ok) {
          targets = await res.json();
          if (targets.length > 0) break;
        }
      } catch (e) {}
    }

    if (!targets || targets.length === 0) {
      throw new Error('Chrome CDP failed to respond');
    }

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;
    console.log('🔌 Connecting to CDP:', wsUrl);

    cdpWs = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdpWs.onopen = resolve;
      cdpWs.onerror = reject;
    });

    let msgId = 1;
    const callbacks = new Map();

    cdpWs.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };

    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        cdpWs.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const result = await sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || 'Evaluation error');
      }
      return result.result?.value;
    }

    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    console.log('🧭 Navigating to http://localhost:' + TEST_PORT);
    await sendCommand('Page.navigate', { url: `http://localhost:${TEST_PORT}` });

    await new Promise(r => setTimeout(r, 2500));

    // 1. Verify Primary INR Currency on product cards
    console.log('🔍 Checking primary product card pricing...');
    const cardPriceText = await evaluate(`
      const card = document.querySelector('.product-card');
      const priceEl = card ? card.querySelector('.card-current-price') : null;
      priceEl ? priceEl.innerText : 'NOT_FOUND';
    `);
    console.log('Sample product card price:', cardPriceText);
    if (!cardPriceText.includes('₹')) {
      throw new Error('Primary price does not contain INR (₹)!');
    }

    // 2. Verify Profile Header Button
    const headerProfileBtn = await evaluate(`
      const btn = document.querySelector('#headerProfileBtn');
      btn ? { visible: btn.offsetParent !== null, text: btn.innerText.trim() } : null;
    `);
    console.log('Header Profile Button:', headerProfileBtn);

    // 3. Open My Account Modal
    console.log('👤 Opening My Account Modal...');
    await evaluate(`openAccountModal('profile');`);
    await new Promise(r => setTimeout(r, 800));

    const accountModalState = await evaluate(`(() => {
      const m = document.querySelector('#accountModal');
      const name = document.querySelector('#accountUserNameDisplay')?.innerText;
      const totalOrders = document.querySelector('#statTotalOrders')?.innerText;
      const activeOrders = document.querySelector('#statActiveOrders')?.innerText;
      const deliveredOrders = document.querySelector('#statDeliveredOrders')?.innerText;
      const totalSpent = document.querySelector('#statTotalSpent')?.innerText;
      return {
        isOpen: m.classList.contains('open'),
        userName: name,
        totalOrders,
        activeOrders,
        deliveredOrders,
        totalSpent
      };
    })()`);
    console.log('Account Modal State:', accountModalState);
    if (!accountModalState.isOpen || accountModalState.userName !== 'Akhil') {
      throw new Error('Account modal did not open with profile Akhil!');
    }

    // Take Profile Screenshot
    const profileShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'account_profile_view.png'), Buffer.from(profileShot.data, 'base64'));
    console.log('📸 Captured docs/account_profile_view.png');

    // 4. Switch to Orders Tab
    console.log('📦 Switching to My Orders & Tracking Tab...');
    await evaluate(`switchAccountTab('orders');`);
    await new Promise(r => setTimeout(r, 1200));

    const ordersState = await evaluate(`(() => {
      const list = document.querySelector('#accountOrdersList');
      const cards = list ? list.querySelectorAll('.order-card-row') : [];
      const firstCard = cards[0];
      return {
        cardCount: cards.length,
        firstOrderId: firstCard ? firstCard.querySelector('.order-id-code')?.innerText : null,
        firstOrderPrice: firstCard ? firstCard.querySelector('.order-price-inr')?.innerText : null,
        hasTrackBtn: firstCard ? !!firstCard.querySelector('.btn-order-track') : false
      };
    })()`);
    console.log('Orders Tab State:', ordersState);
    if (ordersState.cardCount === 0) {
      throw new Error('No order cards rendered in orders tab!');
    }

    // 5. Open Tracking Modal for First Order
    console.log('📍 Opening 6-Stage Tracking Timeline for order:', ordersState.firstOrderId);
    await evaluate(`openTrackingModal('${ordersState.firstOrderId}');`);
    await new Promise(r => setTimeout(r, 1000));

    const trackingState = await evaluate(`(() => {
      const m = document.querySelector('#trackingModal');
      const steps = m ? m.querySelectorAll('.stepper-stage-item') : [];
      const stepNames = [...steps].map(s => s.querySelector('.stepper-title')?.innerText);
      const completedCount = m ? m.querySelectorAll('.stepper-stage-item.completed').length : 0;
      return {
        isOpen: m.classList.contains('open'),
        stepCount: steps.length,
        stepNames,
        completedCount
      };
    })()`);
    console.log('Tracking Modal State:', trackingState);
    if (trackingState.stepCount !== 6) {
      throw new Error(`Expected 6 tracking stages, found ${trackingState.stepCount}`);
    }

    // Take Tracking Screenshot
    const trackingShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'order_tracking_view.png'), Buffer.from(trackingShot.data, 'base64'));
    console.log('📸 Captured docs/order_tracking_view.png');

    // Close tracking modal
    await evaluate(`closeTrackingModal();`);
    await new Promise(r => setTimeout(r, 400));

    // 6. Switch to Payment History Tab
    console.log('💳 Switching to Payment History Tab...');
    await evaluate(`switchAccountTab('payments');`);
    await new Promise(r => setTimeout(r, 1200));

    const paymentsState = await evaluate(`(() => {
      const rows = document.querySelectorAll('#accountPaymentsList .payments-table tbody tr');
      return {
        rowCount: rows.length,
        firstTxn: rows[0] ? rows[0].querySelector('td code')?.innerText : null,
        firstAmount: rows[0] ? rows[0].querySelectorAll('td')[4]?.innerText : null,
        firstStatus: rows[0] ? rows[0].querySelectorAll('td')[7]?.innerText : null
      };
    })()`);
    console.log('Payments Tab State:', paymentsState);
    if (paymentsState.rowCount === 0) {
      throw new Error('No payment records rendered in payment history!');
    }

    // Take Payments Screenshot
    const paymentsShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'payment_history_view.png'), Buffer.from(paymentsShot.data, 'base64'));
    console.log('📸 Captured docs/payment_history_view.png');

    // Close Account Modal
    await evaluate(`closeAccountModal();`);
    await new Promise(r => setTimeout(r, 400));

    // 7. Verify Domestic India Blocking in Checkout Modal
    console.log('🛑 Testing Domestic India Payment Restriction in Checkout...');
    await evaluate(`(() => {
      // Add a jacket to cart
      const product = State.products[0];
      addToCart(product, 'M', product.colors[0].name, 1);
      openCheckoutModal();
      document.querySelector('#shipCountry').value = 'India';
      updateCheckoutCountryEligibility();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const domesticBlockedState = await evaluate(`(() => {
      const alertEl = document.querySelector('#domesticRestrictionAlert');
      const blockedBox = document.querySelector('#domesticBlockedContainer');
      const paypalWrap = document.querySelector('#paypalContainerWrap');
      return {
        alertVisible: alertEl && alertEl.style.display !== 'none',
        blockedBoxVisible: blockedBox && blockedBox.style.display !== 'none',
        paypalWrapHidden: paypalWrap && paypalWrap.style.display === 'none'
      };
    })()`);
    console.log('Domestic Blocked State:', domesticBlockedState);
    if (!domesticBlockedState.alertVisible || !domesticBlockedState.paypalWrapHidden) {
      throw new Error('Domestic India payment restriction was not properly displayed!');
    }

    // 8. Verify International (United States) Eligibility in Checkout
    console.log('🌍 Testing International United States Eligibility in Checkout...');
    await evaluate(`(() => {
      document.querySelector('#shipCountry').value = 'United States';
      updateCheckoutCountryEligibility();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const intlEligibleState = await evaluate(`(() => {
      const alertEl = document.querySelector('#domesticRestrictionAlert');
      const paypalWrap = document.querySelector('#paypalContainerWrap');
      const subtotalText = document.querySelector('#checkoutSubtotal')?.innerText;
      const totalText = document.querySelector('#checkoutTotal')?.innerText;
      return {
        alertHidden: alertEl && alertEl.style.display === 'none',
        paypalWrapVisible: paypalWrap && paypalWrap.style.display !== 'none',
        subtotalText,
        totalText
      };
    })()`);
    console.log('International Eligible State:', intlEligibleState);
    if (!intlEligibleState.paypalWrapVisible || !intlEligibleState.subtotalText.includes('₹')) {
      throw new Error('International checkout not properly displayed!');
    }

    // Take Checkout Screenshot
    const checkoutShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'checkout_international_view.png'), Buffer.from(checkoutShot.data, 'base64'));
    console.log('📸 Captured docs/checkout_international_view.png');

    console.log('\n🎉 ALL BROWSER CDP VERIFICATION CHECKS PASSED 100%!');
  } finally {
    if (cdpWs) {
      try { cdpWs.close(); } catch (e) {}
    }
    try { chromeProcess.kill(); } catch (e) {}
    await new Promise(resolve => server.close(resolve));
    console.log('Cleaned up server and headless browser.');
  }
}

runVerification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
