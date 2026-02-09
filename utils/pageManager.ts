/**
 * Page Manager - Manages page lifecycle, tracking, and database synchronization
 */

import type { Page } from 'playwright';
import type { SessionType, TrackedPage as TrackedPageType } from '../types/browser';
import { getConfiguredPage } from './pageFactory';
import db from './db';

const pages = new Map<number, Page>();

/**
 * Update page status in database if closed
 */
export function updateStatusIfClosed(id: number): boolean {
  const page = pages.get(id);
  if (!page || page.isClosed?.()) {
    db.prepare('UPDATE active_pages SET status = ? WHERE id = ?').run('closed', id);
    pages.delete(id);
    return true;
  }
  return false;
}

/**
 * Request an existing active page or create a new one
 */
export async function requestPage(type: SessionType): Promise<{ id: number; page: Page }> {
  // Try to find an existing active page of the requested type
  const row = db.prepare(`
    SELECT id FROM active_pages WHERE type = ? AND status = ? ORDER BY last_used DESC LIMIT 1
  `).get(type, 'active') as { id: number } | undefined;

  if (row) {
    const page = pages.get(row.id);
    const valid = page && !(await page.isClosed?.());
    if (valid) {
      // Update last used timestamp
      db.prepare('UPDATE active_pages SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      return { id: row.id, page };
    }
    // Mark stale page as closed
    db.prepare('UPDATE active_pages SET status = ? WHERE id = ?').run('closed', row.id);
    pages.delete(row.id);
  }

  return createPage(type);
}

/**
 * Create a new page and track it in the database
 */
export async function createPage(type: SessionType): Promise<{ id: number; page: Page }> {
  const page = await getConfiguredPage();

  const info = db.prepare(`
    INSERT INTO active_pages (type, status, last_used) VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(type, 'active');

  const id = Number(info.lastInsertRowid);

  pages.set(id, page);

  // Handle page close event
  page.on('close', () => {
    db.prepare('UPDATE active_pages SET status = ? WHERE id = ?').run('closed', id);
    pages.delete(id);
  });

  // Navigate chat pages to Gemini
  if (type === 'chat') {
    await page.goto('https://gemini.google.com/app', { waitUntil: 'networkidle' });
  }

  return { id, page };
}

/**
 * List all pages from database
 */
export function listPages(): TrackedPageType[] {
  // Clean up closed pages first
  db.prepare('DELETE FROM active_pages WHERE status = ?').run('closed');
  return db.prepare('SELECT * FROM active_pages ORDER BY id').all() as TrackedPageType[];
}

/**
 * Close all chat pages
 */
export async function closeChat(): Promise<void> {
  const active = db.prepare('SELECT id FROM active_pages WHERE status = ?').all('active') as { id: number }[];
  for (const { id } of active) {
    const page = pages.get(id);
    if (page && !(await page.isClosed?.())) {
      await page.close();
    }
    pages.delete(id);
    db.prepare('UPDATE active_pages SET status = ? WHERE id = ?').run('closed', id);
  }
}

/**
 * Close a specific page by ID
 */
export function closePage(id: number): void {
  const page = pages.get(id);
  if (page && !page.isClosed?.()) {
    page.close();
  }
  db.prepare('UPDATE active_pages SET status = ? WHERE id = ?').run('closed', id);
  pages.delete(id);
}

/**
 * Get a page by ID
 */
export function getPageById(id: number): Page | undefined {
  return pages.get(id);
}

// Re-export for backward compatibility
export const pageManager = {
  requestPage,
  createPage,
  closePage,
  closeChat,
  listPages,
  getPageById,
  updateStatusIfClosed,
};

export default pageManager;
