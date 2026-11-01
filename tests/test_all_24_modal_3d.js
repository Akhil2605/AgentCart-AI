const http = require('http');
const { spawn } = require('child_process');
const { app } = require('../backend/server');

const TEST_PORT = 3100;
const CDP_PORT = 9337;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testAll24Products() {
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

  let ws = null;
  const errors = [];

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

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    ws = new WebSocket(wsUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        errors.push(text);
        console.error('  [Chrome Error]', text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const errText = msg.params.exceptionDetails.text || JSON.stringify(msg.params.exceptionDetails);
        errors.push(errText);
        console.error('  [Chrome Exception]', errText);
      }
      if (msg.id && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        cb(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function sendCmd(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        callbacks.set(msgId, resolve);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await sendCmd('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res && res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
      }
      return res ? res.result?.value : undefined;
    }

    await sendCmd('Runtime.enable');
    await sendCmd('Page.enable');
    await sendCmd('DOM.enable');

    await sendCmd('Page.navigate', { url: `http://localhost:${TEST_PORT}/` });
    await new Promise(r => setTimeout(r, 3500));

    // Get list of all product IDs from State.products
    const productIds = await evaluate(`State.products.map(p => p.id)`);
    console.log(`📦 Found ${productIds.length} products in catalogue to test`);

    let passedCount = 0;
    for (let i = 0; i < productIds.length; i++) {
      const pid = productIds[i];
      await evaluate(`openProductModal('${pid}')`);
      await new Promise(r => setTimeout(r, 300)); // wait for viewer update

      const status = await evaluate(`
        ({
          id: window.modalJacketViewer.activeProduct?.id,
          model: window.PRODUCT_3D_MAPPING[window.modalJacketViewer.activeProduct?.id]?.model,
          color: window.modalJacketViewer.activeColor,
          hasPivot: !!window.modalJacketViewer.pivot,
          isPaused: window.modalJacketViewer.isPaused
        })
      `);

      if (status.id === pid && status.hasPivot && !status.isPaused) {
        console.log(`  ✅ [${i + 1}/${productIds.length}] ${pid} -> model: ${status.model}, color: ${status.color}`);
        passedCount++;
      } else {
        console.error(`  ❌ [${i + 1}/${productIds.length}] ${pid} FAILED:`, status);
      }
    }

    console.log(`\nResults: ${passedCount}/${productIds.length} products verified in 3D modal viewer!`);
    console.log(`Errors: ${errors.length}`);

    if (passedCount !== productIds.length || errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
    server.close();
  }
}

testAll24Products();
