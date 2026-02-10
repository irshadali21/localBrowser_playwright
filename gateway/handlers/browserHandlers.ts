/**
 * Browser Command Handlers
 * Command handlers for browser automation operations
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import browserController from '../../controllers/browserController';

/**
 * Browser Visit Handler - Navigate to URL
 */
export class BrowserVisitHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.url || typeof payload.url !== 'string') {
      errors.push('url is required and must be a string');
    } else if (!/^https?:\/\//.test(payload.url)) {
      errors.push('url must start with http:// or https://');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      // Call browser controller with query params
      const result = await browserController.visit(
        { query: { url: _payload.url as string } } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'VISIT_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.visit';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'read';
  }
}

/**
 * Browser Execute Handler - Execute JavaScript
 */
export class BrowserExecuteHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.code || typeof payload.code !== 'string') {
      errors.push('code is required and must be a string');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await browserController.execute(
        { body: { code: _payload.code } } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'EXECUTE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.execute';
  }
}

/**
 * Browser Screenshot Handler - Take screenshot
 */
export class BrowserScreenshotHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    // Screenshot is optional, no validation required
    return { valid: true };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const pageId = _payload.pageId as string | undefined;
      const options = _payload.options as Record<string, unknown> | undefined;

      // Get browser helper for screenshot
      const browserHelper = await import('../../helpers/browserHelper');

      const result = (await (browserHelper as any).takeScreenshot?.(pageId, options)) || {
        message: 'Screenshot feature requires browser context',
        pageId,
        options,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'SCREENSHOT_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.screenshot';
  }
}

/**
 * Browser Navigate Handler - Navigation operations
 */
export class BrowserNavigateHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.url || typeof payload.url !== 'string') {
      errors.push('url is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      // Reuse visit handler logic
      const visitPayload: Record<string, unknown> = {
        url: _payload.url,
        options: _payload.options,
      };

      const result = await new BrowserVisitHandler().execute(visitPayload, _context);

      return result;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'NAVIGATE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.navigate';
  }
}

/**
 * Browser Evaluate Handler - Evaluate expressions
 */
export class BrowserEvaluateHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.expression || typeof payload.expression !== 'string') {
      errors.push('expression is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const browserHelper = await import('../../helpers/browserHelper');

      const result = (await (browserHelper as any).evaluate?.(_payload.expression, {
        pageId: _payload.pageId,
        timeout: _payload.timeout,
      })) || {
        expression: _payload.expression,
        result: null,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'EVALUATE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.evaluate';
  }
}

/**
 * Browser Search Handler - Perform search
 */
export class BrowserSearchHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const query = payload.query as string;
    if (!query || typeof query !== 'string' || query.trim() === '') {
      errors.push('query is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    const query = payload.query as string;

    try {
      const result = await browserController.search(
        { query: { q: query } } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'SEARCH_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.search';
  }
}

/**
 * Browser Scrape Handler - Scrape data from URL
 */
export class BrowserScrapeHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const url = payload.url as string;
    if (!url || typeof url !== 'string') {
      errors.push('url is required');
    } else if (!/^https?:\/\//.test(url)) {
      errors.push('url must start with http:// or https://');
    }

    const vendor = payload.vendor as string;
    if (!vendor || typeof vendor !== 'string') {
      errors.push('vendor is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    const url = payload.url as string;
    const vendor = payload.vendor as string;

    try {
      const result = await browserController.scrape(
        { query: { url, vendor } } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'SCRAPE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'browser';
  }

  getName(): string {
    return 'browser.scrape';
  }
}

/**
 * Export all browser handlers
 */
export const browserHandlers = {
  'browser.visit': new BrowserVisitHandler(),
  'browser.execute': new BrowserExecuteHandler(),
  'browser.screenshot': new BrowserScreenshotHandler(),
  'browser.navigate': new BrowserNavigateHandler(),
  'browser.evaluate': new BrowserEvaluateHandler(),
  'browser.search': new BrowserSearchHandler(),
  'browser.scrape': new BrowserScrapeHandler(),
};
