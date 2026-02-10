/**
 * Browser Controller - TypeScript migration
 * Handles all browser automation API endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import type {
  BrowserHelper,
  VisitOptions,
  SearchResult,
  VisitResult,
} from '../types/browser';
import { validateInput, visitUrlSchema, executeCodeSchema, googleSearchSchema } from '../validators/schemas';
import { ValidationError } from '../types/errors';
import { logErrorToDB } from '../utils/errorLogger';

// Import browser helper (dynamically to avoid circular deps)
let browserHelper: BrowserHelper;
async function getBrowserHelper(): Promise<BrowserHelper> {
  if (!browserHelper) {
    const module = await import('../helpers/browserHelper');
    browserHelper = module.browserHelper || module.default || module;
  }
  return browserHelper;
}

/**
 * POST /browser/execute
 * Execute arbitrary JavaScript code in browser context
 */
export async function execute(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Validate input
  const validation = validateInput(executeCodeSchema, req.body);
  if (!validation.success) {
    throw new ValidationError('Invalid request body', {
      errors: validation.errors.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  try {
    const helper = await getBrowserHelper();
    const result = await helper.executeCode(req.body.code);
    res.json({ result });
  } catch (err) {
    console.error('[BrowserController] Execute error:', err);
    await logErrorToDB({
      type: 'EXECUTE_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/execute',
      input: req.body,
    });
    next(err);
  }
}

/**
 * GET /browser/search?q=...
 * Perform Google search and return results
 */
export async function search(
  req: Request<{}, {}, {}, { q?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const query = req.query.q;

  // Validate query
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new ValidationError('Search query is required', { field: 'q' });
  }

  try {
    const helper = await getBrowserHelper();
    const results = await helper.googleSearch(query);
    res.json({ results });
  } catch (err) {
    console.error('[BrowserController] Search error:', err);
    await logErrorToDB({
      type: 'SEARCH_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/search',
      input: req.query,
    });
    next(err);
  }
}

/**
 * GET /browser/visit?url=...
 * Navigate to URL and optionally save HTML
 */
export async function visit(
  req: Request<{}, {}, {}, VisitQueryParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const url = req.query.url;

  // Validate URL
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new ValidationError('Valid URL (http/https) is required', { field: 'url' });
  }

  // Parse options
  const options: VisitOptions = {
    returnHtml: req.query.returnHtml === 'true',
    saveToFile: req.query.saveToFile !== 'false',
    waitUntil: (req.query.waitUntil as VisitOptions['waitUntil']) || 'networkidle',
    timeout: parseInt(req.query.timeout || '60000', 10),
    handleCloudflare: req.query.handleCloudflare !== 'false',
    useProgressiveRetry: req.query.useProgressiveRetry !== 'false',
  };

  try {
    const helper = await getBrowserHelper();
    const result = await helper.visitUrl(url, options);

    // If returnHtml is true, result is a string
    if (typeof result === 'string') {
      res.json({ html: result });
      return;
    }

    // Otherwise return metadata object
    res.json(result);
  } catch (err) {
    console.error('[BrowserController] Visit error:', err);
    await logErrorToDB({
      type: 'VISIT_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/visit',
      input: req.query,
    });
    next(err);
  }
}

/**
 * GET /browser/download/:fileId
 * Download saved HTML file
 */
export async function download(
  req: Request<{ fileId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { fileId } = req.params;

  if (!fileId || typeof fileId !== 'string') {
    throw new ValidationError('Invalid file ID', { field: 'fileId' });
  }

  try {
    const { getHtmlFile } = await import('../helpers/browserHelper');
    const fileData = await getHtmlFile(fileId);

    // Send as downloadable file
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.html);
  } catch (err) {
    console.error('[BrowserController] Download error:', err);
    await logErrorToDB({
      type: 'DOWNLOAD_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/download',
      input: req.params,
    });
    if ((err as Error).message.includes('not found')) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
}

/**
 * GET /browser/view/:fileId
 * View saved HTML file metadata and content
 */
export async function view(
  req: Request<{ fileId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { fileId } = req.params;

  if (!fileId || typeof fileId !== 'string') {
    throw new ValidationError('Invalid file ID', { field: 'fileId' });
  }

  try {
    const { getHtmlFile } = await import('../helpers/browserHelper');
    const fileData = await getHtmlFile(fileId);
    res.json(fileData);
  } catch (err) {
    console.error('[BrowserController] View error:', err);
    await logErrorToDB({
      type: 'VIEW_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/view',
      input: req.params,
    });
    if ((err as Error).message.includes('not found')) {
      res.status(404).json({ error: (err as Error).message });
      return;
    }
    next(err);
  }
}

// Type definitions for query parameters
interface VisitQueryParams {
  url?: string;
  returnHtml?: string;
  saveToFile?: string;
  waitUntil?: string;
  timeout?: string;
  handleCloudflare?: string;
  useProgressiveRetry?: string;
}

interface ScrapeQueryParams {
  url?: string;
  vendor?: string;
}

/**
 * GET /browser/scrape?url=...&vendor=...
 * Scrape product data from a URL
 */
export async function scrape(
  req: Request<{}, {}, {}, ScrapeQueryParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { url, vendor } = req.query;

  // Validate parameters
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    throw new ValidationError('Valid URL (http/https) is required', { field: 'url' });
  }

  if (!vendor || typeof vendor !== 'string' || vendor.trim() === '') {
    throw new ValidationError('Vendor parameter is required', { field: 'vendor' });
  }

  try {
    const helper = await getBrowserHelper();
    const data = await helper.scrapeProduct(url, vendor);
    res.json(data);
  } catch (err) {
    console.error('[BrowserController] Scrape error:', err);
    await logErrorToDB({
      type: 'SCRAPE_FAILED',
      message: (err as Error).message,
      stack: (err as Error).stack,
      route: '/browser/scrape',
      input: req.query,
    });
    next(err);
  }
}

export default {
  execute,
  search,
  visit,
  download,
  view,
  scrape,
};
