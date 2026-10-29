const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');

const TEST_PORT = 3094;
const CDP_PORT = 9333;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runBrowserVerification() {
  console.log('🚀 Starting Express Server on port', TEST_PORT);
  const server = http.createServer(app).listen(TEST_PORT);

  console.log('🌐 Launching Headless Chrome on port', CDP_PORT);
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1280,900',
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
    // Wait for Chrome CDP endpoint to be ready
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
    console.log('🔌 Connecting to Chrome DevTools WebSocket:', wsUrl);

    cdpWs = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      cdpWs.onopen = resolve;
      cdpWs.onerror = reject;
    });

    let msgId = 1;
    const callbacks = new Map();

    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        cdpWs.send(JSON.stringify({ id, method, params }));
      });
    }

    cdpWs.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) cb.reject(msg.error);
        else cb.resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
        consoleMessages.push(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(msg.params.exceptionDetails.text);
      }
    };

    // Enable domains
    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');
    await sendCommand('DOM.enable');

    console.log('🧭 Navigating to http://localhost:' + TEST_PORT);
    await sendCommand('Page.navigate', { url: `http://localhost:${TEST_PORT}/` });

    // Check ancestors of heroStickyStage for sticky inhibitors
    const ancestorCheck = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        let el = document.getElementById('heroStickyStage');
        const list = [];
        while (el) {
          const cs = window.getComputedStyle(el);
          list.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            overflow: cs.overflow,
            overflowX: cs.overflowX,
            overflowY: cs.overflowY,
            contain: cs.contain
          });
          el = el.parentElement;
        }
        return list;
      })()`,
      returnByValue: true
    });
    console.log('🔍 Ancestor Hierarchy & Overflow Rules:', JSON.stringify(ancestorCheck.result.value, null, 2));

    // Verify elements in DOM
    const evalResult = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const video = document.getElementById('heroVideo');
        const canvas = document.getElementById('heroCanvas');
        const poster = document.getElementById('heroPosterImg');
        const arena = document.getElementById('heroVideoArena');
        const telemetry = document.getElementById('heroTelemetryTime');
        const fill = document.getElementById('heroScrubProgressFill');

        return {
          hasVideo: !!video,
          videoSrc: video ? video.getAttribute('src') : null,
          videoControls: video ? video.hasAttribute('controls') : false,
          videoMuted: video ? video.muted : false,
          hasCanvas: !!canvas,
          hasPoster: !!poster,
          hasArena: !!arena,
          arenaRect: arena ? { width: arena.offsetWidth, height: arena.offsetHeight } : null,
          initialTelemetry: telemetry ? telemetry.textContent : null,
          initialFillWidth: fill ? fill.style.width : null,
          documentHeight: document.documentElement.scrollHeight
        };
      })()`,
      returnByValue: true
    });

    console.log('📊 DOM Inspection Results:', JSON.stringify(evalResult.result.value, null, 2));

    // Test Scrolling Down
    console.log('📜 Testing Scroll-Down to 800px...');
    await sendCommand('Runtime.evaluate', {
      expression: `window.scrollTo({ top: 800, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 600));

    const scrollResult1 = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const video = document.getElementById('heroVideo');
        const telemetry = document.getElementById('heroTelemetryTime');
        const fill = document.getElementById('heroScrubProgressFill');
        const hero = document.getElementById('hero');
        const sticky = document.getElementById('heroStickyStage');
        return {
          scrollY: window.scrollY,
          innerHeight: window.innerHeight,
          heroHeight: hero ? hero.offsetHeight : null,
          stickyTop: sticky ? sticky.getBoundingClientRect().top : null,
          stickyBottom: sticky ? sticky.getBoundingClientRect().bottom : null,
          heroTop: hero ? hero.getBoundingClientRect().top : null,
          heroBottom: hero ? hero.getBoundingClientRect().bottom : null,
          stickyComputedPos: sticky ? window.getComputedStyle(sticky).position : null,
          videoCurrentTime: video ? video.currentTime : null,
          videoReadyState: video ? video.readyState : null,
          videoRect: video ? { top: video.getBoundingClientRect().top, bottom: video.getBoundingClientRect().bottom, left: video.getBoundingClientRect().left, right: video.getBoundingClientRect().right, width: video.getBoundingClientRect().width, height: video.getBoundingClientRect().height } : null,
          arenaRect: document.getElementById('heroVideoArena') ? { top: document.getElementById('heroVideoArena').getBoundingClientRect().top, bottom: document.getElementById('heroVideoArena').getBoundingClientRect().bottom, left: document.getElementById('heroVideoArena').getBoundingClientRect().left, right: document.getElementById('heroVideoArena').getBoundingClientRect().right } : null,
          telemetry: telemetry ? telemetry.textContent : null,
          fillWidth: fill ? fill.style.width : null,
          heroQuickAddBtn: (() => {
            const b = document.getElementById('heroQuickAddBtn');
            const s = document.getElementById('heroShopNowBtn');
            const svg = document.querySelector('#heroShopNowBtn svg');
            return {
              quickAdd: b ? { top: b.getBoundingClientRect().top, left: b.getBoundingClientRect().left, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height } : null,
              shopNow: s ? { top: s.getBoundingClientRect().top, left: s.getBoundingClientRect().left, width: s.getBoundingClientRect().width, height: s.getBoundingClientRect().height } : null,
              svg: svg ? { top: svg.getBoundingClientRect().top, left: svg.getBoundingClientRect().left, width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, html: svg.outerHTML } : null
            };
          })(),
          elementsAtCenterBottom: (() => {
            // Check what element is at (600, 780)
            const el = document.elementFromPoint(600, 780);
            return el ? { tag: el.tagName, id: el.id, className: el.className, text: el.textContent?.slice(0, 30) } : null;
          })()
        };
      })()`,
      returnByValue: true
    });
    console.log('⏬ Scroll-Down (800px) state:', JSON.stringify(scrollResult1.result.value, null, 2));

    const screenshotData800 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, '..', 'video', 'browser_scrolled_800px.png'), Buffer.from(screenshotData800.data, 'base64'));
    console.log('🖼️ 800px Scrolled Screenshot saved!');

    // Test Scrolling Down further to 1600px
    console.log('📜 Testing Scroll-Down further to 1600px...');
    await sendCommand('Runtime.evaluate', {
      expression: `window.scrollTo({ top: 1600, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 600));

    const scrollResult2 = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const video = document.getElementById('heroVideo');
        const telemetry = document.getElementById('heroTelemetryTime');
        const fill = document.getElementById('heroScrubProgressFill');
        return {
          scrollY: window.scrollY,
          videoCurrentTime: video ? video.currentTime : null,
          telemetry: telemetry ? telemetry.textContent : null,
          fillWidth: fill ? fill.style.width : null
        };
      })()`,
      returnByValue: true
    });
    console.log('⏬ Scroll-Down (1600px) state:', JSON.stringify(scrollResult2.result.value, null, 2));

    // Test Scrolling Back Up to 0px
    console.log('📜 Testing Scroll-Up back to 0px (Reversal)...');
    await sendCommand('Runtime.evaluate', {
      expression: `window.scrollTo({ top: 0, behavior: 'instant' });`
    });
    await new Promise(r => setTimeout(r, 600));

    const scrollResult3 = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const video = document.getElementById('heroVideo');
        const telemetry = document.getElementById('heroTelemetryTime');
        const fill = document.getElementById('heroScrubProgressFill');
        return {
          scrollY: window.scrollY,
          videoCurrentTime: video ? video.currentTime : null,
          telemetry: telemetry ? telemetry.textContent : null,
          fillWidth: fill ? fill.style.width : null
        };
      })()`,
      returnByValue: true
    });
    console.log('⏫ Scroll-Up (0px) state:', JSON.stringify(scrollResult3.result.value, null, 2));

    // Capture screenshot to verify visual appearance
    console.log('📸 Capturing Screenshot of rendered showroom...');
    const screenshotData = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(__dirname, '..', 'video', 'browser_verification.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.data, 'base64'));
    console.log('🖼️ Screenshot saved to:', screenshotPath);

    console.log('\n🔍 Console Messages:', consoleMessages);
    console.log('🚨 Uncaught Exceptions:', errors);

    if (errors.length > 0) {
      console.error('❌ Browser reported exceptions:', errors);
      process.exitCode = 1;
    } else {
      console.log('✅ Browser verification passed with 0 console errors!');
    }

  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    if (cdpWs) cdpWs.close();
    chromeProcess.kill();
    server.close();
    console.log('🏁 Verification finished.');
  }
}

runBrowserVerification();
