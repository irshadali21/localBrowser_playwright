// utils/pageManager.js
const db = require('./db');
const { getConfiguredPage } = require('./pageFactory');

const pages = new Map();

function updateStatusIfClosed(id) {
  const page = pages.get(id);
  if (!page || page.isClosed?.()) {
    db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(id);
    pages.delete(id);
    return true;
  }
  return false;
}

async function requestPage(type) {
  const row = db.prepare(`
    SELECT id FROM active_pages WHERE type = ? AND status = \'active\' ORDER BY last_used DESC LIMIT 1
  `).get(type);

  if (row) {
    const page = pages.get(row.id);
    const valid = page && !(await page.isClosed?.());
    if (valid) {
      db.prepare('UPDATE active_pages SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      return { id: row.id, page };
    }
    db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(row.id);
    pages.delete(row.id);
  }

  return createPage(type);
}

async function createPage(type) {
  const page = await getConfiguredPage();

  const info = db.prepare(`
    INSERT INTO active_pages (type, status, last_used) VALUES (?, 'active', CURRENT_TIMESTAMP)
  `).run(type);
  const id = info.lastInsertRowid;

  pages.set(id, page);

  page.on('close', () => {
    db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(id);
    pages.delete(id);
  });

  if (type === 'chat') await page.goto('https://gemini.google.com/app', { waitUntil: 'networkidle' });

  return { id, page };
}

function listPages() {
  db.prepare('DELETE FROM active_pages WHERE status = \'closed\'').run();
  return db.prepare('SELECT * FROM active_pages ORDER BY id').all();
}

async function closeChat() {
  const active = db.prepare('SELECT id FROM active_pages WHERE status = \'active\'').all();
  for (const { id } of active) {
    const page = pages.get(id);
    if (page && !(await page.isClosed?.())) {
      await page.close();
    }
    pages.delete(id);
    db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(id);
  }
}

function closePage(id) {
  const page = pages.get(id);
  if (page && !page.isClosed?.()) page.close();
  db.prepare('UPDATE active_pages SET status = \'closed\' WHERE id = ?').run(id);
  pages.delete(id);
}

function getPageById(id) {
  return pages.get(id);
}

function getAllPages() {
  return pages;
}

module.exports = {
  requestPage,
  listPages,
  closePage,
  updateStatusIfClosed,
  closeChat,
  getPageById,
  getAllPages
};
