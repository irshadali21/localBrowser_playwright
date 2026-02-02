// utils/storage/WordPressStorageAdapter.js
const axios = require('axios');
const FormData = require('form-data');
const StorageAdapter = require('./StorageAdapter');

class WordPressStorageAdapter extends StorageAdapter {
  constructor(config) {
    super();
    this.siteUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.username = config.username;
    this.password = config.password;
    
    // WordPress REST API endpoint
    this.apiBaseUrl = `${this.siteUrl}/wp-json/wp/v2`;
    
    // Create axios instance with basic auth
    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      auth: {
        username: this.username,
        password: this.password
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`[WordPress] Initialized with site URL: ${this.siteUrl}`);
  }

  async saveHtml(fileId, html, url) {
    try {
      const timestamp = Date.now();
      const fileName = `${fileId}_${timestamp}.html`;
      
      // Create file buffer
      const buffer = Buffer.from(html, 'utf8');
      const fileSizeBytes = buffer.length;

      // Upload file to WordPress Media Library
      // WordPress API: POST /wp/v2/media
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: fileName,
        contentType: 'text/html'
      });
      
      // Add title and alt text for better organization
      formData.append('title', `Scraped HTML - ${fileId}`);
      formData.append('caption', `Scraped from: ${url}`);
      formData.append('description', `Timestamp: ${new Date(timestamp).toISOString()}`);

      console.log(`[WordPress] Uploading ${fileName} (${fileSizeBytes} bytes)...`);

      const uploadResponse = await this.client.post('/media', formData, {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const media = uploadResponse.data;
      console.log(`[WordPress] Upload successful! Media ID: ${media.id}`);

      const fileSizeKB = (fileSizeBytes / 1024).toFixed(2);
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

      return {
        fileId,
        fileName,
        url,
        fileSizeKB: `${fileSizeKB} KB`,
        fileSizeMB: `${fileSizeMB} MB`,
        timestamp,
        storageType: 'cloud',
        cloudProvider: 'wordpress',
        cloudFileId: media.id,
        mediaUrl: media.source_url, // Direct URL to the file
        mediaLink: media.link, // Attachment page URL
        downloadUrl: `/browser/download/${fileId}`,
        viewUrl: `/browser/view/${fileId}`,
        message: `HTML saved to WordPress Media Library. Media ID: ${media.id}, URL: ${media.source_url}`
      };
    } catch (error) {
      console.error('[WordPress] Upload error:', error.response?.data || error.message);
      
      // Provide more detailed error messages
      if (error.response?.status === 401) {
        throw new Error('WordPress authentication failed. Check username and password.');
      } else if (error.response?.status === 403) {
        throw new Error('WordPress upload forbidden. User may not have upload permissions.');
      } else {
        throw new Error(`WordPress upload failed: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  async getHtml(fileId) {
    try {
      console.log(`[WordPress] Searching for media starting with: ${fileId}`);
      
      // Search for media files matching the fileId prefix
      // WordPress API: GET /wp/v2/media?search={fileId}
      const searchResponse = await this.client.get('/media', {
        params: {
          search: fileId,
          per_page: 100, // Get up to 100 results
          orderby: 'date',
          order: 'desc'
        }
      });

      const mediaItems = searchResponse.data;
      
      // Find the matching file by checking the filename in source_url
      const matchingMedia = mediaItems.find(item => {
        const filename = item.source_url.split('/').pop();
        return filename.startsWith(fileId);
      });

      if (!matchingMedia) {
        throw new Error(`HTML file not found in WordPress Media Library for ID: ${fileId}`);
      }

      console.log(`[WordPress] Found media: ${matchingMedia.source_url} (ID: ${matchingMedia.id})`);

      // Download file content directly from source_url
      const downloadResponse = await axios.get(matchingMedia.source_url, {
        responseType: 'text'
      });

      const filename = matchingMedia.source_url.split('/').pop();

      return {
        fileId,
        fileName: filename,
        filePath: `cloud://wordpress/${matchingMedia.id}`,
        html: downloadResponse.data,
        fileSizeBytes: matchingMedia.media_details?.filesize || 0,
        createdAt: matchingMedia.date || new Date(),
        cloudProvider: 'wordpress',
        cloudFileId: matchingMedia.id,
        mediaUrl: matchingMedia.source_url
      };
    } catch (error) {
      console.error('[WordPress] Download error:', error.response?.data || error.message);
      throw new Error(`WordPress download failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getStats() {
    try {
      // Get all HTML files from media library
      // WordPress API: GET /wp/v2/media?mime_type=text/html
      const response = await this.client.get('/media', {
        params: {
          mime_type: 'text/html',
          per_page: 100, // Limit to prevent large responses
          orderby: 'date',
          order: 'desc'
        }
      });

      const mediaItems = response.data;
      
      let totalSize = 0;
      mediaItems.forEach(item => {
        totalSize += item.media_details?.filesize || 0;
      });

      return {
        fileCount: mediaItems.length,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        averageSizeMB: mediaItems.length > 0 ? (totalSize / mediaItems.length / (1024 * 1024)).toFixed(2) : '0.00',
        storageType: 'cloud',
        cloudProvider: 'wordpress',
        note: 'Stats limited to first 100 HTML files'
      };
    } catch (error) {
      console.error('[WordPress] Stats error:', error.response?.data || error.message);
      return {
        fileCount: 0,
        totalSizeMB: '0.00',
        averageSizeMB: '0.00',
        storageType: 'cloud',
        cloudProvider: 'wordpress',
        error: error.message
      };
    }
  }

  async cleanup(maxAgeHours) {
    throw new Error('Cleanup is not supported for WordPress storage. Files are managed by WordPress.');
  }

  getType() {
    return 'cloud';
  }
}

module.exports = WordPressStorageAdapter;
