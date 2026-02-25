// utils/storage/StorageAdapter.js
/**
 * Base Storage Adapter Interface
 * All storage implementations must implement these methods
 */
class StorageAdapter {
  /**
   * Save HTML content to storage
   * @param {string} fileId - Unique file identifier
   * @param {string} html - HTML content to save
   * @param {string} url - Original URL scraped
   * @returns {Promise<Object>} File metadata
   */
  async saveHtml(fileId, html, url) {
    throw new Error('saveHtml() must be implemented');
  }

  /**
   * Retrieve HTML content from storage
   * @param {string} fileId - File identifier
   * @returns {Promise<Object>} File data with html content
   */
  async getHtml(fileId) {
    throw new Error('getHtml() must be implemented');
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  async getStats() {
    throw new Error('getStats() must be implemented');
  }

  /**
   * Delete old files (only for local storage)
   * @param {number} maxAgeHours - Delete files older than this
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanup(maxAgeHours) {
    throw new Error('cleanup() not supported for this storage type');
  }

  /**
   * Get storage type name
   * @returns {string}
   */
  getType() {
    throw new Error('getType() must be implemented');
  }
}

module.exports = StorageAdapter;
