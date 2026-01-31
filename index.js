// index.js
const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();
const errorHandler = require('./middleware/errorHandler');


app.use(express.json());

// API Key Auth Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/iaapa')) return next();
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API Key' });
  }
  next();
});

// Routes
app.use('/chat', require('./routes/chatRoutes'));
app.use('/browser', require('./routes/browserRoutes'));
app.use('/error', require('./routes/errorRoutes'));
app.use('/pages', require('./routes/pageRoutes'));
app.use('/jobs', require('./routes/jobRoutes'));
app.use('/cron', require('./routes/cronRoutes'));
app.use('/cleanup', require('./routes/cleanupRoutes'));

app.use('/iaapa', require('./routes/iaapaRoutes'));

app.get('/', (req, res) => {
  res.json({ status: 'LocalBrowser API (Playwright) is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Playwright server running on port ${PORT}`);
  
  // Start automatic cleanup only for local storage (cloud storage doesn't need cleanup)
  const storageType = process.env.STORAGE_TYPE || 'local';
  const enableCleanup = process.env.ENABLE_LOCAL_CLEANUP !== 'false';
  
  if (storageType === 'local' && enableCleanup) {
    const { scheduleCleanup } = require('./utils/fileCleanup');
    const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 6;
    const maxAgeHours = parseInt(process.env.CLEANUP_MAX_AGE_HOURS) || 24;
    
    scheduleCleanup(intervalHours, maxAgeHours);
    console.log(`[Storage] Local file cleanup scheduled: Every ${intervalHours}h, delete files older than ${maxAgeHours}h`);
  } else {
    console.log(`[Storage] Using ${storageType} storage - automatic cleanup is ${enableCleanup ? 'disabled (cloud mode)' : 'disabled'}`);
  }
});
