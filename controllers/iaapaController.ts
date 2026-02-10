/**
 * IAAPA Controller - TypeScript migration
 * Handles scraping and downloading IAAPA expo exhibitor data
 */

import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requestPage, closePage } from '../utils/pageManager';
import type { SessionType } from '../types/browser';

/**
 * Job metadata interface
 */
interface IaapaJob {
  file: string;
  total: number;
  processed: number;
  startedAt: number;
  done: boolean;
  error: string | null;
  csvName: string | null;
  csvPath: string | null;
}

// In-memory job registry: jobId -> metadata
const jobs = new Map<string, IaapaJob>();

/**
 * Small sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random integer between min and max (inclusive)
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a randomized delay (ms) between min and max, with small jitter
 */
function randDelayMs(min = 1000, max = 3000): number {
  if (min >= max) return min;
  const base = randInt(min, max);
  // jitter ±10%
  const jitter = Math.floor(base * (Math.random() * 0.2 - 0.1));
  return Math.max(0, base + jitter);
}

/**
 * Map row columns to object
 */
function mapRow(cols: string[], row: unknown[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  cols.forEach((c, i) => (o[c] = row[i]));
  return o;
}

/**
 * Navigate to URL with retry logic
 */
async function gotoWithRetry(page: any, url: string, tries = 3, baseDelayMs = 1000): Promise<void> {
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

/**
 * Escape CSV value
 */
function esc(v: unknown): string {
  const s = String(v ?? '')
    .replace(/\r?\n/g, ' ')
    .trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Helper to get string query param
 */
function getStringQueryParam(param: unknown): string {
  if (typeof param === 'string') return param;
  if (Array.isArray(param)) return param[0] || '';
  return '';
}

/**
 * Run all IAAPA scraping jobs
 * GET /iaapa/run-all?file=iaapaexpo25.json
 */
export const runAll = async (req: Request, res: Response): Promise<void> => {
  const file = getStringQueryParam(req.query.file).trim();
  if (!file || file.includes('..') || /[\\/]/.test(file)) {
    res.status(400).json({ error: 'Invalid file' });
    return;
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
  setImmediate(() =>
    runAllWorker(jobId).catch(err => {
      const j = jobs.get(jobId);
      if (j) {
        j.error = err instanceof Error ? err.message : String(err);
        j.done = true;
        jobs.set(jobId, j);
      }
    })
  );

  res.json({ jobId });
};

/**
 * Get job status
 * GET /iaapa/status?id=<jobId>
 */
export const status = async (req: Request, res: Response): Promise<void> => {
  const id = getStringQueryParam(req.query.id).trim();
  const j = jobs.get(id);
  if (!j) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    file: j.file,
    total: j.total,
    processed: j.processed,
    done: j.done,
    error: j.error,
    csvName: j.csvName,
  });
};

/**
 * Download CSV
 * GET /iaapa/download-csv?name=<csvName>
 */
export const downloadCsv = async (req: Request, res: Response): Promise<void> => {
  const name = getStringQueryParam(req.query.name).replace(/[^a-zA-Z0-9._-]/g, '');
  // CSV is saved in the same folder as the JSON (Data/)
  const p = path.join(process.cwd(), 'Data', name);
  if (!fs.existsSync(p)) {
    res.status(404).send('Not found');
    return;
  }
  res.download(p, name);
};

/**
 * Background worker for scraping IAAPA data
 */
async function runAllWorker(jobId: string): Promise<void> {
  const j = jobs.get(jobId);
  if (!j) return;

  // Configuration: tweak these values to taste
  const RATE_LIMIT = {
    minDelayMs: 800, // minimum delay between requests
    maxDelayMs: 2200, // maximum delay between requests
    longPauseEvery: 50, // take a longer pause every N requests
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

  // Open one Playwright page
  const { page, id: pageId } = await requestPage('iaapa' as SessionType);

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

  try {
    for (let i = 0; i < ROWS.length; i++) {
      const row = mapRow(COLUMNS, ROWS[i]);
      const exhid = String(row.EXHID || row.exhid || '').trim();
      const exhname = String(row.EXHNAME || row.exhname || '').trim();
      if (!exhid) {
        j.processed++;
        jobs.set(jobId, j);
        continue;
      }

      // RATE-LIMIT: randomized delay to avoid throttling / IP blocking
      const delayMs = randDelayMs(RATE_LIMIT.minDelayMs, RATE_LIMIT.maxDelayMs);
      await sleep(delayMs);

      // occasionally take a longer break
      if (RATE_LIMIT.longPauseEvery > 0 && i > 0 && i % RATE_LIMIT.longPauseEvery === 0) {
        await sleep(RATE_LIMIT.longPauseMs + randInt(0, 2000));
      }

      const url = `https://iaapaexpo25.mapyourshow.com/8_0/exhibitor/exhibitor-details.cfm?exhid=${encodeURIComponent(exhid)}`;
      await gotoWithRetry(page, url);

      // Scrape everything we need
      const data = await page.evaluate(() => {
        const t = (el: Element | null) => (el ? el.textContent?.trim() : '');

        // Description
        let description = '';
        const descArticle = document.querySelector('article.section--description');
        if (descArticle) {
          const p = descArticle.querySelector('p');
          if (p) description = t(p) || '';
        }
        if (!description) {
          const aboutH2 = Array.from(document.querySelectorAll('h2')).find(h =>
            /about/i.test(h.textContent || '')
          );
          const p2 = aboutH2?.nextElementSibling?.querySelector?.('p');
          if (p2) description = t(p2) || '';
        }

        // Product Categories
        let productCategories: string[] = [];
        const productsArticle = document.querySelector('article.section--products');
        if (productsArticle) {
          productCategories = Array.from(productsArticle.querySelectorAll('a'))
            .map(a => a.textContent?.replace(/\s+/g, ' ').trim())
            .filter(Boolean) as string[];
        }

        // Booths
        let booths: string[] = [];
        const sidebar = document.querySelector('aside.sidebar');
        if (sidebar) {
          booths = Array.from(sidebar.querySelectorAll('ul.list__icons a'))
            .map(a => a.textContent?.replace(/\s+/g, ' ').trim())
            .filter(Boolean) as string[];
        }

        // Socials & contact
        const companyInfo =
          document.querySelector('article.section--contactinfo') ||
          document.getElementById('js-vue-contactinfo');
        const links = companyInfo ? Array.from(companyInfo.querySelectorAll('a[href]')) : [];

        // Classify links
        const pick = (pred: (href: string | null) => boolean) =>
          links.find(a => pred(a.getAttribute('href'))) || null;
        const has = (pred: (href: string | null) => boolean) => !!pick(pred);

        const isInsta = (h: string | null) => !!h && /instagram\.com/i.test(h);
        const isFb = (h: string | null) => !!h && /facebook\.com/i.test(h);
        const isTw = (h: string | null) => !!h && /(twitter\.com|x\.com)\//i.test(h);
        const isLn = (h: string | null) => !!h && /linkedin\.com/i.test(h);
        const isTel = (h: string | null) => !!h && /^tel:/i.test(h);
        const isMail = (h: string | null) => !!h && /^mailto:/i.test(h);

        // First non-social http(s) link as website
        const websiteA = links.find(a => {
          const h = a.getAttribute('href') || '';
          return /^https?:\/\//i.test(h) && !isInsta(h) && !isFb(h) && !isTw(h) && !isLn(h);
        });

        const phoneA = links.find(a => isTel(a.getAttribute('href')));
        let faxValue = '';
        const faxNode = Array.from(companyInfo?.querySelectorAll('*') || []).find(n =>
          /fax/i.test(n.textContent || '')
        );
        if (faxNode) {
          const tel = faxNode.querySelector('a[href^="tel:"]');
          if (tel) faxValue = tel.getAttribute('href')?.replace(/^tel:/i, '') || '';
        }

        const websiteValue = websiteA ? websiteA.getAttribute('href') || '' : '';
        const instagramValue = pick(isInsta)?.getAttribute('href') || '';
        const facebookValue = pick(isFb)?.getAttribute('href') || '';
        const twitterValue = pick(isTw)?.getAttribute('href') || '';
        const linkedInValue = pick(isLn)?.getAttribute('href') || '';
        const phoneValue = phoneA ? phoneA.getAttribute('href')?.replace(/^tel:/i, '') || '' : '';

        const hasWebsiteData = !!websiteValue;
        const hasTwitter = !!twitterValue;
        const hasLinkedIn = !!linkedInValue;
        const hasFacebook = !!facebookValue;
        const hasInstagram = !!instagramValue;
        const hasPhone = !!phoneValue;
        const hasFax = !!faxValue;
        const hasEmail = has(h => isMail(h));

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

      // Write CSV row
      ws.write(
        [
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
        ].join(',') + '\n'
      );

      j.processed++;
      jobs.set(jobId, j);
    }

    ws.end();
    await new Promise<void>(resolve => ws.on('close', resolve));

    j.csvName = csvName;
    j.csvPath = csvPath;
    j.done = true;
    jobs.set(jobId, j);
  } catch (err) {
    try {
      ws.end();
    } catch {
      /* ignore */
    }
    j.error = err instanceof Error ? err.message : String(err);
    j.done = true;
    jobs.set(jobId, j);
  } finally {
    try {
      closePage(pageId);
    } catch {
      /* ignore */
    }
  }
}

export default { runAll, status, downloadCsv };
