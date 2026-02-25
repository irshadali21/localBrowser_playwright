// utils/storage/LocalStorageAdapter.js
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const StorageAdapter = require('./StorageAdapter');

class LocalStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.storageDir = path.join(process.cwd(), 'scraped_html');
    this.ensureDirectory();
  }

  async ensureDirectory() {
    try {
      await fsPromises.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      // Directory may already exist, which is fine
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Sanitize fileId to prevent path traversal attacks
   * @param {string} fileId - The raw fileId input
   * @returns {string} - Sanitized fileId safe for use in file paths
   * @throws {Error} - If fileId is invalid or empty after sanitization
   */
  sanitizeFileId(fileId) {
    if (!fileId || typeof fileId !== 'string') {
      throw new Error('Invalid fileId: must be a non-empty string');
    }

    // Use path.basename to strip directory components (removes ../ etc.)
    let sanitized = path.basename(fileId);

    // Remove any remaining path separators and dangerous characters
    // Allow only alphanumeric, underscore, hyphen, and period
    sanitized = sanitized.replace(/[^A-Za-z0-9_.-]/g, '');

    // Reject or normalize empty results
    if (!sanitized || sanitized.length === 0) {
      throw new Error('Invalid fileId: resulting sanitized ID is empty');
    }

    // Additional check: reject if it starts with a dot (hidden files)
    if (sanitized.startsWith('.')) {
      throw new Error('Invalid fileId: cannot start with a dot');
    }

    return sanitized;
  }

  async saveHtml(fileId, html, url) {
    // Sanitize fileId to prevent path traversal
    const sanitizedId = this.sanitizeFileId(fileId);

    const timestamp = Date.now();
    const fileName = `${sanitizedId}_${timestamp}.html`;
    const filePath = path.join(this.storageDir, fileName);

    try {
      await fsPromises.writeFile(filePath, html, 'utf8');

      const stats = await fsPromises.stat(filePath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      return {
        fileId: sanitizedId,
        fileName,
        url,
        fileSizeKB: `${fileSizeKB} KB`,
        fileSizeMB: `${fileSizeMB} MB`,
        timestamp,
        storageType: 'local',
        downloadUrl: `/browser/download/${sanitizedId}`,
        viewUrl: `/browser/view/${sanitizedId}`,
        message: 'HTML saved successfully to local storage. Use downloadUrl to retrieve the file.'
      };
    } catch (error) {
      throw new Error(`Failed to save HTML: ${error.message}`);
    }
  }

  async getHtml(fileId) {
    // Sanitize fileId to prevent path traversal
    const sanitizedId = this.sanitizeFileId(fileId);

    try {
      const files = await fsPromises.readdir(this.storageDir);
      // Filter for exact version prefix (sanitizedId followed by underscore)
      const matchingFiles = files.filter(f => f.startsWith(`${sanitizedId}_`));

      if (matchingFiles.length === 0) {
        throw new Error(`HTML file not found for ID: ${sanitizedId}`);
      }

      // Select the newest file by parsing timestamp suffix from filename
      // Files are saved as: ${sanitizedId}_${timestamp}.html
      let matchingFile = matchingFiles[0];
      let newestTimestamp = 0;

      for (const file of matchingFiles) {
        // Extract timestamp from filename: "fileId_timestamp.html"
        const match = file.match(/^.+_(\d+)\.html$/);
        if (match) {
          const timestamp = parseInt(match[1], 10);
          if (timestamp > newestTimestamp) {
            newestTimestamp = timestamp;
            matchingFile = file;
          }
        }
      }

      const filePath = path.join(this.storageDir, matchingFile);
      const html = await fsPromises.readFile(filePath, 'utf8');
      const stats = await fsPromises.stat(filePath);

      return {
        fileId: sanitizedId,
        fileName: matchingFile,
        filePath,
        html,
        fileSizeBytes: stats.size,
        createdAt: stats.birthtime
      };
    } catch (error) {
      throw new Error(`Failed to get HTML: ${error.message}`);
    }
  }

  async getStats() {
    try {
      const exists = await fsPromises.access(this.storageDir).then(() => true).catch(() => false);
      if (!exists) {
        return { fileCount: 0, totalSizeMB: 0, averageSizeMB: 0, storageType: 'local' };
      }

      const files = await fsPromises.readdir(this.storageDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        const stats = await fsPromises.stat(filePath);
        totalSize += stats.size;
      }

      return {
        fileCount: files.length,
        totalSizeMB: Number((totalSize / (1024 * 1024)).toFixed(2)),
        averageSizeMB: files.length > 0 ? Number((totalSize / files.length / (1024 * 1024)).toFixed(2)) : 0,
        storageType: 'local'
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  async cleanup(maxAgeHours) {
    try {
      const exists = await fsPromises.access(this.storageDir).then(() => true).catch(() => false);
      if (!exists) {
        return { deleted: 0, message: 'Scraped HTML directory does not exist', storageType: 'local' };
      }

      const files = await fsPromises.readdir(this.storageDir);
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      let deletedCount = 0;
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.storageDir, file);
        const stats = await fsPromises.stat(filePath);
        const age = now - stats.birthtimeMs;

        if (age > maxAgeMs) {
          totalSize += stats.size;
          await fsPromises.unlink(filePath);
          deletedCount++;
          console.log(`[Cleanup] Deleted old file: ${file} (${(age / (60 * 60 * 1000)).toFixed(1)}h old)`);
        }
      }

      const freedSpaceMB = Number((totalSize / (1024 * 1024)).toFixed(2));

      return {
        deleted: deletedCount,
        freedSpaceMB: freedSpaceMB,
        remaining: files.length - deletedCount,
        storageType: 'local',
        message: `Deleted ${deletedCount} files, freed ${freedSpaceMB} MB`
      };
    } catch (error) {
      throw new Error(`Failed to cleanup: ${error.message}`);
    }
  }

  getType() {
    return 'local';
  }
}

module.exports = LocalStorageAdapter;
