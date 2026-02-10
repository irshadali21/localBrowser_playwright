/**
 * Page Command Handlers
 * Command handlers for page operations
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import { listPages, requestPage, closePage } from '../../utils/pageManager';
import type { SessionType } from '../../types/browser';

/**
 * Page Create Handler - Create a new page
 */
export class PageCreateHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const type = payload.type as string;
    if (!type || !['browser', 'chat', 'scraper'].includes(type)) {
      errors.push('type is required and must be browser, chat, or scraper');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const type = payload.type as SessionType;
      const options = payload.options as Record<string, unknown> | undefined;

      const { id } = await requestPage(type);

      return {
        success: true,
        data: {
          pageId: id,
          type,
          options,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PAGE_CREATE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'page';
  }

  getName(): string {
    return 'page.create';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Page Read Handler - Read page info
 */
export class PageReadHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.pageId || typeof payload.pageId !== 'string') {
      errors.push('pageId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const pageIdStr = _payload.pageId as string;
      const pageIdNum = parseInt(pageIdStr, 10);
      const pageId = isNaN(pageIdNum) ? pageIdStr : pageIdNum;

      const pages = listPages();
      const page = pages.find(p => p.id === pageId || String(p.id) === pageIdStr);

      if (!page) {
        return {
          success: false,
          error: 'Page not found',
          code: 'PAGE_NOT_FOUND',
        };
      }

      return {
        success: true,
        data: {
          pageId: page.id,
          type: page.type,
          status: page.status,
          createdAt: page.createdAt,
          lastUsed: page.lastUsed,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PAGE_READ_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'page';
  }

  getName(): string {
    return 'page.read';
  }
}

/**
 * Page Update Handler - Update page
 */
export class PageUpdateHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.pageId || typeof payload.pageId !== 'string') {
      errors.push('pageId is required');
    }

    if (!payload.updates || typeof payload.updates !== 'object') {
      errors.push('updates is required and must be an object');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const pageIdStr = _payload.pageId as string;
      const pageIdNum = parseInt(pageIdStr, 10);
      const pageId = isNaN(pageIdNum) ? pageIdStr : pageIdNum;
      const updates = _payload.updates as Record<string, unknown>;

      // Update page in database
      const db = await import('../../utils/db');
      db.default
        ?.prepare?.('UPDATE active_pages SET last_used = datetime("now") WHERE id = ?')
        ?.run(pageId);

      return {
        success: true,
        data: {
          pageId,
          updates,
          updatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PAGE_UPDATE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'page';
  }

  getName(): string {
    return 'page.update';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Page Delete Handler - Delete/close page
 */
export class PageDeleteHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.pageId || typeof payload.pageId !== 'string') {
      errors.push('pageId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const pageIdStr = _payload.pageId as string;
      const pageIdNum = parseInt(pageIdStr, 10);
      const pageId = isNaN(pageIdNum) ? pageIdStr : pageIdNum;
      const force = _payload.force === true;

      if (typeof pageId === 'number') {
        await closePage(pageId);
      }

      return {
        success: true,
        data: {
          pageId: _payload.pageId,
          status: 'closed',
          force,
          closedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PAGE_DELETE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'page';
  }

  getName(): string {
    return 'page.delete';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Page List Handler - List all pages
 */
export class PageListHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const pages = listPages();
      const typeFilter = payload.type as string | undefined;

      const filteredPages = typeFilter ? pages.filter(p => p.type === typeFilter) : pages;

      return {
        success: true,
        data: {
          pages: filteredPages.map(p => ({
            pageId: p.id,
            type: p.type,
            status: p.status,
            createdAt: p.createdAt,
            lastUsed: p.lastUsed,
          })),
          total: filteredPages.length,
          typeFilter,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PAGE_LIST_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'page';
  }

  getName(): string {
    return 'page.list';
  }
}

/**
 * Export all page handlers
 */
export const pageHandlers = {
  'page.create': new PageCreateHandler(),
  'page.read': new PageReadHandler(),
  'page.update': new PageUpdateHandler(),
  'page.delete': new PageDeleteHandler(),
  'page.list': new PageListHandler(),
};
