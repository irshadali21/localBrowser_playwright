/**
 * Gateway Handlers Index
 * Exports all command handlers and provides handler factory for dynamic lookup
 */

import { BaseCommandHandler } from './baseCommandHandler';
import {
  browserHandlers,
  BrowserVisitHandler,
  BrowserExecuteHandler,
  BrowserScreenshotHandler,
  BrowserNavigateHandler,
  BrowserEvaluateHandler,
  BrowserSearchHandler,
  BrowserScrapeHandler,
} from './browserHandlers';
import {
  chatHandlers,
  ChatMessageHandler,
  ChatConversationHandler,
  ChatHistoryHandler,
  ChatClearHandler,
  ChatPrepareHandler,
} from './chatHandlers';
import {
  iaapaHandlers,
  IaapaSearchHandler,
  IaapaFilterHandler,
  IaapaExportHandler,
  IaapaImportHandler,
  IaapaRunJobHandler,
  IaapaStatusHandler,
} from './iaapaHandlers';
import {
  internalHandlers,
  InternalHealthHandler,
  InternalMetricsHandler,
  InternalConfigHandler,
  InternalWorkerHandler,
  InternalPingHandler,
} from './internalHandlers';
import {
  jobHandlers,
  JobCreateHandler,
  JobStatusHandler,
  JobCancelHandler,
  JobListHandler,
  JobRetryHandler,
} from './jobHandlers';
import {
  pageHandlers,
  PageCreateHandler,
  PageReadHandler,
  PageUpdateHandler,
  PageDeleteHandler,
  PageListHandler,
} from './pageHandlers';
import {
  cronHandlers,
  CronScheduleHandler,
  CronUnscheduleHandler,
  CronListHandler,
  CronTriggerHandler,
  CronCleanupPagesHandler,
  CronGetPageStatsHandler,
} from './cronHandlers';
import {
  cleanupHandlers,
  CleanupLogsHandler,
  CleanupCacheHandler,
  CleanupTempHandler,
  CleanupSessionsHandler,
  CleanupStatsHandler,
  CleanupAllHandler,
} from './cleanupHandlers';
import {
  errorHandlers,
  ErrorReportHandler,
  ErrorStatusHandler,
  ErrorHistoryHandler,
  ErrorResolveHandler,
  ErrorLogHandler,
} from './errorHandlers';
import { GatewayRequest, GatewayResponse, CommandCategory } from '../commandTypes';

// Re-export all handlers
export {
  // Base handler
  BaseCommandHandler,

  // Browser handlers
  browserHandlers,
  BrowserVisitHandler,
  BrowserExecuteHandler,
  BrowserScreenshotHandler,
  BrowserNavigateHandler,
  BrowserEvaluateHandler,
  BrowserSearchHandler,
  BrowserScrapeHandler,

  // Chat handlers
  chatHandlers,
  ChatMessageHandler,
  ChatConversationHandler,
  ChatHistoryHandler,
  ChatClearHandler,
  ChatPrepareHandler,

  // IAAPA handlers
  iaapaHandlers,
  IaapaSearchHandler,
  IaapaFilterHandler,
  IaapaExportHandler,
  IaapaImportHandler,
  IaapaRunJobHandler,
  IaapaStatusHandler,

  // Internal handlers
  internalHandlers,
  InternalHealthHandler,
  InternalMetricsHandler,
  InternalConfigHandler,
  InternalWorkerHandler,
  InternalPingHandler,

  // Job handlers
  jobHandlers,
  JobCreateHandler,
  JobStatusHandler,
  JobCancelHandler,
  JobListHandler,
  JobRetryHandler,

  // Page handlers
  pageHandlers,
  PageCreateHandler,
  PageReadHandler,
  PageUpdateHandler,
  PageDeleteHandler,
  PageListHandler,

  // Cron handlers
  cronHandlers,
  CronScheduleHandler,
  CronUnscheduleHandler,
  CronListHandler,
  CronTriggerHandler,
  CronCleanupPagesHandler,
  CronGetPageStatsHandler,

  // Cleanup handlers
  cleanupHandlers,
  CleanupLogsHandler,
  CleanupCacheHandler,
  CleanupTempHandler,
  CleanupSessionsHandler,
  CleanupStatsHandler,
  CleanupAllHandler,

  // Error handlers
  errorHandlers,
  ErrorReportHandler,
  ErrorStatusHandler,
  ErrorHistoryHandler,
  ErrorResolveHandler,
  ErrorLogHandler,
};

// Combined handlers map
const allHandlers = {
  ...browserHandlers,
  ...chatHandlers,
  ...iaapaHandlers,
  ...internalHandlers,
  ...jobHandlers,
  ...pageHandlers,
  ...cronHandlers,
  ...cleanupHandlers,
  ...errorHandlers,
};

/**
 * Handler factory for creating/dynamically looking up handlers
 */
export class HandlerFactory {
  private static instance: HandlerFactory;
  private handlers: Map<string, BaseCommandHandler>;

  private constructor() {
    this.handlers = new Map(Object.entries(allHandlers));
  }

  static getInstance(): HandlerFactory {
    if (!HandlerFactory.instance) {
      HandlerFactory.instance = new HandlerFactory();
    }
    return HandlerFactory.instance;
  }

  /**
   * Get handler by command ID
   */
  getHandler(commandId: string): BaseCommandHandler | undefined {
    return this.handlers.get(commandId);
  }

  /**
   * Register a handler
   */
  register(commandId: string, handler: BaseCommandHandler): void {
    this.handlers.set(commandId, handler);
  }

  /**
   * Unregister a handler
   */
  unregister(commandId: string): boolean {
    return this.handlers.delete(commandId);
  }

  /**
   * Get all handler command IDs
   */
  getCommandIds(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handlers by category
   */
  getHandlersByCategory(category: CommandCategory): BaseCommandHandler[] {
    const categoryPrefix = category + '.';
    return Array.from(this.handlers.entries())
      .filter(([commandId]) => commandId.startsWith(categoryPrefix))
      .map(([, handler]) => handler);
  }

  /**
   * Get handler categories
   */
  getCategories(): CommandCategory[] {
    const categories = new Set<CommandCategory>();
    for (const commandId of this.handlers.keys()) {
      const category = commandId.split('.')[0] as CommandCategory;
      if (Object.values(CommandCategory).includes(category)) {
        categories.add(category);
      }
    }
    return Array.from(categories);
  }

  /**
   * Check if handler exists
   */
  hasHandler(commandId: string): boolean {
    return this.handlers.has(commandId);
  }

  /**
   * Get all handlers
   */
  getAllHandlers(): Map<string, BaseCommandHandler> {
    return new Map(this.handlers);
  }
}

/**
 * Process a command through the appropriate handler
 */
export async function processCommand(request: GatewayRequest): Promise<GatewayResponse> {
  const factory = HandlerFactory.getInstance();
  const handler = factory.getHandler(request.commandId);

  if (!handler) {
    return {
      success: false,
      error: {
        code: 'HANDLER_NOT_FOUND',
        message: `No handler found for command: ${request.commandId}`,
        details: {
          availableCommands: factory.getCommandIds(),
        },
      },
      metadata: {
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        commandId: request.commandId,
        version: request.version || '1.0.0',
      },
    };
  }

  return handler.process(request);
}

/**
 * Get all available commands with metadata
 */
export function getAvailableCommands(): Array<{ id: string; category: string; name: string }> {
  const factory = HandlerFactory.getInstance();
  const commands: Array<{ id: string; category: string; name: string }> = [];

  for (const commandId of factory.getCommandIds()) {
    const handler = factory.getHandler(commandId);
    if (handler) {
      const [category] = commandId.split('.');
      commands.push({
        id: commandId,
        category,
        name: handler.getName(),
      });
    }
  }

  return commands;
}

/**
 * Default export with all handlers and factory
 */
export default {
  ...allHandlers,
  HandlerFactory,
  processCommand,
  getAvailableCommands,
};
