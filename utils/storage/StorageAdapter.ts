// utils/storage/StorageAdapter.ts
/**
 * Base Storage Adapter Interface
 * All storage implementations must implement these methods
 */

export interface FileMetadata {
  fileId: string;
  fileName: string;
  url: string;
  fileSizeBytes?: number;
  fileSizeKB?: string;
  fileSizeMB?: string;
  timestamp?: number;
  createdAt?: string;
  storageType: string;
  downloadUrl: string;
  viewUrl: string;
  message?: string;
  cloudProvider?: string;
  cloudFileId?: string | number;
  shareableLink?: string;
  shareableHash?: string;
  mediaUrl?: string;
  mediaLink?: string;
}

export interface FileData extends FileMetadata {
  html: string;
}

export interface StorageStats {
  fileCount: number;
  totalSizeBytes: number;
  totalSizeKB?: string;
  totalSizeMB?: string;
  averageSizeMB?: string;
  storageType: string;
  cloudProvider?: string;
  error?: string;
}

export interface CleanupResult {
  deleted: number;
  freedBytes: number;
  freedKB?: string;
  freedMB?: string;
  remaining?: number;
  storageType: string;
  message?: string;
}

export interface StorageAdapter {
  /**
   * Save HTML content to storage
   * @param fileId - Unique file identifier
   * @param html - HTML content to save
   * @param url - Original URL scraped
   * @returns Promise<FileMetadata> - File metadata
   */
  saveHtml(fileId: string, html: string, url: string): Promise<FileMetadata>;

  /**
   * Retrieve HTML content from storage
   * @param fileId - File identifier
   * @returns Promise<FileData> - File data with html content
   */
  getHtml(fileId: string): Promise<FileData>;

  /**
   * Get storage statistics
   * @returns Promise<StorageStats> - Storage stats
   */
  getStats(): Promise<StorageStats>;

  /**
   * Delete old files (only for local storage)
   * @param maxAgeHours - Delete files older than this
   * @returns Promise<CleanupResult> - Cleanup results
   */
  cleanup?(maxAgeHours: number): Promise<CleanupResult>;

  /**
   * Get storage type name
   * @returns string
   */
  getType(): string;
}

/**
 * Abstract base class for storage adapters
 */
export abstract class BaseStorageAdapter implements StorageAdapter {
  abstract saveHtml(fileId: string, html: string, url: string): Promise<FileMetadata>;
  abstract getHtml(fileId: string): Promise<FileData>;
  abstract getStats(): Promise<StorageStats>;
  abstract getType(): string;

  async cleanup(maxAgeHours: number): Promise<CleanupResult> {
    throw new Error('cleanup() not supported for this storage type');
  }
}

export default StorageAdapter;
