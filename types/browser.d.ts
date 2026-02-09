/**
 * Type declarations for browser automation patterns
 */

import type { BrowserContext, Page } from 'playwright';

/**
 * Browser session state management
 */
export interface BrowserSession {
  id: number | null;
  page: Page | null;
  context: BrowserContext | null;
  type: SessionType;
  createdAt: Date;
  lastUsed: Date;
}

export type SessionType = 'browser' | 'chat' | 'scraper' | 'chatgpt';

/**
 * Browser configuration options
 */
export interface BrowserConfig {
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  locale?: string;
  timezoneId?: string;
  permissions?: string[];
  ignoreHTTPSErrors?: boolean;
  userAgent?: string;
  args?: string[];
}

/**
 * Page navigation options
 */
export interface VisitOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
  saveToFile?: boolean;
  returnHtml?: boolean;
  handleCloudflare?: boolean;
  useProgressiveRetry?: boolean;
}

/**
 * Page creation options
 */
export interface PageCreateOptions {
  type: SessionType;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  antiDetection?: boolean;
}

/**
 * Page tracking in database
 */
export interface TrackedPage {
  id: number;
  type: SessionType;
  status: 'active' | 'closed';
  createdAt: string;
  lastUsed: string;
}

/**
 * Page factory interface
 */
export interface PageFactory {
  getBrowserContext(): Promise<BrowserContext>;
  getConfiguredPage(): Promise<Page>;
  getContext(): BrowserContext | null;
}

/**
 * Page manager interface
 */
export interface PageManager {
  requestPage(type: SessionType): Promise<{ id: number; page: Page }>;
  createPage(type: SessionType): Promise<{ id: number; page: Page }>;
  closePage(id: number): void;
  closeChat(): Promise<void>;
  listPages(): TrackedPage[];
  getPageById(id: number): Page | undefined;
}

/**
 * Browser helper interface
 */
export interface BrowserHelper {
  getBrowserPage(): Promise<Page>;
  closeBrowser(): Promise<void>;
  executeCode(userCode: string): Promise<unknown>;
  googleSearch(query: string): Promise<SearchResult[]>;
  visitUrl(url: string, options?: VisitOptions): Promise<VisitResult>;
  scrapeProduct(url: string, vendor: string): Promise<Record<string, unknown>>;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface VisitResult {
  fileId?: string;
  html?: string;
  url: string;
  requestedUrl?: string;
  finalUrl?: string;
}

/**
 * Cloudflare helper result
 */
export interface CloudflareResult {
  success: boolean;
  blocked: boolean;
  cloudflareEncountered: boolean;
  finalUrl?: string;
  response?: unknown;
}

/**
 * Error codes for browser operations
 */
export enum BrowserErrorCode {
  CLOUDFLARE_BLOCKED = 'ERR_CLOUDFLARE_BLOCKED',
  NAVIGATION_TIMEOUT = 'ERR_NAVIGATION_TIMEOUT',
  PAGE_CLOSED = 'ERR_PAGE_CLOSED',
  SESSION_NOT_FOUND = 'ERR_SESSION_NOT_FOUND',
  CODE_EXECUTION_ERROR = 'ERR_CODE_EXECUTION',
}

/**
 * Custom browser error class (declaration only)
 */
export class BrowserError extends Error {
  code: BrowserErrorCode;
  context?: Record<string, unknown>;
}
