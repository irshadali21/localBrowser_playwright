/**
 * Chat Manager - Chat functionality for Gemini and ChatGPT
 */

import type { Page } from 'playwright';
import { requestPage } from '../utils/pageManager';

/**
 * Chat preparation result
 */
export interface ChatPrepareResult {
  status: 'ready' | 'login_failed';
  pageId?: number;
}

/**
 * Chat response result
 */
export interface ChatResponseResult {
  response: string;
  pageId?: number;
}

// Module-level state (for backward compatibility)
let chatPageId: number | null = null;
let chatPage: Page | null = null;

let chatGPTPageId: number | null = null;
let chatGPTPage: Page | null = null;
let isChatGPTClosed = false;

/**
 * Prepare chat page for Gemini
 */
export async function prepareChat(): Promise<ChatPrepareResult> {
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

/**
 * Send message to Gemini
 */
export async function sendChat(prompt: string): Promise<string> {
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
    return (last as HTMLElement)?.innerText?.trim() || 'No response found.';
  });

  return response;
}

/**
 * Send message to ChatGPT
 */
export async function sendChatGPT(prompt: string): Promise<string> {
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
  const onRequestFinished = (req: { url: () => string }) => {
    if (req.url().includes('/backend-api/conversation')) {
      streamDone = true;
      chatGPTPage?.off('requestfinished', onRequestFinished);
    }
  };
  chatGPTPage?.on('requestfinished', onRequestFinished);

  // 2. Check login
  const isLoggedOut = (await chatGPTPage.locator('button[data-testid="login-button"]').count()) > 0;
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
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ChatGPT stream timeout')), 45000);
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
      return (responses.at(-1) as HTMLElement)?.innerText?.trim() || '';
    });

    if (current === lastResponse && current !== '') {
      stableCount++;
    } else {
      stableCount = 0;
      lastResponse = current;
    }

    await chatGPTPage.waitForTimeout(300);
  }

  return lastResponse || 'No response found.';
}

/**
 * Dismiss Gemini popup
 */
async function dismissGeminiPopup(page: Page): Promise<void> {
  try {
    const popup = page.locator('div[role="dialog"] button');
    if (await popup.count()) {
      for (let i = 0; i < (await popup.count()); i++) {
        const text = await popup.nth(i).innerText();
        if (/no thanks|dismiss/i.test(text)) {
          await popup.nth(i).click();
          break;
        }
      }
    }
  } catch {
    // silently ignore
  }
}

/**
 * Wait for stable response from chat
 */
export async function waitForStableResponse(
  page: Page,
  selector: string,
  timeout: number = 400000
): Promise<string> {
  const start = Date.now();
  let previous = '';
  let stableCounter = 0;

  while (Date.now() - start < timeout) {
    const current = await page.evaluate((sel: string) => {
      const elements = Array.from(document.querySelectorAll(sel));
      return (elements.at(-1) as HTMLElement)?.innerText?.trim() || '';
    }, selector);

    if (current === previous) {
      stableCounter++;
    } else {
      stableCounter = 0;
      previous = current;
    }

    if (stableCounter >= 5) break;

    await page.waitForTimeout(300);
  }

  return previous || 'No response found.';
}

/**
 * Close chat page
 */
export async function closeChat(): Promise<void> {
  if (chatPageId) {
    const { closePage } = await import('../utils/pageManager');
    closePage(chatPageId);
    chatPageId = null;
    chatPage = null;
  }
}

export default {
  prepareChat,
  sendChat,
  closeChat,
  sendChatGPT,
  waitForStableResponse,
};
