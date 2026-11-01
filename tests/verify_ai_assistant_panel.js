const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('../backend/server');

const TEST_PORT = 3101;
const CDP_PORT = 9338;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const screenshotDir = path.join(__dirname, 'screenshots_ai_assistant');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

async function verifyAiAssistant() {
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
  const consoleMessages = [];

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
    await new Promise(r => setTimeout(r, 3500));

    // TEST 1: Check Top Navigation AI Assistant placement
    console.log('\n--- TEST 1: Verify AI Assistant in Top Navigation ---');
    const navBtnInfo = await evaluate(`
      (() => {
        const btn = document.getElementById('headerAiBtn');
        const linkBtn = document.getElementById('navAiAssistantBtn');
        const rect = btn?.getBoundingClientRect();
        return {
          headerBtnExists: !!btn,
          headerBtnVisible: rect && rect.width > 0 && rect.height > 0,
          headerBtnText: btn?.innerText?.trim(),
          hasSparklesIcon: !!btn?.querySelector('.sparkles-icon'),
          navLinkExists: !!linkBtn,
          navLinkText: linkBtn?.innerText?.trim()
        };
      })()
    `);
    console.log('  Top Nav Info:', JSON.stringify(navBtnInfo, null, 2));
    if (!navBtnInfo.headerBtnExists || !navBtnInfo.headerBtnVisible) {
      throw new Error('AI Assistant top navigation button is missing or invisible!');
    }
    await captureScreenshot('1_top_nav_ai_assistant_visible.png');

    // TEST 2: Click AI Assistant button to open right slide-out panel
    console.log('\n--- TEST 2: Open Slide-Out Chat Panel from Right ---');
    await evaluate(`document.getElementById('headerAiBtn')?.click()`);
    await new Promise(r => setTimeout(r, 800)); // wait for slide-in transition

    const openPanelInfo = await evaluate(`
      (() => {
        const panel = document.getElementById('aiChatPanel');
        const backdrop = document.getElementById('aiChatBackdrop');
        const style = window.getComputedStyle(panel);
        return {
          panelOpen: panel.classList.contains('open'),
          backdropOpen: backdrop.classList.contains('open'),
          panelTransform: style.transform,
          panelRight: style.right,
          panelWidth: panel.offsetWidth,
          titleText: document.getElementById('aiChatTitle')?.innerText,
          statusText: panel.querySelector('.ai-status-label')?.innerText,
          hasWelcomeMsg: !!panel.querySelector('.ai-msg-row.bot-row'),
          hasChips: panel.querySelectorAll('.ai-chip-btn').length,
          hasInput: !!document.getElementById('aiChatInput'),
          hasSendBtn: !!document.getElementById('aiChatSendBtn'),
          hasCloseBtn: !!document.getElementById('aiChatCloseBtn')
        };
      })()
    `);
    console.log('  Open Panel State:', JSON.stringify(openPanelInfo, null, 2));
    if (!openPanelInfo.panelOpen) {
      throw new Error('Panel failed to slide in smoothly from the right!');
    }
    await captureScreenshot('2_right_slideout_panel_opened.png');

    // TEST 3: Ask Gemini about trekking jackets under ₹3,000
    console.log('\n--- TEST 3: Send Customer Query to Gemini AI ---');
    const queryPrompt = 'I need a waterproof trekking jacket under ₹3,000.';
    await evaluate(`
      (() => {
        const input = document.getElementById('aiChatInput');
        input.value = ${JSON.stringify(queryPrompt)};
        document.getElementById('aiChatForm').dispatchEvent(new Event('submit', { cancelable: true }));
      })()
    `);

    // Verify loading indicator is displayed while awaiting response
    await new Promise(r => setTimeout(r, 200));
    const loadingState = await evaluate(`
      document.getElementById('aiChatLoading').style.display !== 'none'
    `);
    console.log('  Loading indicator displayed:', loadingState);

    // Wait up to 10 seconds for live Gemini response
    console.log('⏳ Awaiting live Gemini API response...');
    let botReplied = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const count = await evaluate(`document.querySelectorAll('#aiChatMessages .ai-msg-row').length`);
      if (count >= 3) { // 1 welcome + 1 user + 1 bot reply
        botReplied = true;
        break;
      }
    }

    if (!botReplied) {
      throw new Error('Gemini response did not arrive within timeout!');
    }

    const aiResponseData = await evaluate(`
      (() => {
        const botRows = document.querySelectorAll('#aiChatMessages .ai-msg-row.bot-row');
        const lastBotRow = botRows[botRows.length - 1];
        const recCards = lastBotRow.querySelectorAll('.ai-rec-card');
        const cardsData = Array.from(recCards).map(card => ({
          title: card.querySelector('.ai-rec-title')?.innerText,
          price: card.querySelector('.ai-rec-price')?.innerText,
          reason: card.querySelector('.ai-rec-reason')?.innerText,
          hasThumb: !!card.querySelector('img.ai-rec-thumb')?.src,
          viewBtnId: card.querySelector('.btn-ai-view-product')?.dataset.id,
          addCartId: card.querySelector('.btn-ai-add-cart')?.dataset.id
        }));

        return {
          replyTextLength: lastBotRow.querySelector('.ai-bot-text')?.innerText?.length || 0,
          replyPreview: lastBotRow.querySelector('.ai-bot-text')?.innerText?.slice(0, 140),
          cardsCount: recCards.length,
          cards: cardsData
        };
      })()
    `);
    console.log('  AI Response Data:', JSON.stringify(aiResponseData, null, 2));

    if (aiResponseData.cardsCount === 0) {
      throw new Error('No product recommendation cards returned by Gemini!');
    }
    await captureScreenshot('3_gemini_recommendations_received.png');

    // TEST 4: View Product in 3D from AI Recommendation Card
    console.log('\n--- TEST 4: Click "View in 3D" on Recommendation Card ---');
    const firstProductToView = aiResponseData.cards[0].viewBtnId;
    console.log(`  Opening 3D Modal for product: ${firstProductToView}`);
    await evaluate(`
      document.querySelector('.btn-ai-view-product[data-id="${firstProductToView}"]')?.click()
    `);
    await new Promise(r => setTimeout(r, 1200));

    const modal3DState = await evaluate(`
      ({
        modalOpen: document.getElementById('productModal').classList.contains('open'),
        modalTitle: document.getElementById('modalTitle').textContent,
        activeProductInViewer: window.modalJacketViewer?.activeProduct?.id,
        is3DCanvasVisible: !!document.querySelector('#modalJacketContainer canvas'),
        aiChatPanelClosedOnNav: !document.getElementById('aiChatPanel').classList.contains('open')
      })
    `);
    console.log('  3D Modal State:', JSON.stringify(modal3DState, null, 2));

    if (!modal3DState.modalOpen || modal3DState.activeProductInViewer !== firstProductToView) {
      throw new Error('Clicking View in 3D failed to open the 3D model modal!');
    }
    await captureScreenshot('4_ai_rec_opened_in_3d_modal.png');

    // Close product modal
    await evaluate(`closeProductModal()`);
    await new Promise(r => setTimeout(r, 500));

    // TEST 5: Re-open AI Chat and verify Conversation State is PRESERVED
    console.log('\n--- TEST 5: Reopen AI Panel & Verify Conversation State Preserved ---');
    await evaluate(`document.getElementById('headerAiBtn')?.click()`);
    await new Promise(r => setTimeout(r, 600));

    const preservedState = await evaluate(`
      ({
        panelOpen: document.getElementById('aiChatPanel').classList.contains('open'),
        messageCount: document.querySelectorAll('#aiChatMessages .ai-msg-row').length,
        historyLength: State.aiConversationHistory.length,
        hasUserQueryStill: Array.from(document.querySelectorAll('.ai-bubble-user')).some(b => b.innerText.includes('trekking'))
      })
    `);
    console.log('  Preserved Conversation State:', JSON.stringify(preservedState, null, 2));
    if (preservedState.messageCount < 3 || !preservedState.hasUserQueryStill) {
      throw new Error('Conversation was erroneously reset upon reopening the panel!');
    }

    // TEST 6: Add to Cart from AI Recommendation Card
    console.log('\n--- TEST 6: Add to Cart from AI Recommendation Card ---');
    const initialCartCount = await evaluate(`State.cart.size`);
    console.log(`  Initial Cart Items: ${initialCartCount}`);

    await evaluate(`
      document.querySelector('.btn-ai-add-cart[data-id="${firstProductToView}"]')?.click()
    `);
    await new Promise(r => setTimeout(r, 600));

    const postAddCartCount = await evaluate(`State.cart.size`);
    console.log(`  Post-Add Cart Items: ${postAddCartCount}`);
    if (postAddCartCount <= initialCartCount) {
      throw new Error('Add to Cart button failed to increase cart item count!');
    }
    await captureScreenshot('5_ai_item_added_to_cart.png');

    // TEST 7: Close via X button
    console.log('\n--- TEST 7: Close Panel via X Button ---');
    await evaluate(`document.getElementById('aiChatCloseBtn')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    const closedByX = await evaluate(`!document.getElementById('aiChatPanel').classList.contains('open')`);
    console.log('  Closed via X:', closedByX);
    if (!closedByX) throw new Error('X button failed to close panel!');

    // TEST 8: Reopen and Close via Escape Key
    console.log('\n--- TEST 8: Close Panel via Escape Key ---');
    await evaluate(`document.getElementById('headerAiBtn')?.click()`);
    await new Promise(r => setTimeout(r, 500));
    await evaluate(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    `);
    await new Promise(r => setTimeout(r, 500));
    const closedByEsc = await evaluate(`!document.getElementById('aiChatPanel').classList.contains('open')`);
    console.log('  Closed via Escape:', closedByEsc);
    if (!closedByEsc) throw new Error('Escape key failed to close panel!');

    // TEST 9: Reopen and Close via Backdrop Click
    console.log('\n--- TEST 9: Close Panel via Backdrop Click ---');
    await evaluate(`document.getElementById('headerAiBtn')?.click()`);
    await new Promise(r => setTimeout(r, 500));
    await evaluate(`document.getElementById('aiChatBackdrop')?.click()`);
    await new Promise(r => setTimeout(r, 500));
    const closedByBackdrop = await evaluate(`!document.getElementById('aiChatPanel').classList.contains('open')`);
    console.log('  Closed via Backdrop click:', closedByBackdrop);
    if (!closedByBackdrop) throw new Error('Backdrop click failed to close panel!');

    // TEST 10: Mobile Viewport Responsiveness
    console.log('\n--- TEST 10: Mobile Viewport Responsiveness (390 x 844) ---');
    await sendCmd('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 400));

    // Open via header or mobile link
    await evaluate(`document.getElementById('headerAiBtn')?.click() || openAiChat()`);
    await new Promise(r => setTimeout(r, 600));

    const mobilePanelWidth = await evaluate(`document.getElementById('aiChatPanel').offsetWidth`);
    console.log('  Mobile Panel Width:', mobilePanelWidth);
    await captureScreenshot('6_ai_assistant_mobile_viewport.png');

    console.log('\n=============================================');
    console.log('🎉 AI Assistant Right Slide-Out Verification Finished!');
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

verifyAiAssistant();
