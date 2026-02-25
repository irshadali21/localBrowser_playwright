// utils/storage/LocalStorageAdapter.js
const fs = require('fs');
const path = require('path');
const StorageAdapter = require('./StorageAdapter');

class LocalStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.storageDir = path.join(process.cwd(), 'scraped_html');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async saveHtml(fileId, html, url) {
    const timestamp = Date.now();
    const fileName = `${fileId}_${timestamp}.html`;
    const filePath = path.join(this.storageDir, fileName);

    fs.writeFileSync(filePath, html, 'utf8');

    const stats = fs.statSync(filePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    return {
      fileId,
      fileName,
      url,
      fileSizeKB: `${fileSizeKB} KB`,
      fileSizeMB: `${fileSizeMB} MB`,
      timestamp,
      storageType: 'local',
      downloadUrl: `/browser/download/${fileId}`,
      viewUrl: `/browser/view/${fileId}`,
      message: 'HTML saved successfully to local storage. Use downloadUrl to retrieve the file.'
    };
  }

  async getHtml(fileId) {
    const files = fs.readdirSync(this.storageDir);
    const matchingFile = files.find(f => f.startsWith(fileId));

    if (!matchingFile) {
      throw new Error(`HTML file not found for ID: ${fileId}`);
    }

    const filePath = path.join(this.storageDir, matchingFile);
    const html = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);

    return {
      fileId,
      fileName: matchingFile,
      filePath,
      html,
      fileSizeBytes: stats.size,
      createdAt: stats.birthtime
    };
  }

  async getStats() {
    if (!fs.existsSync(this.storageDir)) {
      return { fileCount: 0, totalSizeMB: 0, averageSizeMB: 0, storageType: 'local' };
    }

    const files = fs.readdirSync(this.storageDir);
    let totalSize = 0;

    files.forEach(file => {
      const filePath = path.join(this.storageDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });

    return {
      fileCount: files.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      averageSizeMB: files.length > 0 ? (totalSize / files.length / (1024 * 1024)).toFixed(2) : 0,
      storageType: 'local'
    };
  }

  async cleanup(maxAgeHours) {
    if (!fs.existsSync(this.storageDir)) {
      return { deleted: 0, message: 'Scraped HTML directory does not exist', storageType: 'local' };
    }

    const files = fs.readdirSync(this.storageDir);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    let deletedCount = 0;
    let totalSize = 0;

    files.forEach(file => {
      const filePath = path.join(this.storageDir, file);
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
      storageType: 'local',
      message: `Deleted ${deletedCount} files, freed ${totalSizeMB} MB`
    };
  }

  getType() {
    return 'local';
  }
}

module.exports = LocalStorageAdapter;
