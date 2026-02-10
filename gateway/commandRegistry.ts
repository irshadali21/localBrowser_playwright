/**
 * Command Registry
 * Central registry for all gateway commands with lookup and validation support
 */

import { CommandCategory, HttpMethod, type CommandDefinition } from './commandTypes';

/**
 * CommandRegistry - Manages all command definitions and lookups
 */
export class CommandRegistry {
  private commands: Map<string, CommandDefinition>;
  private aliases: Map<string, string>;
  private categories: Map<CommandCategory, string[]>;

  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.categories = new Map(Object.values(CommandCategory).map(cat => [cat, [] as string[]]));
    this.initializeDefaultCommands();
  }

  /**
   * Register a new command
   */
  register(commandId: string, definition: CommandDefinition): void {
    // Validate required fields
    if (!commandId || !definition.name || !definition.handler) {
      throw new Error(`Invalid command definition for '${commandId}': missing required fields`);
    }

    // Check for duplicate
    if (this.commands.has(commandId)) {
      console.warn(`[CommandRegistry] Command '${commandId}' already registered, overwriting`);
    }

    // Store command
    this.commands.set(commandId, {
      ...definition,
      id: commandId,
    });

    // Register aliases if present
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.aliases.set(alias, commandId);
      }
    }

    // Add to category
    const categoryCommands = this.categories.get(definition.category) || [];
    if (!categoryCommands.includes(commandId)) {
      categoryCommands.push(commandId);
      this.categories.set(definition.category, categoryCommands);
    }

    console.log(`[CommandRegistry] Registered command: ${commandId}`);
  }

  /**
   * Get command definition by ID or alias
   */
  get(commandId: string): CommandDefinition | undefined {
    // Direct lookup
    if (this.commands.has(commandId)) {
      return this.commands.get(commandId);
    }

    // Alias lookup
    const resolvedId = this.aliases.get(commandId);
    if (resolvedId) {
      return this.commands.get(resolvedId);
    }

    return undefined;
  }

  /**
   * Get all registered commands
   */
  getAll(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: CommandCategory): CommandDefinition[] {
    const commandIds = this.categories.get(category) || [];
    return commandIds
      .map(id => this.commands.get(id))
      .filter((cmd): cmd is CommandDefinition => cmd !== undefined);
  }

  /**
   * Lookup command - supports aliases and partial matches
   */
  lookup(commandId: string): CommandDefinition | undefined {
    // Exact match
    if (this.commands.has(commandId)) {
      return this.commands.get(commandId);
    }

    // Alias lookup
    const resolvedId = this.aliases.get(commandId);
    if (resolvedId) {
      return this.commands.get(resolvedId);
    }

    // Try adding prefix variations
    const variations = [
      `gateway.${commandId}`,
      `api.${commandId}`,
      commandId.replace(/^gateway\./, ''),
      commandId.replace(/^api\./, ''),
    ];

    for (const variation of variations) {
      if (this.commands.has(variation)) {
        return this.commands.get(variation);
      }
      const aliasResolved = this.aliases.get(variation);
      if (aliasResolved) {
        return this.commands.get(aliasResolved);
      }
    }

    return undefined;
  }

  /**
   * Check if a command exists
   */
  has(commandId: string): boolean {
    return this.lookup(commandId) !== undefined;
  }

  /**
   * Get all categories with their commands
   */
  getCategories(): Map<CommandCategory, CommandDefinition[]> {
    const result = new Map<CommandCategory, CommandDefinition[]>();
    for (const [category, commandIds] of this.categories) {
      const commands = commandIds
        .map(id => this.commands.get(id))
        .filter((cmd): cmd is CommandDefinition => cmd !== undefined);
      result.set(category, commands);
    }
    return result;
  }

  /**
   * Get command count by category
   */
  getCategoryStats(): Record<CommandCategory, number> {
    const stats = {} as Record<CommandCategory, number>;
    for (const [category, commandIds] of this.categories) {
      stats[category] = commandIds.length;
    }
    return stats;
  }

  /**
   * Initialize all 26 default commands across 9 categories
   */
  private initializeDefaultCommands(): void {
    // Browser Commands (5)
    this.register('browser.visit', {
      id: 'browser.visit',
      name: 'Visit URL',
      description: 'Navigate to a URL and optionally capture the page content',
      category: CommandCategory.BROWSER,
      method: HttpMethod.POST,
      route: '/browser/visit',
      requireAuth: true,
      handler: 'browserController.visit',
    });

    this.register('browser.execute', {
      id: 'browser.execute',
      name: 'Execute JavaScript',
      description: 'Execute arbitrary JavaScript code in the browser context',
      category: CommandCategory.BROWSER,
      method: HttpMethod.POST,
      route: '/browser/execute',
      requireAuth: true,
      handler: 'browserController.execute',
    });

    this.register('browser.screenshot', {
      id: 'browser.screenshot',
      name: 'Take Screenshot',
      description: 'Capture a screenshot of the current page or a specific element',
      category: CommandCategory.BROWSER,
      method: HttpMethod.POST,
      route: '/browser/screenshot',
      requireAuth: true,
      handler: 'browserController.screenshot',
    });

    this.register('browser.navigate', {
      id: 'browser.navigate',
      name: 'Navigate',
      description: 'Navigate to a URL within an existing page context',
      category: CommandCategory.BROWSER,
      method: HttpMethod.POST,
      route: '/browser/navigate',
      requireAuth: true,
      handler: 'browserController.navigate',
    });

    this.register('browser.evaluate', {
      id: 'browser.evaluate',
      name: 'Evaluate Expression',
      description: 'Evaluate a JavaScript expression and return the result',
      category: CommandCategory.BROWSER,
      method: HttpMethod.POST,
      route: '/browser/evaluate',
      requireAuth: true,
      handler: 'browserController.evaluate',
    });

    // Chat Commands (4)
    this.register('chat.message', {
      id: 'chat.message',
      name: 'Send Message',
      description: 'Send a message to the chat assistant',
      category: CommandCategory.CHAT,
      method: HttpMethod.POST,
      route: '/chat/message',
      requireAuth: true,
      handler: 'chatController.message',
    });

    this.register('chat.conversation', {
      id: 'chat.conversation',
      name: 'Get Conversation',
      description: 'Retrieve a specific conversation by session ID',
      category: CommandCategory.CHAT,
      method: HttpMethod.GET,
      route: '/chat/conversation',
      requireAuth: true,
      handler: 'chatController.conversation',
    });

    this.register('chat.history', {
      id: 'chat.history',
      name: 'Get Chat History',
      description: 'Retrieve chat history for a session',
      category: CommandCategory.CHAT,
      method: HttpMethod.GET,
      route: '/chat/history',
      requireAuth: true,
      handler: 'chatController.history',
    });

    this.register('chat.clear', {
      id: 'chat.clear',
      name: 'Clear Chat',
      description: 'Clear chat history for a session',
      category: CommandCategory.CHAT,
      method: HttpMethod.POST,
      route: '/chat/clear',
      requireAuth: true,
      handler: 'chatController.clear',
    });

    // IAAPA Commands (4)
    this.register('iaapa.search', {
      id: 'iaapa.search',
      name: 'Search IAAPA Data',
      description: 'Search the IAAPA expo database',
      category: CommandCategory.IAAPA,
      method: HttpMethod.POST,
      route: '/iaapa/search',
      requireAuth: true,
      handler: 'iaapaController.search',
    });

    this.register('iaapa.filter', {
      id: 'iaapa.filter',
      name: 'Filter IAAPA Data',
      description: 'Filter IAAPA expo data by criteria',
      category: CommandCategory.IAAPA,
      method: HttpMethod.POST,
      route: '/iaapa/filter',
      requireAuth: true,
      handler: 'iaapaController.filter',
    });

    this.register('iaapa.export', {
      id: 'iaapa.export',
      name: 'Export IAAPA Data',
      description: 'Export IAAPA data to various formats',
      category: CommandCategory.IAAPA,
      method: HttpMethod.POST,
      route: '/iaapa/export',
      requireAuth: true,
      handler: 'iaapaController.export',
    });

    this.register('iaapa.import', {
      id: 'iaapa.import',
      name: 'Import IAAPA Data',
      description: 'Import external data into the IAAPA database',
      category: CommandCategory.IAAPA,
      method: HttpMethod.POST,
      route: '/iaapa/import',
      requireAuth: true,
      handler: 'iaapaController.import',
    });

    // Internal Commands (4)
    this.register('internal.health', {
      id: 'internal.health',
      name: 'Health Check',
      description: 'Check the health status of services',
      category: CommandCategory.INTERNAL,
      method: HttpMethod.GET,
      route: '/internal/health',
      requireAuth: false,
      handler: 'internalController.health',
    });

    this.register('internal.metrics', {
      id: 'internal.metrics',
      name: 'Get Metrics',
      description: 'Retrieve system metrics',
      category: CommandCategory.INTERNAL,
      method: HttpMethod.GET,
      route: '/internal/metrics',
      requireAuth: true,
      handler: 'internalController.metrics',
    });

    this.register('internal.config', {
      id: 'internal.config',
      name: 'Get Config',
      description: 'Retrieve configuration values',
      category: CommandCategory.INTERNAL,
      method: HttpMethod.GET,
      route: '/internal/config',
      requireAuth: true,
      handler: 'internalController.config',
    });

    this.register('internal.worker', {
      id: 'internal.worker',
      name: 'Worker Management',
      description: 'Manage worker processes',
      category: CommandCategory.INTERNAL,
      method: HttpMethod.POST,
      route: '/internal/worker',
      requireAuth: true,
      handler: 'internalController.worker',
    });

    // Job Commands (4)
    this.register('job.create', {
      id: 'job.create',
      name: 'Create Job',
      description: 'Create a new scraping job',
      category: CommandCategory.JOB,
      method: HttpMethod.POST,
      route: '/job/create',
      requireAuth: true,
      handler: 'jobController.create',
    });

    this.register('job.status', {
      id: 'job.status',
      name: 'Get Job Status',
      description: 'Retrieve the status of a job',
      category: CommandCategory.JOB,
      method: HttpMethod.GET,
      route: '/job/status',
      requireAuth: true,
      handler: 'jobController.status',
    });

    this.register('job.cancel', {
      id: 'job.cancel',
      name: 'Cancel Job',
      description: 'Cancel a running or pending job',
      category: CommandCategory.JOB,
      method: HttpMethod.POST,
      route: '/job/cancel',
      requireAuth: true,
      handler: 'jobController.cancel',
    });

    this.register('job.list', {
      id: 'job.list',
      name: 'List Jobs',
      description: 'List all jobs with optional filtering',
      category: CommandCategory.JOB,
      method: HttpMethod.GET,
      route: '/job/list',
      requireAuth: true,
      handler: 'jobController.list',
    });

    // Page Commands (4)
    this.register('page.create', {
      id: 'page.create',
      name: 'Create Page',
      description: 'Create a new page instance',
      category: CommandCategory.PAGE,
      method: HttpMethod.POST,
      route: '/page/create',
      requireAuth: true,
      handler: 'pageController.create',
    });

    this.register('page.read', {
      id: 'page.read',
      name: 'Read Page',
      description: 'Read page content or metadata',
      category: CommandCategory.PAGE,
      method: HttpMethod.GET,
      route: '/page/read',
      requireAuth: true,
      handler: 'pageController.read',
    });

    this.register('page.update', {
      id: 'page.update',
      name: 'Update Page',
      description: 'Update page content or settings',
      category: CommandCategory.PAGE,
      method: HttpMethod.PUT,
      route: '/page/update',
      requireAuth: true,
      handler: 'pageController.update',
    });

    this.register('page.delete', {
      id: 'page.delete',
      name: 'Delete Page',
      description: 'Delete a page instance',
      category: CommandCategory.PAGE,
      method: HttpMethod.DELETE,
      route: '/page/delete',
      requireAuth: true,
      handler: 'pageController.delete',
    });

    // Cron Commands (4)
    this.register('cron.schedule', {
      id: 'cron.schedule',
      name: 'Schedule Job',
      description: 'Schedule a command to run on a cron pattern',
      category: CommandCategory.CRON,
      method: HttpMethod.POST,
      route: '/cron/schedule',
      requireAuth: true,
      handler: 'cronController.schedule',
    });

    this.register('cron.unschedule', {
      id: 'cron.unschedule',
      name: 'Unschedule Job',
      description: 'Remove a scheduled cron job',
      category: CommandCategory.CRON,
      method: HttpMethod.POST,
      route: '/cron/unschedule',
      requireAuth: true,
      handler: 'cronController.unschedule',
    });

    this.register('cron.list', {
      id: 'cron.list',
      name: 'List Scheduled Jobs',
      description: 'List all scheduled cron jobs',
      category: CommandCategory.CRON,
      method: HttpMethod.GET,
      route: '/cron/list',
      requireAuth: true,
      handler: 'cronController.list',
    });

    this.register('cron.trigger', {
      id: 'cron.trigger',
      name: 'Trigger Job',
      description: 'Manually trigger a scheduled cron job',
      category: CommandCategory.CRON,
      method: HttpMethod.POST,
      route: '/cron/trigger',
      requireAuth: true,
      handler: 'cronController.trigger',
    });

    // Cleanup Commands (4)
    this.register('cleanup.logs', {
      id: 'cleanup.logs',
      name: 'Cleanup Logs',
      description: 'Clean up old log files',
      category: CommandCategory.CLEANUP,
      method: HttpMethod.POST,
      route: '/cleanup/logs',
      requireAuth: true,
      handler: 'cleanupController.logs',
    });

    this.register('cleanup.cache', {
      id: 'cleanup.cache',
      name: 'Cleanup Cache',
      description: 'Clean up cached files',
      category: CommandCategory.CLEANUP,
      method: HttpMethod.POST,
      route: '/cleanup/cache',
      requireAuth: true,
      handler: 'cleanupController.cache',
    });

    this.register('cleanup.temp', {
      id: 'cleanup.temp',
      name: 'Cleanup Temp Files',
      description: 'Clean up temporary files',
      category: CommandCategory.CLEANUP,
      method: HttpMethod.POST,
      route: '/cleanup/temp',
      requireAuth: true,
      handler: 'cleanupController.temp',
    });

    this.register('cleanup.sessions', {
      id: 'cleanup.sessions',
      name: 'Cleanup Sessions',
      description: 'Clean up expired sessions',
      category: CommandCategory.CLEANUP,
      method: HttpMethod.POST,
      route: '/cleanup/sessions',
      requireAuth: true,
      handler: 'cleanupController.sessions',
    });

    // Error Commands (4)
    this.register('error.report', {
      id: 'error.report',
      name: 'Report Error',
      description: 'Report an error occurrence',
      category: CommandCategory.ERROR,
      method: HttpMethod.POST,
      route: '/error/report',
      requireAuth: false,
      handler: 'errorController.report',
    });

    this.register('error.status', {
      id: 'error.status',
      name: 'Get Error Status',
      description: 'Get current error status and statistics',
      category: CommandCategory.ERROR,
      method: HttpMethod.GET,
      route: '/error/status',
      requireAuth: true,
      handler: 'errorController.status',
    });

    this.register('error.history', {
      id: 'error.history',
      name: 'Get Error History',
      description: 'Get error history with filtering',
      category: CommandCategory.ERROR,
      method: HttpMethod.GET,
      route: '/error/history',
      requireAuth: true,
      handler: 'errorController.history',
    });

    this.register('error.resolve', {
      id: 'error.resolve',
      name: 'Resolve Error',
      description: 'Mark an error as resolved',
      category: CommandCategory.ERROR,
      method: HttpMethod.POST,
      route: '/error/resolve',
      requireAuth: true,
      handler: 'errorController.resolve',
    });

    console.log(
      `[CommandRegistry] Initialized ${this.getAll().length} commands across ${this.categories.size} categories`
    );
  }
}

// Export singleton instance
export const commandRegistry = new CommandRegistry();
