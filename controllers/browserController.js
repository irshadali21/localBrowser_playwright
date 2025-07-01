// controllers/browserController.js
const {
  executeCode,
  googleSearch,
  visitUrl,
  scrapeProduct
} = require('../helpers/browserHelper');

const { logErrorToDB } = require('../utils/errorLogger');

// POST /browser/execute
exports.execute = async (req, res, next) => {
  try {
    const result = await executeCode(req.body.code || '');
    res.json({ result });
  } catch (err) {
    console.error('[BrowserController] Execute error:', err);
    logErrorToDB({
      type: 'EXECUTE_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/browser/execute',
      input: req.body
    });
    next(err);
  }
};

// GET /browser/search?q=...
exports.search = async (req, res, next) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const results = await googleSearch(query);
    res.json({ results });
  } catch (err) {
    console.error('[BrowserController] Search error:', err);
    logErrorToDB({
      type: 'SEARCH_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/browser/search',
      input: req.query
    });
    next(err);
  }
};

// GET /browser/visit?url=...
exports.visit = async (req, res, next) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const html = await visitUrl(url);
    res.json({ html });
  } catch (err) {
    console.error('[BrowserController] Visit error:', err);
    logErrorToDB({
      type: 'VISIT_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/browser/visit',
      input: req.query
    });
    next(err);
  }
};

// GET /browser/scrape?url=...&vendor=...
exports.scrape = async (req, res, next) => {
  const { url, vendor } = req.query;
  if (
    !url || typeof url !== 'string' || !/^https?:\/\//.test(url) ||
    !vendor || typeof vendor !== 'string' || vendor.trim() === ''
  ) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const data = await scrapeProduct(url, vendor);
    res.json(data);
  } catch (err) {
    console.error('[BrowserController] Scrape error:', err);
    logErrorToDB({
      type: 'SCRAPE_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/browser/scrape',
      input: req.query
    });
    next(err);
  }
};
