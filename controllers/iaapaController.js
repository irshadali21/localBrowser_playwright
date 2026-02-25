// controllers/iaapaController.js
const fs = require('fs');
const path = require('path');
const { requestPage, closePage } = require('../utils/pageManager');


// small sleep helpers & delay config
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a randomized delay (ms) between min and max, with small jitter.
 * Example usage: const d = randDelayMs(1000, 3000);
 */
function randDelayMs(min = 1000, max = 3000) {
  if (min >= max) return min;
  const base = randInt(min, max);
  // jitter ±10%
  const jitter = Math.floor(base * (Math.random() * 0.2 - 0.1));
  return Math.max(0, base + jitter);
}


// ---------- small helpers ----------
const mapRow = (cols, row) => {
  const o = {};
  cols.forEach((c, i) => (o[c] = row[i]));
  return o;
};

async function gotoWithRetry(page, url, tries = 3, baseDelayMs = 1000) {
  for (let i = 0; i < tries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      return;
    } catch (e) {
      if (i === tries - 1) throw e;
      // exponential backoff with jitter before next try
      const backoff = Math.round(baseDelayMs * Math.pow(2, i));
      const wait = randDelayMs(backoff, backoff + 1000);
      await page.waitForTimeout(wait);
    }
  }
}


// in-memory job registry: jobId -> metadata
const jobs = new Map();

// ---------- public endpoints (tiny, background-only) ----------

// GET /iaapa/run-all?file=iaapaexpo25.json
exports.runAll = async (req, res) => {




  const file = (req.query.file || '').trim();
  if (!file || file.includes('..') || /[\\/]/.test(file)) {
    return res.status(400).json({ error: 'Invalid file' });
  }

  const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  jobs.set(jobId, {
    file,
    total: 0,
    processed: 0,
    startedAt: Date.now(),
    done: false,
    error: null,
    csvName: null,
    csvPath: null,
  });

  // fire & forget (keeps running on server)
  setImmediate(() => runAllWorker(jobId).catch(err => {
    const j = jobs.get(jobId);
    if (j) {
      j.error = err?.message || String(err);
      j.done = true;
      jobs.set(jobId, j);
    }
  }));

  res.json({ jobId });
};

// GET /iaapa/status?id=<jobId>
exports.status = async (req, res) => {
  const id = (req.query.id || '').trim();
  const j = jobs.get(id);
  if (!j) return res.status(404).json({ error: 'Not found' });
  res.json({
    file: j.file,
    total: j.total,
    processed: j.processed,
    done: j.done,
    error: j.error,
    csvName: j.csvName,
  });
};

// GET /iaapa/download-csv?name=<csvName>
exports.downloadCsv = async (req, res) => {
  const name = (req.query.name || '').replace(/[^a-zA-Z0-9._-]/g, '');
  // CSV is saved in the same folder as the JSON (Data/)
  const p = path.join(process.cwd(), 'Data', name);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.download(p, name);
};

// ---------- background worker ----------
async function runAllWorker(jobId) {
  const j = jobs.get(jobId);
  if (!j) return;

  // --- configuration: tweak these values to taste ---
  const RATE_LIMIT = {
    minDelayMs: 800,     // minimum delay between requests
    maxDelayMs: 2200,    // maximum delay between requests
    longPauseEvery: 50,  // take a longer pause every N requests
    longPauseMs: 10_000, // long pause duration (ms)
  };

  const dataDir = path.join(process.cwd(), 'Data');
  const filePath = path.join(dataDir, j.file);
  if (!fs.existsSync(filePath)) throw new Error('File not found: ' + j.file);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const COLUMNS = raw.COLUMNS || raw.columns || [];
  const ROWS = raw.DATA || raw.data || [];
  j.total = ROWS.length;
  jobs.set(jobId, j);

  // open one Playwright page
  const { page, id: pageId } = await requestPage('iaapa');

  // CSV path beside the source JSON
  const base = j.file.replace(/\.json$/i, '') || 'iaapa';
  const csvName = `${base}_all_${Date.now()}.csv`;
  const csvPath = path.join(dataDir, csvName);
  const ws = fs.createWriteStream(csvPath, { encoding: 'utf-8' });

  // CSV header (incl. social/contact fields)
  ws.write(
    [
      'exhid',
      'exhname',
      'url',
      'description',
      'product_categories',
      'booths',
      'websiteValue',
      'instagramValue',
      'facebookValue',
      'twitterValue',
      'linkedInValue',
      'phoneValue',
      'faxValue',
      'hasAddressData',
      'hasWebsiteData',
      'hasTwitter',
      'hasLinkedIn',
      'hasFacebook',
      'hasInstagram',
      'hasEmail',
      'hasPhone',
      'hasFax',
    ].join(',') + '\n'
  );

  const esc = (v) => {
    const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  try {
    for (let i = 0; i < ROWS.length; i++) {
      const row = mapRow(COLUMNS, ROWS[i]);
      const exhid = String(row.EXHID || row.exhid || '').trim();
      const exhname = String(row.EXHNAME || row.exhname || '').trim();
      if (!exhid) {
        j.processed++; jobs.set(jobId, j); continue;
      }

      // RATE-LIMIT: randomized delay to avoid throttling / IP blocking
      // If you want to skip the initial delay on first item, you can check i>0
      const delayMs = randDelayMs(RATE_LIMIT.minDelayMs, RATE_LIMIT.maxDelayMs);
      await sleep(delayMs);

      // occasionally take a longer break (helps avoid rate-limiter windows)
      if (RATE_LIMIT.longPauseEvery > 0 && i > 0 && i % RATE_LIMIT.longPauseEvery === 0) {
        await sleep(RATE_LIMIT.longPauseMs + randInt(0, 2000));
      }

      const url = `https://iaapaexpo25.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=${encodeURIComponent(exhid)}`;
      await gotoWithRetry(page, url);

      // --- scrape everything we need ---
      const data = await page.evaluate(() => {
        const t = (el) => (el ? el.textContent.trim() : '');

        // Description (robust against nesting)
        let description = '';
        const descArticle = document.querySelector('article.section--description');
        if (descArticle) {
          const p = descArticle.querySelector('p');
          if (p) description = t(p);
        }
        if (!description) {
          const aboutH2 = Array.from(document.querySelectorAll('h2')).find(h => /about/i.test(h.textContent));
          const p2 = aboutH2?.nextElementSibling?.querySelector?.('p');
          if (p2) description = t(p2);
        }

        // Product Categories
        let productCategories = [];
        const productsArticle = document.querySelector('article.section--products');
        if (productsArticle) {
          productCategories = Array.from(productsArticle.querySelectorAll('a'))
            .map(a => a.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
        }

        // Booths (sidebar)
        let booths = [];
        const sidebar = document.querySelector('aside.sidebar');
        if (sidebar) {
          booths = Array.from(sidebar.querySelectorAll('ul.list__icons a'))
            .map(a => a.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
        }

        // Socials & contact (within Company Information)
        const companyInfo = document.querySelector('article.section--contactinfo') || document.getElementById('js-vue-contactinfo');
        const links = companyInfo ? Array.from(companyInfo.querySelectorAll('a[href]')) : [];

        // classify links
        const pick = (pred) => (links.find(a => pred(a.getAttribute('href'))) || null);
        const has = (pred) => !!pick(pred);

        const isInsta = (h) => !!h && /instagram\.com/i.test(h);
        const isFb = (h) => !!h && /facebook\.com/i.test(h);
        const isTw = (h) => !!h && /(twitter\.com|x\.com)\//i.test(h);
        const isLn = (h) => !!h && /linkedin\.com/i.test(h);
        const isTel = (h) => !!h && /^tel:/i.test(h);
        const isMail = (h) => !!h && /^mailto:/i.test(h);

        // first non-social http(s) link as website (best effort)
        const websiteA = links.find(a => {
          const h = a.getAttribute('href') || '';
          return /^https?:\/\//i.test(h) && !isInsta(h) && !isFb(h) && !isTw(h) && !isLn(h);
        });

        const phoneA = links.find(a => isTel(a.getAttribute('href')));
        // Fax sometimes not a tel link; look for text "Fax" nearby
        let faxValue = '';
        const faxNode = Array.from(companyInfo?.querySelectorAll('*') || []).find(n => /fax/i.test(n.textContent || ''));
        if (faxNode) {
          const tel = faxNode.querySelector('a[href^="tel:"]');
          if (tel) faxValue = tel.getAttribute('href').replace(/^tel:/i, '');
        }

        // build social/contact object
        const websiteValue = websiteA ? websiteA.getAttribute('href') : '';
        const instagramValue = (pick(isInsta)?.getAttribute('href')) || '';
        const facebookValue = (pick(isFb)?.getAttribute('href')) || '';
        const twitterValue = (pick(isTw)?.getAttribute('href')) || '';
        const linkedInValue = (pick(isLn)?.getAttribute('href')) || '';
        const phoneValue = phoneA ? phoneA.getAttribute('href').replace(/^tel:/i, '') : '';

        // booleans
        const hasWebsiteData = !!websiteValue;
        const hasTwitter = !!twitterValue;
        const hasLinkedIn = !!linkedInValue;
        const hasFacebook = !!facebookValue;
        const hasInstagram = !!instagramValue;
        const hasPhone = !!phoneValue;
        const hasFax = !!faxValue;

        // email sometimes appears
        const hasEmail = has(h => isMail(h));

        // address presence (best effort: any address-like block)
        let hasAddressData = false;
        const addr = companyInfo?.querySelector('.column-wrapper') || companyInfo;
        if (addr) {
          hasAddressData = /address|city|state|zip|country/i.test(addr.textContent || '');
        }

        return {
          description,
          productCategories,
          booths,
          websiteValue,
          instagramValue,
          facebookValue,
          twitterValue,
          linkedInValue,
          phoneValue,
          faxValue,
          hasAddressData,
          hasWebsiteData,
          hasTwitter,
          hasLinkedIn,
          hasFacebook,
          hasInstagram,
          hasEmail,
          hasPhone,
          hasFax,
        };
      });

      // write CSV row
      ws.write([
        esc(exhid),
        esc(exhname),
        esc(url),
        esc(data.description || ''),
        esc((data.productCategories || []).join(' | ')),
        esc((data.booths || []).join(' | ')),
        esc(data.websiteValue || ''),
        esc(data.instagramValue || ''),
        esc(data.facebookValue || ''),
        esc(data.twitterValue || ''),
        esc(data.linkedInValue || ''),
        esc(data.phoneValue || ''),
        esc(data.faxValue || ''),
        esc(data.hasAddressData),
        esc(data.hasWebsiteData),
        esc(data.hasTwitter),
        esc(data.hasLinkedIn),
        esc(data.hasFacebook),
        esc(data.hasInstagram),
        esc(data.hasEmail),
        esc(data.hasPhone),
        esc(data.hasFax),
      ].join(',') + '\n');

      j.processed++;
      jobs.set(jobId, j);
    }

    ws.end();
    await new Promise(r => ws.on('close', r));

    j.csvName = csvName;
    j.csvPath = csvPath;
    j.done = true;
    jobs.set(jobId, j);
  } catch (err) {
    try { ws.end(); } catch { }
    j.error = err?.message || String(err);
    j.done = true;
    jobs.set(jobId, j);
  } finally {
    try { closePage(pageId); } catch { }
  }
}
