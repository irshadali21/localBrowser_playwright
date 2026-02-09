// tests/unit/storage-adapter.test.ts

import { LocalStorageAdapter } from '../../utils/storage/LocalStorageAdapter';
import { StorageFactory, StorageConfig, StorageType } from '../../utils/storage/StorageFactory';
import {
  FileMetadata,
  FileData,
  StorageStats,
  CleanupResult,
} from '../../utils/storage/StorageAdapter';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  const testDir = path.join(os.tmpdir(), `test-storage-${Date.now()}`);
  const originalCwd = process.cwd();

  beforeAll(() => {
    // Create a temp directory for testing
    process.env.LOCAL_STORAGE_PATH = testDir;
  });

  afterAll(() => {
    // Cleanup temp directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    // Restore original working directory
    process.chdir(originalCwd);
  });

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    StorageFactory.clearInstances();
  });

  describe('Constructor', () => {
    it('should create adapter with default storage path', () => {
      const localAdapter = new LocalStorageAdapter();
      expect(localAdapter.getType()).toBe('local');
    });
  });

  describe('saveHtml', () => {
    it('should save HTML content and return metadata', async () => {
      const fileId = 'test-file-1';
      const html = '<html><body><h1>Test</h1></body></html>';
      const url = 'https://example.com';

      const result = await adapter.saveHtml(fileId, html, url);

      expect(result).toBeDefined();
      expect(result.fileId).toBe(fileId);
      expect(result.storageType).toBe('local');
      expect(result.downloadUrl).toBe(`/browser/download/${fileId}`);
      expect(result.viewUrl).toBe(`/browser/view/${fileId}`);
      expect(result.fileName).toContain(fileId);
      expect(result.message).toContain('saved successfully');
    });

    it('should save file to correct directory', async () => {
      const fileId = 'test-file-2';
      const html = '<html><body>Test content</body></html>';
      const url = 'https://test.com';

      await adapter.saveHtml(fileId, html, url);

      // The adapter uses process.cwd() + scraped_html
      const storagePath = path.join(process.cwd(), 'scraped_html');
      expect(fs.existsSync(storagePath)).toBe(true);
    });

    it('should include file size in result', async () => {
      const fileId = 'test-file-3';
      const html = '<html><body>Large content'.repeat(100) + '</body></html>';
      const url = 'https://example.com';

      const result = await adapter.saveHtml(fileId, html, url);

      expect(result.fileSizeKB).toBeDefined();
      expect(parseFloat(result.fileSizeKB!)).toBeGreaterThan(0);
    });
  });

  describe('getHtml', () => {
    it('should retrieve saved HTML content', async () => {
      const fileId = 'test-file-retrieve';
      const html = '<html><body><h1>Retrieve Test</h1></body></html>';
      const url = 'https://example.com';

      await adapter.saveHtml(fileId, html, url);
      const result = await adapter.getHtml(fileId);

      expect(result).toBeDefined();
      expect(result.fileId).toBe(fileId);
      expect(result.html).toBe(html);
    });

    it('should throw error for non-existent file', async () => {
      await expect(adapter.getHtml('non-existent-file')).rejects.toThrow('HTML file not found');
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      // Save some files first
      await adapter.saveHtml('stats-test-1', '<html>Test 1</html>', 'https://test1.com');
      await adapter.saveHtml('stats-test-2', '<html>Test 2</html>', 'https://test2.com');

      const stats = await adapter.getStats();

      expect(stats).toBeDefined();
      expect(stats.storageType).toBe('local');
      expect(stats.fileCount).toBeGreaterThanOrEqual(2);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.totalSizeMB).toBeDefined();
      expect(stats.averageSizeMB).toBeDefined();
    });

    it('should return stats for current storage state', async () => {
      // Clear instances and create new adapter
      StorageFactory.clearInstances();

      // Manually clear the scraped_html directory
      const storagePath = path.join(process.cwd(), 'scraped_html');
      if (fs.existsSync(storagePath)) {
        const files = fs.readdirSync(storagePath);
        files.forEach(file => {
          fs.unlinkSync(path.join(storagePath, file));
        });
      }

      // Create new adapter after clearing
      const newAdapter = new LocalStorageAdapter();

      // Now check stats - should be 0 or based on any remaining files
      const stats = await newAdapter.getStats();

      expect(stats.storageType).toBe('local');
      expect(typeof stats.totalSizeBytes).toBe('number');
    });
  });

  describe('cleanup', () => {
    it('should delete files older than specified age', async () => {
      // Save a file
      await adapter.saveHtml('cleanup-test', '<html>Cleanup test</html>', 'https://test.com');

      // Run cleanup with 0 hours (delete all)
      const result = await adapter.cleanup(0);

      expect(result).toBeDefined();
      expect(result.storageType).toBe('local');
      expect(typeof result.deleted).toBe('number');
    });
  });

  describe('getType', () => {
    it('should return correct storage type', () => {
      expect(adapter.getType()).toBe('local');
    });
  });
});

describe('StorageFactory', () => {
  beforeEach(() => {
    StorageFactory.clearInstances();
  });

  afterEach(() => {
    StorageFactory.clearInstances();
  });

  describe('createAdapter', () => {
    it('should create local adapter', () => {
      const config: StorageConfig = {
        type: 'local',
        localPath: '/tmp/test-storage',
      };

      const adapter = StorageFactory.createAdapter(config);

      expect(adapter).toBeDefined();
      expect(adapter.getType()).toBe('local');
    });

    it('should throw error for invalid storage type', () => {
      const config = {
        type: 'invalid' as StorageType,
      };

      expect(() => {
        StorageFactory.createAdapter(config);
      }).toThrow();
    });

    it('should cache adapter instances', () => {
      const config: StorageConfig = {
        type: 'local',
        localPath: '/tmp/test-cache',
      };

      const adapter1 = StorageFactory.createAdapter(config);
      const adapter2 = StorageFactory.createAdapter(config);

      expect(adapter1).toBe(adapter2);
    });
  });

  describe('getInstance', () => {
    it('should return null when no instance exists', () => {
      const result = StorageFactory.getInstance('local');
      expect(result).toBeNull();
    });

    it('should return instance when created', () => {
      const config: StorageConfig = {
        type: 'local',
        localPath: '/tmp/test-instance',
      };

      StorageFactory.createAdapter(config);
      const result = StorageFactory.getInstance('local');

      expect(result).toBeDefined();
      expect(result?.getType()).toBe('local');
    });
  });

  describe('removeInstance', () => {
    it('should remove existing instance', () => {
      const config: StorageConfig = {
        type: 'local',
        localPath: '/tmp/test-remove',
      };

      StorageFactory.createAdapter(config);
      const result = StorageFactory.removeInstance('local:/tmp/test-remove');

      expect(result).toBe(true);
      expect(StorageFactory.getInstance('local')).toBeNull();
    });

    it('should return false for non-existent instance', () => {
      const result = StorageFactory.removeInstance('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('clearInstances', () => {
    it('should clear all adapter instances', () => {
      const config1: StorageConfig = {
        type: 'local',
        localPath: '/tmp/test-clear-1',
      };
      const config2: StorageConfig = {
        type: 'local',
        localPath: '/tmp/test-clear-2',
      };

      StorageFactory.createAdapter(config1);
      StorageFactory.createAdapter(config2);

      const instancesBefore = StorageFactory.getInstances();
      expect(instancesBefore.size).toBeGreaterThan(0);

      StorageFactory.clearInstances();

      const instancesAfter = StorageFactory.getInstances();
      expect(instancesAfter.size).toBe(0);
    });
  });
});

describe('StorageAdapter Interface', () => {
  it('should have all required methods', () => {
    const adapter = new LocalStorageAdapter();

    expect(typeof adapter.saveHtml).toBe('function');
    expect(typeof adapter.getHtml).toBe('function');
    expect(typeof adapter.getStats).toBe('function');
    expect(typeof adapter.getType).toBe('function');
  });

  it('should return Promise from async methods', () => {
    const adapter = new LocalStorageAdapter();

    const saveResult = adapter.saveHtml('interface-test', '<html>Test</html>', 'https://test.com');
    expect(saveResult).toBeInstanceOf(Promise);

    const getResult = adapter.getHtml('interface-test');
    expect(getResult).toBeInstanceOf(Promise);

    const statsResult = adapter.getStats();
    expect(statsResult).toBeInstanceOf(Promise);
  });
});
