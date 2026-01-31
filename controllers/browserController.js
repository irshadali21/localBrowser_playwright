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

// GET /browser/visit?url=...&returnHtml=false&waitUntil=networkidle
exports.visit = async (req, res, next) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const options = {
      returnHtml: req.query.returnHtml === 'true',
      saveToFile: req.query.saveToFile !== 'false',  // Default true
      waitUntil: req.query.waitUntil || 'networkidle',
      timeout: parseInt(req.query.timeout) || 60000
    };

    const result = await visitUrl(url, options);
    
    // If returnHtml is true, result is a string (backward compatible)
    if (typeof result === 'string') {
      return res.json({ html: result });
    }
    
    // Otherwise, result is metadata object
    res.json(result);
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

// GET /browser/download/:fileId
exports.download = async (req, res, next) => {
  const { fileId } = req.params;
  
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  try {
    const { getHtmlFile } = require('../helpers/browserHelper');
    const fileData = await getHtmlFile(fileId);
    
    // Send as downloadable file
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.html);
  } catch (err) {
    console.error('[BrowserController] Download error:', err);
    logErrorToDB({
      type: 'DOWNLOAD_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/browser/download',
      input: req.params
    });
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

// GET /browser/view/:fileId
exports.view = async (req, res, next) => {
  const { fileId } = req.params;
  
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  try {
    const { getHtmlFile } = require('../helpers/browserHelper');
    const fileData = await getHtmlFile(fileId);
    
    // Return HTML as JSON
    res.json({
      fileId: fileData.fileId,
      fileName: fileData.fileName,
      html: fileData.html,
      fileSizeBytes: fileData.fileSizeBytes,
      createdAt: fileData.createdAt
    });
  } catch (err) {
    console.error('[BrowserController] View error:', err);
    logErrorToDB({
      type: 'VIEW_FAILED',
      message: err.message,
      stack: err.stack,
      route: '/browser/view',
      input: req.params
    });
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
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
