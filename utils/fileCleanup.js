// utils/fileCleanup.js
const fs = require('fs');
const path = require('path');

/**
 * Clean up old scraped HTML files
 * @param {number} maxAgeHours - Delete files older than this many hours
 * @returns {Object} Cleanup statistics
 */
function cleanupOldFiles(maxAgeHours = 24) {
  const scrapedDir = path.join(process.cwd(), 'scraped_html');
  
  if (!fs.existsSync(scrapedDir)) {
    return { deleted: 0, message: 'Scraped HTML directory does not exist' };
  }

  const files = fs.readdirSync(scrapedDir);
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  let deletedCount = 0;
  let totalSize = 0;

  files.forEach(file => {
    const filePath = path.join(scrapedDir, file);
    const stats = fs.statSync(filePath);
    const age = now - stats.birthtimeMs;

    if (age > maxAgeMs) {
      totalSize += stats.size;
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`[Cleanup] Deleted old file: ${file} (${(age / (60 * 60 * 1000)).toFixed(1)}h old)`);
    }
  });

  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  return {
    deleted: deletedCount,
    freedSpaceMB: totalSizeMB,
    remaining: files.length - deletedCount,
    message: `Deleted ${deletedCount} files, freed ${totalSizeMB} MB`
  };
}

/**
 * Get statistics about stored files
 */
function getStorageStats() {
  const scrapedDir = path.join(process.cwd(), 'scraped_html');
  
  if (!fs.existsSync(scrapedDir)) {
    return { fileCount: 0, totalSizeMB: 0, message: 'No files stored' };
  }

  const files = fs.readdirSync(scrapedDir);
  let totalSize = 0;

  files.forEach(file => {
    const filePath = path.join(scrapedDir, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
  });

  return {
    fileCount: files.length,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    averageSizeMB: files.length > 0 ? (totalSize / files.length / (1024 * 1024)).toFixed(2) : 0
  };
}

/**
 * Schedule automatic cleanup every N hours
 * @param {number} intervalHours - Run cleanup every N hours
 * @param {number} maxAgeHours - Delete files older than N hours
 */
function scheduleCleanup(intervalHours = 6, maxAgeHours = 24) {
  console.log(`[Cleanup] Scheduling automatic cleanup every ${intervalHours} hours for files older than ${maxAgeHours} hours`);
  
  // Run immediately
  cleanupOldFiles(maxAgeHours);
  
  // Then schedule periodic cleanup
  setInterval(() => {
    console.log('[Cleanup] Running scheduled cleanup...');
    const result = cleanupOldFiles(maxAgeHours);
    console.log('[Cleanup]', result.message);
  }, intervalHours * 60 * 60 * 1000);
}

module.exports = {
  cleanupOldFiles,
  getStorageStats,
  scheduleCleanup
};
