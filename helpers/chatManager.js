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
    await chatGPTPage.waitForTimeout(5000);
  }

  const isLoggedOut = await chatGPTPage.locator('button[data-testid="login-button"]').count() > 0;

  if (isLoggedOut) {
    console.log('[ChatGPT] Not logged in');
    return 'Please login to ChatGPT manually.';
  }

  const input = chatGPTPage.locator('div[contenteditable="true"][id="prompt-textarea"]');
  await input.waitFor({ timeout: 1000 });
  await input.click(); // focus required
  await input.press('Control+A');
  await input.press('Backspace');

  if (prompt.includes('\n')) {
    const lines = prompt.split('\n');
    for (const line of lines) {
      await input.type(line, { delay: 100 });
      await chatGPTPage.keyboard.press('Shift+Enter');
    }
  } else {
    await input.type(prompt, { delay: 10 });
  }

  await chatGPTPage.keyboard.press('Enter'); // send once

  const response = await waitForStableResponse(chatGPTPage, 'div.markdown.prose');


  return response;
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

async function waitForStableResponse(page, selector, timeout = 40000) {
  const start = Date.now();
  let previous = '';
  let stableCounter = 0;

  while (Date.now() - start < timeout) {
    const current = await page.evaluate((sel) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return elements.at(-1)?.innerText?.trim() || '';
    }, selector);

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
