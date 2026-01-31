// utils/storage/BedriveStorageAdapter.js
const axios = require('axios');
const FormData = require('form-data');
const StorageAdapter = require('./StorageAdapter');

class BedriveStorageAdapter extends StorageAdapter {
  constructor(config) {
    super();
    this.baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.folderId = config.folderId || null; // Use folder ID directly
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json'
      }
    });

    console.log(`[BeDrive] Initialized with URL: ${this.baseUrl}`);
    console.log(`[BeDrive] Using folder ID: ${this.folderId || 'root'}`);
  }

  async ensureFolder() {
    try {
      // If folder ID is provided, use it directly
      if (this.folderId) {
        console.log(`[BeDrive] Using existing folder ID: ${this.folderId}`);
        return this.folderId;
      }
      
      // Otherwise use root (null)
      console.log('[BeDrive] Using root folder');
      return null;
    } catch (error) {
      console.error('[BeDrive] Error ensuring folder:', error.message);
      throw new Error(`BeDrive folder error: ${error.message}`);
    }
  }

  async saveHtml(fileId, html, url) {
    try {
      const timestamp = Date.now();
      const fileName = `${fileId}_${timestamp}.html`;
      
      // Get parent folder ID
      const parentId = await this.ensureFolder();

      // Create file buffer
      const buffer = Buffer.from(html, 'utf8');
      const fileSizeBytes = buffer.length;

      // Upload file to BeDrive using multipart/form-data
      // BeDrive API: POST /uploads
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: fileName,
        contentType: 'text/html'
      });
      if (parentId) {
        formData.append('parentId', parentId);
      }

      console.log(`[BeDrive] Uploading ${fileName} (${fileSizeBytes} bytes) to folder ${parentId || 'root'}...`);

      const uploadResponse = await this.client.post('/uploads', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const file = uploadResponse.data.fileEntry || uploadResponse.data;
      console.log(`[BeDrive] Upload successful! File ID: ${file.id}`);

      // Get or create shareable link for the file
      let shareableLink = null;
      try {
        console.log(`[BeDrive] Fetching shareable link for file ID: ${file.id}...`);
        
        // Try to get existing shareable link
        const linkResponse = await this.client.get(`/file-entries/${file.id}/shareable-link`);
        shareableLink = linkResponse.data.link;
        
        // If link is null or doesn't exist, create one
        if (!shareableLink) {
          console.log(`[BeDrive] No shareable link exists, creating new one...`);
          const createLinkResponse = await this.client.post(`/file-entries/${file.id}/shareable-link`, {
            allow_download: true,
            allow_edit: false
          });
          shareableLink = createLinkResponse.data.link;
          console.log(`[BeDrive] Created shareable link:`, shareableLink);
        } else {
          console.log(`[BeDrive] Found existing shareable link:`, shareableLink);
        }
      } catch (error) {
        // If getting link fails (404), create one
        if (error.response?.status === 404) {
          console.log(`[BeDrive] No shareable link found (404), creating new one...`);
          try {
            const createLinkResponse = await this.client.post(`/file-entries/${file.id}/shareable-link`, {
              allow_download: true,
              allow_edit: false
            });
            shareableLink = createLinkResponse.data.link;
            console.log(`[BeDrive] Created shareable link:`, shareableLink);
          } catch (createError) {
            console.error(`[BeDrive] Failed to create shareable link:`, createError.response?.data || createError.message);
          }
        } else {
          console.warn(`[BeDrive] Error getting shareable link (${error.response?.status}):`, error.response?.data || error.message);
        }
      }

      const fileSizeKB = (fileSizeBytes / 1024).toFixed(2);
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

      // Build shareable URL if we have the link
      const shareableUrl = shareableLink 
        ? `${this.baseUrl.replace('/api/v1', '')}/drive/s/${shareableLink.hash}`
        : null;

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
        shareableHash: shareableLink?.hash || null,
        downloadUrl: `/browser/download/${fileId}`,
        viewUrl: `/browser/view/${fileId}`,
        message: shareableUrl 
          ? `HTML saved to BeDrive cloud storage. Shareable link: ${shareableUrl}`
          : 'HTML saved successfully to BeDrive cloud storage. Use downloadUrl to retrieve the file.'
      };
    } catch (error) {
      console.error('[BeDrive] Upload error:', error.response?.data || error.message);
      throw new Error(`BeDrive upload failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getHtml(fileId) {
    try {
      // List files to find matching file
      const parentId = await this.ensureFolder();
      
      // BeDrive API: GET /drive/file-entries
      const params = {};
      if (parentId) {
        params.parentIds = [parentId];
      }
      
      console.log(`[BeDrive] Searching for file starting with: ${fileId}`);
      const response = await this.client.get('/drive/file-entries', { params });
      const entries = response.data.data || response.data.entries || response.data || [];

      const matchingFile = entries.find(f => f.name && f.name.startsWith(fileId));

      if (!matchingFile) {
        throw new Error(`HTML file not found in BeDrive for ID: ${fileId}`);
      }

      console.log(`[BeDrive] Found file: ${matchingFile.name} (ID: ${matchingFile.id})`);

      // Download file content
      // BeDrive API: GET /file-entries/{entryId}/download (redirect to actual file URL)
      const downloadUrl = `${this.baseUrl}/file-entries/${matchingFile.id}/download`;
      const downloadResponse = await axios.get(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'text'
      });

      return {
        fileId,
        fileName: matchingFile.name,
        filePath: `cloud://bedrive/${matchingFile.id}`,
        html: downloadResponse.data,
        fileSizeBytes: matchingFile.file_size || 0,
        createdAt: matchingFile.created_at || new Date(),
        cloudProvider: 'bedrive',
        cloudFileId: matchingFile.id
      };
    } catch (error) {
      console.error('[BeDrive] Download error:', error.response?.data || error.message);
      throw new Error(`BeDrive download failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getStats() {
    try {
      const parentId = await this.ensureFolder();
      
      // Get folder contents
      const params = {};
      if (parentId) {
        params.parentIds = [parentId];
      }
      
      const response = await this.client.get('/drive/file-entries', { params });
      const entries = response.data.data || response.data.entries || response.data || [];

      let totalSize = 0;
      entries.forEach(entry => {
        totalSize += entry.file_size || 0;
      });

      return {
        fileCount: entries.length,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        averageSizeMB: entries.length > 0 ? (totalSize / entries.length / (1024 * 1024)).toFixed(2) : 0,
        storageType: 'cloud',
        cloudProvider: 'bedrive'
      };
    } catch (error) {
      console.error('[BeDrive] Stats error:', error.response?.data || error.message);
      return {
        fileCount: 0,
        totalSizeMB: 0,
        averageSizeMB: 0,
        storageType: 'cloud',
        cloudProvider: 'bedrive',
        error: error.message
      };
    }
  }

  async cleanup(maxAgeHours) {
    throw new Error('Cleanup is not supported for cloud storage. Files are managed by BeDrive.');
  }

  getType() {
    return 'cloud';
  }
}

module.exports = BedriveStorageAdapter;
