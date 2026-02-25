// utils/storage/StorageFactory.js
const LocalStorageAdapter = require('./LocalStorageAdapter');
const BedriveStorageAdapter = require('./BedriveStorageAdapter');
const WordPressStorageAdapter = require('./WordPressStorageAdapter');

class StorageFactory {
  // Singleton instance
  static storageInstance = null;

  static createStorage() {
    // Return existing instance if already created
    if (StorageFactory.storageInstance) {
      return StorageFactory.storageInstance;
    }

    const storageType = process.env.STORAGE_TYPE || 'local';

    console.log(`[Storage] Initializing ${storageType} storage...`);

    switch (storageType.toLowerCase()) {
      case 'cloud':
      case 'bedrive':
        StorageFactory.storageInstance = new BedriveStorageAdapter({
          url: process.env.BEDRIVE_URL,
          apiKey: process.env.BEDRIVE_API_KEY,
          folderId: process.env.BEDRIVE_FOLDER_ID || 'scraped_html'
        });
        break;

      case 'wordpress':
        StorageFactory.storageInstance = new WordPressStorageAdapter({
          url: process.env.WORDPRESS_URL,
          username: process.env.WORDPRESS_USERNAME,
          password: process.env.WORDPRESS_PASSWORD
        });
        break;

      case 'local':
      default:
        StorageFactory.storageInstance = new LocalStorageAdapter();
    }

    return StorageFactory.storageInstance;
  }

  // Force reset the singleton (useful for testing or storage type changes)
  static resetStorage() {
    StorageFactory.storageInstance = null;
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
      },
      wordpress: {
        url: process.env.WORDPRESS_URL,
        username: process.env.WORDPRESS_USERNAME,
        password: process.env.WORDPRESS_PASSWORD
      }
    };
  }
}

module.exports = StorageFactory;
