// controllers/browserController.js
const {
  executeCode,
  googleSearch,
  visitUrl,
  scrapeProduct,
  getHtmlFile
} = require('../helpers/browserHelper');
const { logErrorToDB } = require('../utils/errorLogger');

// Helper for consistent error handling
const withErrorHandler = (controllerName, route, type) => (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[${controllerName}] ${type.toLowerCase().replace('_', ' ')} error:`, err);
    logErrorToDB({ type, message: err.message, stack: err.stack, route, input: req.body || req.query || req.params });
    next(err);
  }
};

// POST /browser/execute
exports.execute = withErrorHandler('BrowserController', '/browser/execute', 'EXECUTE_FAILED')(async (req, res) => {
  const result = await executeCode(req.body.code || '');
  res.json({ result });
});

// GET /browser/search?q=...
exports.search = withErrorHandler('BrowserController', '/browser/search', 'SEARCH_FAILED')(async (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  const results = await googleSearch(query);
  res.json({ results });
});

// GET /browser/visit?url=...&returnHtml=false&waitUntil=networkidle
exports.visit = withErrorHandler('BrowserController', '/browser/visit', 'VISIT_FAILED')(async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  const options = {
    returnHtml: req.query.returnHtml === 'true',
    saveToFile: req.query.saveToFile !== 'false',
    waitUntil: req.query.waitUntil || 'networkidle',
    timeout: parseInt(req.query.timeout) || 60000
  };
  const result = await visitUrl(url, options);
  if (typeof result === 'string') return res.json({ html: result });
  res.json(result);
});

// GET /browser/download/:fileId
exports.download = withErrorHandler('BrowserController', '/browser/download', 'DOWNLOAD_FAILED')(async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  try {
    const fileData = await getHtmlFile(fileId);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.html);
  } catch (err) {
    err.status = 404;
    logErrorToDB(err);
    next(err);
  }
});

// GET /browser/view/:fileId
exports.view = withErrorHandler('BrowserController', '/browser/view', 'VIEW_FAILED')(async (req, res) => {
  const { fileId } = req.params;
  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }
  try {
    const fileData = await getHtmlFile(fileId);
    res.json({
      fileId: fileData.fileId,
      fileName: fileData.fileName,
      html: fileData.html,
      fileSizeBytes: fileData.fileSizeBytes,
      createdAt: fileData.createdAt
    });
  } catch (err) {
    err.status = 404;
    logErrorToDB(err);
    next(err);
  }
});

// GET /browser/scrape?url=...&vendor=...
exports.scrape = withErrorHandler('BrowserController', '/browser/scrape', 'SCRAPE_FAILED')(async (req, res) => {
  const { url, vendor } = req.query;
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url) ||
      !vendor || typeof vendor !== 'string' || vendor.trim() === '') {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  const data = await scrapeProduct(url, vendor);
  res.json(data);
});
