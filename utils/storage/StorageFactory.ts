// utils/storage/StorageFactory.ts
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { BedriveStorageAdapter } from './BedriveStorageAdapter';
import { WordPressStorageAdapter } from './WordPressStorageAdapter';
import { BaseStorageAdapter } from './StorageAdapter';

export type StorageType = 'local' | 'cloud' | 'bedrive' | 'wordpress';
export type CloudProvider = 'bedrive' | 'wordpress';

export interface StorageConfig {
  type: StorageType;
  localPath?: string;
  cloudConfig?: {
    provider: CloudProvider;
    url?: string;
    apiKey?: string;
    folderId?: string;
    siteUrl?: string;
    username?: string;
    applicationPassword?: string;
  };
}

export class StorageFactory {
  private static instances: Map<string, BaseStorageAdapter> = new Map();

  static createAdapter(config: StorageConfig): BaseStorageAdapter {
    const configKey = this.getConfigKey(config);

    // Return existing instance if available
    if (this.instances.has(configKey)) {
      console.log(`[StorageFactory] Reusing existing adapter for key: ${configKey}`);
      return this.instances.get(configKey)!;
    }

    let adapter: BaseStorageAdapter;

    switch (config.type) {
      case 'local':
        adapter = new LocalStorageAdapter();
        break;

      case 'cloud':
        if (!config.cloudConfig) {
          throw new Error('Cloud storage requires cloudConfig configuration');
        }
        adapter = this.createCloudAdapter(config.cloudConfig);
        break;

      case 'bedrive':
        if (!config.cloudConfig?.url || !config.cloudConfig?.apiKey) {
          throw new Error('BeDrive storage requires url and apiKey configuration');
        }
        adapter = new BedriveStorageAdapter({
          url: config.cloudConfig.url,
          apiKey: config.cloudConfig.apiKey,
          folderId: config.cloudConfig.folderId,
        });
        break;

      case 'wordpress':
        if (
          !config.cloudConfig?.siteUrl ||
          !config.cloudConfig?.username ||
          !config.cloudConfig?.applicationPassword
        ) {
          throw new Error(
            'WordPress storage requires siteUrl, username, and applicationPassword configuration'
          );
        }
        adapter = new WordPressStorageAdapter({
          siteUrl: config.cloudConfig.siteUrl,
          username: config.cloudConfig.username,
          applicationPassword: config.cloudConfig.applicationPassword,
        });
        break;

      default:
        throw new Error(`Unsupported storage type: ${(config as StorageConfig).type}`);
    }

    this.instances.set(configKey, adapter);
    console.log(`[StorageFactory] Created new adapter for type: ${config.type}`);
    return adapter;
  }

  private static createCloudAdapter(cloudConfig: StorageConfig['cloudConfig']): BaseStorageAdapter {
    if (!cloudConfig) {
      throw new Error('Cloud configuration is required');
    }

    switch (cloudConfig.provider) {
      case 'bedrive':
        if (!cloudConfig.url || !cloudConfig.apiKey) {
          throw new Error('BeDrive requires url and apiKey');
        }
        return new BedriveStorageAdapter({
          url: cloudConfig.url,
          apiKey: cloudConfig.apiKey,
          folderId: cloudConfig.folderId,
        });

      case 'wordpress':
        if (!cloudConfig.siteUrl || !cloudConfig.username || !cloudConfig.applicationPassword) {
          throw new Error('WordPress requires siteUrl, username, and applicationPassword');
        }
        return new WordPressStorageAdapter({
          siteUrl: cloudConfig.siteUrl,
          username: cloudConfig.username,
          applicationPassword: cloudConfig.applicationPassword,
        });

      default:
        throw new Error(`Unsupported cloud provider: ${cloudConfig.provider}`);
    }
  }

  private static getConfigKey(config: StorageConfig): string {
    if (config.type === 'local') {
      return `local:${config.localPath || 'default'}`;
    }
    if (config.type === 'bedrive') {
      return `bedrive:${config.cloudConfig?.url || 'unknown'}`;
    }
    if (config.type === 'wordpress') {
      return `wordpress:${config.cloudConfig?.siteUrl || 'unknown'}`;
    }
    if (config.type === 'cloud' && config.cloudConfig) {
      return `cloud:${config.cloudConfig.provider}:${config.cloudConfig.url || config.cloudConfig.siteUrl || 'unknown'}`;
    }
    return `unknown:${Date.now()}`;
  }

  static getInstance(type: StorageType): BaseStorageAdapter | null {
    for (const [key, adapter] of this.instances) {
      if (key.startsWith(type)) {
        return adapter;
      }
    }
    return null;
  }

  static getInstances(): Map<string, BaseStorageAdapter> {
    return this.instances;
  }

  static clearInstances(): void {
    this.instances.clear();
    console.log('[StorageFactory] All adapter instances cleared');
  }

  static removeInstance(configKey: string): boolean {
    if (this.instances.has(configKey)) {
      this.instances.delete(configKey);
      console.log(`[StorageFactory] Removed adapter instance: ${configKey}`);
      return true;
    }
    return false;
  }

  /**
   * Create storage adapter using environment configuration
   * This method provides backward compatibility with the original createStorage pattern
   */
  static createStorage(): BaseStorageAdapter {
    const storageType = (process.env.STORAGE_TYPE || 'local') as StorageType;

    switch (storageType) {
      case 'bedrive':
        return this.createAdapter({
          type: 'bedrive',
          cloudConfig: {
            provider: 'bedrive',
            url: process.env.BEDRIVE_URL,
            apiKey: process.env.BEDRIVE_API_KEY,
            folderId: process.env.BEDRIVE_FOLDER_ID,
          },
        });

      case 'wordpress':
        return this.createAdapter({
          type: 'wordpress',
          cloudConfig: {
            provider: 'wordpress',
            siteUrl: process.env.WORDPRESS_SITE_URL,
            username: process.env.WORDPRESS_USERNAME,
            applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
          },
        });

      case 'cloud':
        const cloudProvider = (process.env.CLOUD_PROVIDER || 'bedrive') as CloudProvider;
        return this.createAdapter({
          type: 'cloud',
          cloudConfig: {
            provider: cloudProvider,
            url: process.env.CLOUD_URL || process.env.BEDRIVE_URL,
            apiKey: process.env.CLOUD_API_KEY || process.env.BEDRIVE_API_KEY,
            folderId: process.env.CLOUD_FOLDER_ID || process.env.BEDRIVE_FOLDER_ID,
            siteUrl: process.env.CLOUD_SITE_URL || process.env.WORDPRESS_SITE_URL,
            username: process.env.CLOUD_USERNAME || process.env.WORDPRESS_USERNAME,
            applicationPassword:
              process.env.CLOUD_APP_PASSWORD || process.env.WORDPRESS_APP_PASSWORD,
          },
        });

      case 'local':
      default:
        return this.createAdapter({
          type: 'local',
          localPath: process.env.LOCAL_STORAGE_PATH || './scraped_html',
        });
    }
  }
}

export default StorageFactory;
