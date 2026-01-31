// utils/storage/StorageFactory.js
const LocalStorageAdapter = require('./LocalStorageAdapter');
const BedriveStorageAdapter = require('./BedriveStorageAdapter');

class StorageFactory {
  static createStorage() {
    const storageType = process.env.STORAGE_TYPE || 'local';

    console.log(`[Storage] Initializing ${storageType} storage...`);

    switch (storageType.toLowerCase()) {
      case 'cloud':
      case 'bedrive':
        return new BedriveStorageAdapter({
          url: process.env.BEDRIVE_URL,
          apiKey: process.env.BEDRIVE_API_KEY,
          folderId: process.env.BEDRIVE_FOLDER_ID || 'scraped_html'
        });

      case 'local':
      default:
        return new LocalStorageAdapter();
    }
  }

  static getStorageConfig() {
    return {
      type: process.env.STORAGE_TYPE || 'local',
      cleanup: {
        enabled: process.env.ENABLE_LOCAL_CLEANUP === 'true',
        intervalHours: parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 6,
        maxAgeHours: parseInt(process.env.CLEANUP_MAX_AGE_HOURS) || 24
      },
      cloud: {
        url: process.env.BEDRIVE_URL,
        apiKey: process.env.BEDRIVE_API_KEY,
        folderId: process.env.BEDRIVE_FOLDER_ID || 'scraped_html'
      }
    };
  }
}

module.exports = StorageFactory;
