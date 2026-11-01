const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');

const TEST_PORT = 3099;
const CDP_PORT = 9336;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const screenshotDir = path.join(__dirname, 'screenshots_modal_3d');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

async function runModal3DVerification() {
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
  const consoleMessages = [];
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

    if (!targets || targets.length === 0) {
      throw new Error('Chrome CDP failed to respond');
    }

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    console.log('🔗 Connecting to Chrome CDP WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
        consoleMessages.push(text);
        if (msg.params.type === 'error') {
          errors.push(text);
          console.error('  [Chrome Error]', text);
        } else {
          console.log('  [Chrome Console]', text);
        }
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

    async function captureScreenshot(filename) {
      const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
      if (res && res.data) {
        const filePath = path.join(screenshotDir, filename);
        fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
        console.log(`📸 Saved screenshot: ${filePath}`);
      }
    }

    await sendCmd('Runtime.enable');
    await sendCmd('Page.enable');
    await sendCmd('DOM.enable');

    console.log('🧭 Navigating to AgentCart AI frontend...');
    await sendCmd('Page.navigate', { url: `http://localhost:${TEST_PORT}/` });

    // Wait 3.5 seconds for initial page load and hero viewer
    await new Promise(r => setTimeout(r, 3500));

    // Verify modal viewer object initialized
    console.log('🔍 Checking window.modalJacketViewer initialization...');
    const viewerInit = await evaluate(`
      ({
        hasModalViewer: typeof window.modalJacketViewer === 'object' && window.modalJacketViewer !== null,
        hasMappingTable: typeof window.PRODUCT_3D_MAPPING === 'object',
        mappingCount: Object.keys(window.PRODUCT_3D_MAPPING || {}).length,
        hasModalContainer: !!document.getElementById('modalJacketContainer'),
        hasModalCanvas: !!document.querySelector('#modalJacketContainer canvas')
      })
    `);
    console.log('  Viewer state:', JSON.stringify(viewerInit, null, 2));

    if (!viewerInit.hasModalViewer || viewerInit.mappingCount !== 24) {
      throw new Error(`Viewer or mapping table invalid. Found count: ${viewerInit.mappingCount}`);
    }

    // TEST 1: Open Alpine Shift Hardshell (white-jacket.glb base)
    console.log('\n--- TEST 1: Open Alpine Shift Hardshell (white-jacket.glb) ---');
    await evaluate(`openProductModal('alpine-white-shell')`);
    await new Promise(r => setTimeout(r, 2000)); // wait for model load

    const alpineState = await evaluate(`
      ({
        modalOpen: document.getElementById('productModal').classList.contains('open'),
        activeProductId: window.modalJacketViewer.activeProduct?.id,
        activeModelType: window.PRODUCT_3D_MAPPING[window.modalJacketViewer.activeProduct?.id]?.model,
        activeColor: window.modalJacketViewer.activeColor,
        isPaused: window.modalJacketViewer.isPaused,
        canvasVisible: document.querySelector('#modalJacketContainer canvas')?.offsetParent !== null,
        fallbackHidden: document.getElementById('modalImg').classList.contains('modal-fallback-hidden')
      })
    `);
    console.log('  Alpine modal state:', JSON.stringify(alpineState, null, 2));
    await captureScreenshot('1_modal_alpine_white.png');

    // TEST 2: Swatch switching inside modal
    console.log('\n--- TEST 2: Color Swatch Switching ---');
    const swatchSwitched = await evaluate(`
      (() => {
        const swatches = document.querySelectorAll('#modalSwatches .color-swatch-btn');
        if (swatches.length > 1) {
          swatches[1].click();
          return {
            clicked: swatches[1].dataset.color,
            newActiveColor: window.modalJacketViewer.activeColor
          };
        }
        return { clicked: null };
      })()
    `);
    console.log('  Swatch switched:', JSON.stringify(swatchSwitched, null, 2));
    await new Promise(r => setTimeout(r, 800));
    await captureScreenshot('2_modal_alpine_swatch_changed.png');

    // TEST 3: 360 Rotation Controls (Back & Front view buttons)
    console.log('\n--- TEST 3: 360 Rotation - Back View ---');
    await evaluate(`document.getElementById('modalBackViewBtn')?.click()`);
    await new Promise(r => setTimeout(r, 1200)); // allow damping to rotate
    await captureScreenshot('3_modal_alpine_back_view.png');

    console.log('--- TEST 3b: 360 Rotation - Front View ---');
    await evaluate(`document.getElementById('modalResetViewBtn')?.click()`);
    await new Promise(r => setTimeout(r, 1200));
    await captureScreenshot('4_modal_alpine_front_view.png');

    // TEST 4: Open CyberShell Pro Stormbreaker (jacket.glb base, multi-material)
    console.log('\n--- TEST 4: Open CyberShell Pro Stormbreaker (jacket.glb) ---');
    await evaluate(`openProductModal('cyber-shell-black')`);
    await new Promise(r => setTimeout(r, 2000));

    const cyberState = await evaluate(`
      ({
        activeProductId: window.modalJacketViewer.activeProduct?.id,
        activeModelType: window.PRODUCT_3D_MAPPING[window.modalJacketViewer.activeProduct?.id]?.model,
        activeColor: window.modalJacketViewer.activeColor,
        isPaused: window.modalJacketViewer.isPaused
      })
    `);
    console.log('  Cyber modal state:', JSON.stringify(cyberState, null, 2));
    await captureScreenshot('5_modal_cyber_shell.png');

    // TEST 5: Open Apex Signal Hi-Vis Shell (Alpine base with vivid blaze orange)
    console.log('\n--- TEST 5: Open Apex Signal Hi-Vis Shell (Blaze Orange) ---');
    await evaluate(`openProductModal('apex-blaze-orange')`);
    await new Promise(r => setTimeout(r, 2000));

    const orangeState = await evaluate(`
      ({
        activeProductId: window.modalJacketViewer.activeProduct?.id,
        activeColor: window.modalJacketViewer.activeColor,
        title: document.getElementById('modalTitle').textContent
      })
    `);
    console.log('  Apex Orange state:', JSON.stringify(orangeState, null, 2));
    await captureScreenshot('6_modal_apex_blaze_orange.png');

    // TEST 6: Open Neon Pulse City Windcoat (Magenta)
    console.log('\n--- TEST 6: Open Neon Pulse City Windcoat (Magenta) ---');
    await evaluate(`openProductModal('neon-pulse-magenta')`);
    await new Promise(r => setTimeout(r, 2000));

    const magentaState = await evaluate(`
      ({
        activeProductId: window.modalJacketViewer.activeProduct?.id,
        activeColor: window.modalJacketViewer.activeColor,
        title: document.getElementById('modalTitle').textContent
      })
    `);
    console.log('  Neon Magenta state:', JSON.stringify(magentaState, null, 2));
    await captureScreenshot('7_modal_neon_pulse_magenta.png');

    // TEST 7: Modal Close and GPU Pause
    console.log('\n--- TEST 7: Close Modal and Verify RAF Paused ---');
    await evaluate(`closeProductModal()`);
    await new Promise(r => setTimeout(r, 600));

    const closedState = await evaluate(`
      ({
        modalOpen: document.getElementById('productModal').classList.contains('open'),
        isPaused: window.modalJacketViewer.isPaused,
        animId: window.modalJacketViewer.animId
      })
    `);
    console.log('  Closed modal state (GPU conserving):', JSON.stringify(closedState, null, 2));

    // TEST 8: Fallback mechanism test
    console.log('\n--- TEST 8: Graceful 2D Fallback ---');
    await evaluate(`
      (() => {
        openProductModal('alpine-white-shell');
        window.modalJacketViewer.showFallbackImage();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    const fallbackState = await evaluate(`
      ({
        canvasDisplay: window.modalJacketViewer.canvasWrap.style.display,
        imgDisplay: document.getElementById('modalImg').style.display,
        imgVisible: !document.getElementById('modalImg').classList.contains('modal-fallback-hidden')
      })
    `);
    console.log('  Fallback test state:', JSON.stringify(fallbackState, null, 2));
    await captureScreenshot('8_modal_2d_fallback.png');

    console.log('\n=============================================');
    console.log('🎉 Modal 3D Jacket Integration Verification Finished!');
    console.log('Total Exceptions:', errors.length);
    console.log('=============================================');

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (ws) ws.close();
    chromeProcess.kill();
    server.close();
  }
}

runModal3DVerification();
