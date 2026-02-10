/**
 * Dependency Injection Container
 * Manages service lifetimes and dependencies
 */

/**
 * Service factory function type
 */
export type ServiceFactory<T> = (container: DIContainer) => T;

/**
 * Service registration
 */
interface ServiceRegistration<T> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
}

/**
 * Dependency Injection Container
 */
export class DIContainer {
  private services = new Map<string, ServiceRegistration<unknown>>();
  private parent: DIContainer | null = null;

  constructor(parent?: DIContainer) {
    this.parent = parent || null;
  }

  /**
   * Register a service
   */
  register<T>(name: string, factory: ServiceFactory<T>, singleton: boolean = true): void {
    this.services.set(name, { factory, singleton });
  }

  /**
   * Resolve a service
   */
  resolve<T>(name: string): T {
    // Check if already instantiated (for singletons)
    const registration = this.services.get(name) as ServiceRegistration<T> | undefined;
    if (!registration) {
      // Try parent container
      if (this.parent) {
        return this.parent.resolve<T>(name);
      }
      throw new Error(`Service not found: ${name}`);
    }

    // Return existing instance for singleton
    if (registration.singleton && registration.instance) {
      return registration.instance;
    }

    // Create new instance
    const instance = registration.factory(this);
    
    // Store instance for singletons
    if (registration.singleton) {
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || (this.parent ? this.parent.has(name) : false);
  }

  /**
   * Create a child container
   */
  createChild(): DIContainer {
    return new DIContainer(this);
  }

  /**
   * Clear all registrations (for testing)
   */
  clear(): void {
    this.services.clear();
  }
}

/**
 * Create a container with default services
 */
export function createContainer(): DIContainer {
  const container = new DIContainer();
  
  // Logger service (singleton)
  container.register('logger', () => {
    const logger = require('../utils/logger.js');
    return logger.default || logger;
  }, true);

  // Database (singleton)
  container.register('database', () => {
    const db = require('../utils/db.js');
    return db.default || db;
  }, true);

  // Storage adapter (singleton)
  container.register('storage', (c) => {
    const StorageFactory = require('../utils/storage/StorageFactory.js');
    const factory = StorageFactory.default || StorageFactory;
    return factory.createStorage();
  }, true);

  return container;
}

// Export singleton container instance
let appContainer: DIContainer | null = null;

export function getContainer(): DIContainer {
  if (!appContainer) {
    appContainer = createContainer();
  }
  return appContainer;
}

export function setContainer(container: DIContainer): void {
  appContainer = container;
}

export default DIContainer;
