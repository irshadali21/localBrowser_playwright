// utils/storage/BedriveStorageAdapter.ts
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import {
  FileMetadata,
  FileData,
  StorageStats,
  CleanupResult,
  BaseStorageAdapter,
} from './StorageAdapter';

interface BedriveConfig {
  url: string;
  apiKey: string;
  folderId?: string | null;
}

interface BedriveShareableLink {
  link?: string;
  hash?: string;
}

interface BedriveFileEntry {
  id: string;
  name: string;
  file_size?: number;
  created_at?: string;
  link?: string;
  hash?: string;
}

export class BedriveStorageAdapter extends BaseStorageAdapter {
  private baseUrl: string;
  private apiKey: string;
  private folderId: string | null;
  private client: AxiosInstance;

  constructor(config: BedriveConfig) {
    super();
    this.baseUrl = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.folderId = config.folderId || null;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    console.log(`[BeDrive] Initialized with URL: ${this.baseUrl}`);
    console.log(`[BeDrive] Using folder ID: ${this.folderId || 'root'}`);
  }

  private async ensureFolder(): Promise<string | null> {
    try {
      if (this.folderId) {
        console.log(`[BeDrive] Using existing folder ID: ${this.folderId}`);
        return this.folderId;
      }
      console.log('[BeDrive] Using root folder');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[BeDrive] Error ensuring folder:', message);
      throw new Error(`BeDrive folder error: ${message}`);
    }
  }

  async saveHtml(fileId: string, html: string, url: string): Promise<FileMetadata> {
    try {
      const timestamp = Date.now();
      const fileName = `${fileId}_${timestamp}.html`;

      const parentId = await this.ensureFolder();
      const buffer = Buffer.from(html, 'utf8');
      const fileSizeBytes = buffer.length;

      const formData = new FormData();
      formData.append('file', buffer, {
        filename: fileName,
        contentType: 'text/html',
      });
      if (parentId) {
        formData.append('parentId', parentId);
      }

      console.log(
        `[BeDrive] Uploading ${fileName} (${fileSizeBytes} bytes) to folder ${parentId || 'root'}...`
      );

      const uploadResponse = await this.client.post('/uploads', formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const file =
        (uploadResponse.data as { fileEntry?: BedriveFileEntry }).fileEntry ||
        (uploadResponse.data as BedriveFileEntry);
      console.log(`[BeDrive] Upload successful! File ID: ${file.id}`);

      // Get or create shareable link
      let shareableInfo: BedriveShareableLink | null = null;
      try {
        console.log(`[BeDrive] Fetching shareable link for file ID: ${file.id}...`);
        const linkResponse = await this.client.get(`/file-entries/${file.id}/shareable-link`);
        const linkData = linkResponse.data as BedriveShareableLink;
        shareableInfo = linkData;

        if (!shareableInfo?.link) {
          console.log(`[BeDrive] No shareable link exists, creating new one...`);
          const createLinkResponse = await this.client.post(
            `/file-entries/${file.id}/shareable-link`,
            {
              allow_download: true,
              allow_edit: false,
            }
          );
          const createLinkData = createLinkResponse.data as BedriveShareableLink;
          shareableInfo = createLinkData;
          console.log(`[BeDrive] Created shareable link:`, shareableInfo);
        } else {
          console.log(`[BeDrive] Found existing link:`, shareableInfo);
        }
      } catch (error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          console.log(`[BeDrive] No shareable link found (404), creating new one...`);
          try {
            const createLinkResponse = await this.client.post(
              `/file-entries/${file.id}/shareable-link`,
              {
                allow_download: true,
                allow_edit: false,
              }
            );
            const createLinkData = createLinkResponse.data as BedriveShareableLink;
            shareableInfo = createLinkData;
            console.log(`[BeDrive] Created shareable link:`, shareableInfo);
          } catch (createError) {
            const createErr = createError as { response?: { data?: unknown } };
            console.error(`[BeDrive] Failed to create shareable link:`, createErr.response?.data);
          }
        } else {
          const axiosErr = error as { response?: { status?: number; data?: unknown } };
          console.warn(
            `[BeDrive] Error getting shareable link (${axiosErr.response?.status}):`,
            axiosErr.response?.data
          );
        }
      }

      const fileSizeKB = (fileSizeBytes / 1024).toFixed(2);
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
      const shareableUrl = shareableInfo?.link
        ? `${this.baseUrl.replace('/api/v1', '')}/drive/s/${shareableInfo.hash || ''}`
        : undefined;

      return {
        fileId,
        fileName,
        url,
        fileSizeKB: `${fileSizeKB} KB`,
        fileSizeMB: `${fileSizeMB} MB`,
        timestamp,
        storageType: 'cloud',
        cloudProvider: 'bedrive',
        cloudFileId: file.id,
        shareableLink: shareableUrl,
        shareableHash: shareableInfo?.hash || undefined,
        downloadUrl: `/browser/download/${fileId}`,
        viewUrl: `/browser/view/${fileId}`,
        message: shareableUrl
          ? `HTML saved to BeDrive cloud storage. Shareable link: ${shareableUrl}`
          : 'HTML saved successfully to BeDrive cloud storage. Use downloadUrl to retrieve the file.',
      };
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      console.error('[BeDrive] Upload error:', axiosError.response?.data || axiosError.message);
      throw new Error(
        `BeDrive upload failed: ${axiosError.response?.data?.message || axiosError.message}`
      );
    }
  }

  async getHtml(fileId: string): Promise<FileData> {
    try {
      const parentId = await this.ensureFolder();

      const params: Record<string, unknown> = {};
      if (parentId) {
        params.parentIds = [parentId];
      }

      console.log(`[BeDrive] Searching for file starting with: ${fileId}`);
      const response = await this.client.get('/drive/file-entries', { params });
      const responseData = response.data as {
        data?: BedriveFileEntry[];
        entries?: BedriveFileEntry[];
      };
      const entries = responseData.data || responseData.entries || [];
      const matchingFile = entries.find(f => f.name && f.name.startsWith(fileId));

      if (!matchingFile) {
        throw new Error(`HTML file not found in BeDrive for ID: ${fileId}`);
      }

      console.log(`[BeDrive] Found file: ${matchingFile.name} (ID: ${matchingFile.id})`);
      const downloadUrl = `${this.baseUrl}/file-entries/${matchingFile.id}/download`;
      const downloadResponse = await axios.get(downloadUrl, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        responseType: 'text',
      });

      return {
        fileId,
        fileName: matchingFile.name,
        url: '',
        html: downloadResponse.data,
        fileSizeBytes: matchingFile.file_size || 0,
        createdAt: matchingFile.created_at || new Date().toISOString(),
        storageType: 'cloud',
        cloudProvider: 'bedrive',
        cloudFileId: matchingFile.id,
        downloadUrl: `/browser/download/${fileId}`,
        viewUrl: `/browser/view/${fileId}`,
      };
    } catch (error) {
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      console.error('[BeDrive] Download error:', axiosError.response?.data || axiosError.message);
      throw new Error(
        `BeDrive download failed: ${axiosError.response?.data?.message || axiosError.message}`
      );
    }
  }

  async getStats(): Promise<StorageStats> {
    try {
      const parentId = await this.ensureFolder();
      const params: Record<string, unknown> = {};
      if (parentId) {
        params.parentIds = [parentId];
      }
      const response = await this.client.get('/drive/file-entries', { params });
      const responseData = response.data as {
        data?: BedriveFileEntry[];
        entries?: BedriveFileEntry[];
      };
      const entries = responseData.data || responseData.entries || [];

      let totalSize = 0;
      entries.forEach(entry => {
        totalSize += entry.file_size || 0;
      });

      return {
        fileCount: entries.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        averageSizeMB:
          entries.length > 0 ? (totalSize / entries.length / (1024 * 1024)).toFixed(2) : '0.00',
        storageType: 'cloud',
        cloudProvider: 'bedrive',
      };
    } catch (error) {
      const axiosError = error as { message?: string };
      console.error('[BeDrive] Stats error:', axiosError.message);
      return {
        fileCount: 0,
        totalSizeBytes: 0,
        storageType: 'cloud',
        cloudProvider: 'bedrive',
        error: axiosError.message,
      };
    }
  }

  async cleanup(_maxAgeHours: number): Promise<CleanupResult> {
    throw new Error('Cleanup is not supported for cloud storage. Files are managed by BeDrive.');
  }

  getType(): string {
    return 'cloud';
  }
}

export default BedriveStorageAdapter;
