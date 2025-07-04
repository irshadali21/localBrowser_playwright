// helpers/chatManager.js
const { requestPage, closePage } = require('../utils/pageManager');

let chatPageId = null;
let chatPage = null;

let chatGPTPageId = null;
let chatGPTPage = null;
let isChatGPTClosed = false;


async function prepareChat() {
  const { page, id } = await requestPage('chat');
  chatPage = page;
  chatPageId = id;

  await dismissGeminiPopup(chatPage);

  const isLoggedOut = await chatPage.evaluate(() =>
    Array.from(document.querySelectorAll('div')).some(div =>
      div.innerText?.includes('Sign in to start saving your chats')
    )
  );

  if (isLoggedOut) {
    console.log('[Gemini] Not logged in');
    return { status: 'login_failed' };
  }

  return { status: 'ready', pageId: chatPageId };
}

async function sendChat(prompt) {
  if (!chatPage || chatPage.isClosed?.()) {
    const { page, id } = await requestPage('chat');
    chatPage = page;
    chatPageId = id;
  }

  await chatPage.locator('rich-textarea').fill(prompt);
  await chatPage.keyboard.press('Enter');

  await chatPage.waitForTimeout(10000);

  const response = await chatPage.evaluate(() => {
    const responses = Array.from(document.querySelectorAll('message-content'));
    const last = responses[responses.length - 1];
    return last?.innerText?.trim() || 'No response found.';
  });

  return response;
}

async function sendChatGPT(prompt) {
  if (!chatGPTPage || isChatGPTClosed) {
    const { page, id } = await requestPage('chatgpt');
    chatGPTPage = page;
    chatGPTPageId = id;
    isChatGPTClosed = false;

    page.on('close', () => {
      isChatGPTClosed = true;
    });

    await chatGPTPage.goto('https://chatgpt.com/', { waitUntil: 'networkidle' });
    await chatGPTPage.waitForTimeout(2000);
  }

  // 1. Watch for the response stream
  let streamDone = false;
  const onRequestFinished = (req) => {
    if (req.url().includes('/backend-api/conversation')) {
      streamDone = true;
      chatGPTPage.off('requestfinished', onRequestFinished); // clean up
    }
  };
  chatGPTPage.on('requestfinished', onRequestFinished);

  // 2. Check login
  const isLoggedOut = await chatGPTPage.locator('button[data-testid="login-button"]').count() > 0;
  if (isLoggedOut) {
    console.log('[ChatGPT] Not logged in');
    return 'Please login to ChatGPT manually.';
  }

  // 3. Type the message
  const input = chatGPTPage.locator('div[contenteditable="true"][id="prompt-textarea"]');
  await input.waitFor({ timeout: 2000 });
  await input.click();
  await input.press('Control+A');
  await input.press('Backspace');

  if (prompt.includes('\n')) {
    const lines = prompt.split('\n');
    for (const line of lines) {
      await input.type(line, { delay: 50 });
      await chatGPTPage.keyboard.press('Shift+Enter');
    }
  } else {
    await input.type(prompt, { delay: 30 });
  }

  await chatGPTPage.keyboard.press('Enter');

  // 4. Wait for the stream to finish
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('⏱ ChatGPT stream timeout'), 45000);
    const check = () => {
      if (streamDone) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });

  // 5. Wait for the last message to stabilize
  let lastResponse = '';
  let stableCount = 0;
  while (stableCount < 4) {
    const current = await chatGPTPage.evaluate(() => {
      const responses = Array.from(document.querySelectorAll('div.markdown.prose'));
      return responses.at(-1)?.innerText?.trim() || '';
    });

    if (current === lastResponse && current !== '') {
      stableCount++;
    } else {
      stableCount = 0;
      lastResponse = current;
    }

    await chatGPTPage.waitForTimeout(300); // wait ~1.2s total for stability
  }

  return lastResponse || 'No response found.';
}


async function dismissGeminiPopup(page) {
  try {
    const popup = page.locator('div[role="dialog"] button');
    if (await popup.count()) {
      for (let i = 0; i < await popup.count(); i++) {
        const text = await popup.nth(i).innerText();
        if (/no thanks|dismiss/i.test(text)) {
          await popup.nth(i).click();
          break;
        }
      }
    }
  } catch (e) {
    // silently ignore
  }
}

async function waitForStableResponse(page, selector, timeout = 400000) {
  const start = Date.now();
  let previous = '';
  let stableCounter = 0;
  console.log(start);
  console.log(previous);
  console.log(stableCounter);


  while (Date.now() - start < timeout) {
    const current = await page.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return elements.at(-1)?.innerText?.trim() || '';
    }, selector);
    console.log(current);

    if (current === previous) {
      stableCounter++;
    } else {
      stableCounter = 0;
      previous = current;
    }

    if (stableCounter >= 5) break; // content stayed the same for ~1.5s

    await page.waitForTimeout(300); // short interval
  }

  return previous || 'No response found.';
}


async function closeChat() {
  if (chatPageId) {
    closePage(chatPageId);
    chatPageId = null;
    chatPage = null;
  }
}

module.exports = {
  prepareChat,
  sendChat,
  closeChat,
  sendChatGPT
};
