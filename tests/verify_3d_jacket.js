const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');

const TEST_PORT = 3098;
const CDP_PORT = 9335;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const screenshotDir = path.join(__dirname, 'screenshots_3d');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

async function run3DVerification() {
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
  const consoleMessages = [];
  const errors = [];

  try {
    // Wait for Chrome CDP endpoint
    let targets = null;
    for (let i = 0; i < 20; i++) {
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

    console.log('🔗 Connecting to Chrome CDP WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        consoleMessages.push(text);
        console.log('  [Chrome Console]', text);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const errText = msg.params.exceptionDetails.text || JSON.stringify(msg.params.exceptionDetails);
        errors.push(errText);
        console.error('  [Chrome Error]', errText);
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

    await sendCmd('Runtime.enable');
    await sendCmd('Page.enable');
    await sendCmd('DOM.enable');

    console.log('🧭 Navigating to Digital Showroom...');
    await sendCmd('Page.navigate', { url: `http://localhost:${TEST_PORT}/` });

    // Wait for page load and model initialization
    console.log('⏳ Waiting 4.5 seconds for 3D model to load and render...');
    await new Promise(r => setTimeout(r, 4500));

    // Evaluate 3D Viewer status
    const evalRes = await sendCmd('Runtime.evaluate', {
      expression: `
        (() => {
          const container = document.querySelector('#heroJacketContainer');
          const canvas = container ? container.querySelector('canvas') : null;
          const badge = container ? container.querySelector('.jacket-3d-badge') : null;
          const loader = container ? container.querySelector('.jacket-3d-loader') : null;
          return {
            hasContainer: !!container,
            hasCanvas: !!canvas,
            canvasWidth: canvas ? canvas.width : 0,
            canvasHeight: canvas ? canvas.height : 0,
            badgeText: badge ? badge.innerText : null,
            loaderDisplay: loader ? loader.style.display : null,
            loaderClasses: loader ? loader.className : null
          };
        })()
      `,
      returnByValue: true
    });

    console.log('📊 3D Viewer Status in DOM:', JSON.stringify(evalRes.result.value, null, 2));

    // Capture Default Screenshot (Front view of 3D Jacket)
    const ss1 = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const ss1Path = path.join(screenshotDir, '1_hero_3d_front.png');
    fs.writeFileSync(ss1Path, Buffer.from(ss1.data, 'base64'));
    console.log('📸 Saved Front View Screenshot:', ss1Path);

    // Click "BACK" button to inspect 360 rotation to the back
    console.log('🔄 Triggering rotation to BACK view...');
    await sendCmd('Runtime.evaluate', {
      expression: `
        (() => {
          const backBtn = document.querySelector('#jacketBackViewBtn');
          if (backBtn) backBtn.click();
        })()
      `
    });

    // Wait 1.2s for smooth damping animation
    await new Promise(r => setTimeout(r, 1200));

    const ss2 = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const ss2Path = path.join(screenshotDir, '2_hero_3d_back.png');
    fs.writeFileSync(ss2Path, Buffer.from(ss2.data, 'base64'));
    console.log('📸 Saved Back View Screenshot:', ss2Path);

    // Simulate Mouse Drag across container
    console.log('🖱️ Simulating Mouse Drag 360 rotation...');
    await sendCmd('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.querySelector('#heroJacketContainer');
          if (el) {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width * 0.5;
            const cy = rect.top + rect.height * 0.5;

            el.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
            window.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 180, clientY: cy - 25, bubbles: true }));
            window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx + 180, clientY: cy - 25, bubbles: true }));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1000));

    const ss3 = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const ss3Path = path.join(screenshotDir, '3_hero_3d_drag_angle.png');
    fs.writeFileSync(ss3Path, Buffer.from(ss3.data, 'base64'));
    console.log('📸 Saved Drag Interaction Screenshot:', ss3Path);

    // Mobile Viewport Test (390 x 844)
    console.log('📱 Testing Mobile Viewport (390 x 844)...');
    await sendCmd('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    await new Promise(r => setTimeout(r, 1000));

    const ss4 = await sendCmd('Page.captureScreenshot', { format: 'png' });
    const ss4Path = path.join(screenshotDir, '4_hero_3d_mobile.png');
    fs.writeFileSync(ss4Path, Buffer.from(ss4.data, 'base64'));
    console.log('📸 Saved Mobile Viewport Screenshot:', ss4Path);

    console.log('\n=============================================');
    console.log('🎉 3D Jacket Integration Verification Finished!');
    console.log('Errors encountered:', errors.length);
    console.log('=============================================');

    ws.close();
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    try { chromeProcess.kill(); } catch (e) {}
    server.close();
  }
}

run3DVerification();
