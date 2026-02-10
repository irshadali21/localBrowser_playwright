// utils/storage/WordPressStorageAdapter.ts
import axios, { AxiosInstance } from 'axios';
import {
  FileMetadata,
  FileData,
  StorageStats,
  CleanupResult,
  BaseStorageAdapter,
} from './StorageAdapter';

interface WordPressConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

interface WordPressMediaItem {
  id: number;
  date: string;
  date_gmt: string;
  guid: { rendered: string };
  title: { rendered: string };
  filename: string;
  filesize: number;
  url: string;
  link: string;
  alt_text: string;
  meta: Record<string, unknown>;
}

interface WordPressUploadResponse {
  id: number;
  date: string;
  date_gmt: string;
  guid: { rendered: string };
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string; protected: boolean };
  author: number;
  featured_media: number;
  comment_status: string;
  ping_status: string;
  alt_text: string;
  caption: string;
  description: string;
  media_type: string;
  mime_type: string;
  media_details: {
    width: number;
    height: number;
    file: string;
    sizes: Record<string, unknown>;
  };
  post: number | null;
  source_url: string;
}

export class WordPressStorageAdapter extends BaseStorageAdapter {
  private client: AxiosInstance;
  private siteUrl: string;

  constructor(config: WordPressConfig) {
    super();
    this.siteUrl = config.siteUrl.replace(/\/$/, '');

    const auth = Buffer.from(`${config.username}:${config.applicationPassword}`).toString('base64');

    this.client = axios.create({
      baseURL: `${this.siteUrl}/wp-json/wp/v2`,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[WordPress] Initialized for site: ${this.siteUrl}`);
  }

  private async getMediaItemByTitle(title: string): Promise<WordPressMediaItem | null> {
    try {
      const response = await this.client.get('/media', {
        params: { search: title, per_page: 1 },
      });
      const items = response.data as WordPressMediaItem[];
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async uploadMedia(
    fileName: string,
    content: string | Buffer,
    mimeType: string
  ): Promise<WordPressUploadResponse> {
    const formData = new FormData();

    // Convert content to Blob for FormData compatibility
    const contentBlob =
      typeof content === 'string'
        ? new Blob([content], { type: mimeType })
        : (content as unknown as Blob);
    formData.append('file', contentBlob as unknown as Blob, fileName);
    formData.append('title', fileName);
    formData.append('status', 'publish');

    try {
      const response = await this.client.post(
        '/media',
        formData as unknown as Record<string, unknown>
      );
      return response.data as WordPressUploadResponse;
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(
        `WordPress upload failed: ${axiosError.response?.data?.message || axiosError.message}`
      );
    }
  }

  async saveHtml(fileId: string, html: string, url: string): Promise<FileMetadata> {
    const timestamp = Date.now();
    const fileName = `${fileId}_${timestamp}.html`;

    console.log(`[WordPress] Uploading ${fileName} (${html.length} bytes)...`);

    const existingMedia = await this.getMediaItemByTitle(fileName);
    if (existingMedia) {
      console.log(`[WordPress] Found existing media for ${fileName}, deleting...`);
      try {
        await this.client.delete(`/media/${existingMedia.id}`, { params: { force: true } });
      } catch (error) {
        console.warn('[WordPress] Failed to delete existing media, will overwrite');
      }
    }

    const uploadResponse = await this.uploadMedia(fileName, html, 'text/html');
    console.log(`[WordPress] Upload successful! Media ID: ${uploadResponse.id}`);

    const fileSizeKB = (html.length / 1024).toFixed(2);
    const fileSizeMB = (html.length / (1024 * 1024)).toFixed(2);

    return {
      fileId,
      fileName: uploadResponse.title.rendered,
      url,
      fileSizeKB: `${fileSizeKB} KB`,
      fileSizeMB: `${fileSizeMB} MB`,
      timestamp,
      storageType: 'cloud',
      cloudProvider: 'wordpress',
      cloudFileId: String(uploadResponse.id),
      shareableLink: uploadResponse.source_url,
      downloadUrl: `/browser/download/${fileId}`,
      viewUrl: `/browser/view/${fileId}`,
      message: `HTML uploaded to WordPress media library. URL: ${uploadResponse.source_url}`,
    };
  }

  async getHtml(fileId: string): Promise<FileData> {
    console.log(`[WordPress] Downloading HTML for ${fileId}...`);

    const existingMedia = await this.getMediaItemByTitle(fileId);
    if (!existingMedia) {
      throw new Error(`HTML file not found in WordPress for ID: ${fileId}`);
    }

    console.log(`[WordPress] Found media ID: ${existingMedia.id}`);

    const downloadResponse = await axios.get(existingMedia.url, {
      responseType: 'text',
    });

    return {
      fileId,
      fileName: existingMedia.filename,
      url: '',
      html: downloadResponse.data,
      fileSizeBytes: existingMedia.filesize,
      createdAt: existingMedia.date,
      storageType: 'cloud',
      cloudProvider: 'wordpress',
      cloudFileId: String(existingMedia.id),
      downloadUrl: `/browser/download/${fileId}`,
      viewUrl: `/browser/view/${fileId}`,
    };
  }

  async getStats(): Promise<StorageStats> {
    try {
      const response = await this.client.get('/media', {
        params: { per_page: 100 },
      });
      const mediaItems = response.data as WordPressMediaItem[];

      let totalSize = 0;
      mediaItems.forEach(item => {
        totalSize += item.filesize || 0;
      });

      return {
        fileCount: mediaItems.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        averageSizeMB:
          mediaItems.length > 0
            ? (totalSize / mediaItems.length / (1024 * 1024)).toFixed(2)
            : '0.00',
        storageType: 'cloud',
        cloudProvider: 'wordpress',
      };
    } catch (error) {
      const axiosError = error as { message?: string };
      console.error('[WordPress] Stats error:', axiosError.message);
      return {
        fileCount: 0,
        totalSizeBytes: 0,
        storageType: 'cloud',
        cloudProvider: 'wordpress',
        error: axiosError.message,
      };
    }
  }

  async cleanup(maxAgeHours: number): Promise<CleanupResult> {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    let deleted = 0;
    let freedBytes = 0;
    const errors: string[] = [];

    try {
      const response = await this.client.get('/media', {
        params: { per_page: 100 },
      });
      const mediaItems = response.data as WordPressMediaItem[];

      for (const item of mediaItems) {
        try {
          const itemDate = new Date(item.date).getTime();

          if (itemDate < cutoffTime) {
            console.log(`[WordPress] Deleting old media: ${item.filename} (${item.date})`);
            await this.client.delete(`/media/${item.id}`, { params: { force: true } });
            deleted++;
            freedBytes += item.filesize || 0;
          }
        } catch (error) {
          const deleteError = error as { message?: string };
          errors.push(`Failed to delete ${item.filename}: ${deleteError.message}`);
        }
      }

      const remaining = mediaItems.length - deleted;

      return {
        deleted,
        freedBytes,
        freedMB: (freedBytes / (1024 * 1024)).toFixed(2),
        remaining,
        storageType: 'cloud',
        message: `Cleanup complete: ${deleted} files deleted, ${errors.length} failed`,
      };
    } catch (error) {
      const cleanupError = error as { message?: string };
      return {
        deleted: 0,
        freedBytes: 0,
        storageType: 'cloud',
        message: `Cleanup failed: ${cleanupError.message}`,
      };
    }
  }

  getType(): string {
    return 'cloud';
  }
}

export default WordPressStorageAdapter;
