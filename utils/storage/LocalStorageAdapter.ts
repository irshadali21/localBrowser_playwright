// utils/storage/LocalStorageAdapter.ts
import fs from 'fs';
import path from 'path';
import {
  FileMetadata,
  FileData,
  StorageStats,
  CleanupResult,
  BaseStorageAdapter,
} from './StorageAdapter';

export class LocalStorageAdapter extends BaseStorageAdapter {
  private storageDir: string;

  constructor() {
    super();
    this.storageDir = path.join(process.cwd(), 'scraped_html');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async saveHtml(fileId: string, html: string, url: string): Promise<FileMetadata> {
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
      message: 'HTML saved successfully to local storage. Use downloadUrl to retrieve the file.',
    };
  }

  async getHtml(fileId: string): Promise<FileData> {
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
      url: '',
      html,
      fileSizeBytes: stats.size,
      createdAt: stats.birthtimeMs.toString(),
      storageType: 'local',
      downloadUrl: `/browser/download/${fileId}`,
      viewUrl: `/browser/view/${fileId}`,
    };
  }

  async getStats(): Promise<StorageStats> {
    if (!fs.existsSync(this.storageDir)) {
      return { fileCount: 0, totalSizeBytes: 0, storageType: 'local' };
    }

    const files = fs.readdirSync(this.storageDir);
    let totalSize = 0;

    files.forEach(file => {
      const filePath = path.join(this.storageDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });

    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const averageSizeMB =
      files.length > 0 ? (totalSize / files.length / (1024 * 1024)).toFixed(2) : '0.00';

    return {
      fileCount: files.length,
      totalSizeBytes: totalSize,
      totalSizeMB,
      averageSizeMB,
      storageType: 'local',
    };
  }

  async cleanup(maxAgeHours: number): Promise<CleanupResult> {
    if (!fs.existsSync(this.storageDir)) {
      return {
        deleted: 0,
        freedBytes: 0,
        storageType: 'local',
        message: 'Scraped HTML directory does not exist',
      };
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
        console.log(
          `[Cleanup] Deleted old file: ${file} (${(age / (60 * 60 * 1000)).toFixed(1)}h old)`
        );
      }
    });

    const freedMB = (totalSize / (1024 * 1024)).toFixed(2);

    return {
      deleted: deletedCount,
      freedBytes: totalSize,
      freedMB: `${freedMB} MB`,
      storageType: 'local',
      message: `Deleted ${deletedCount} files, freed ${freedMB} MB`,
    };
  }

  getType(): string {
    return 'local';
  }
}

export default LocalStorageAdapter;
