/**
 * IAAPA Command Handlers
 * Command handlers for IAAPA expo data operations
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import iaapaController from '../../controllers/iaapaController';
import fs from 'fs';
import path from 'path';

/**
 * IAAPA Search Handler - Search IAAPA data
 */
export class IaapaSearchHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.query || typeof payload.query !== 'string') {
      errors.push('query is required and must be a string');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const query = _payload.query as string;
      const filters = _payload.filters as Record<string, unknown> | undefined;
      const options = _payload.options as Record<string, unknown> | undefined;

      // Search in IAAPA data files
      const dataDir = path.join(process.cwd(), 'Data');
      const results: Record<string, unknown>[] = [];

      // Load IAAPA JSON files
      if (fs.existsSync(dataDir)) {
        const files = fs
          .readdirSync(dataDir)
          .filter(f => f.endsWith('.json') && f.startsWith('iaapa'));

        for (const file of files) {
          const filePath = path.join(dataDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const rows = data.DATA || data.data || [];

          for (const row of rows) {
            const rowStr = JSON.stringify(row).toLowerCase();
            if (rowStr.includes(query.toLowerCase())) {
              results.push(row);
            }
          }
        }
      }

      const limit = (options?.limit as number | undefined) || 50;

      return {
        success: true,
        data: {
          results: results.slice(0, limit),
          total: results.length,
          query,
          filters,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'IAAPA_SEARCH_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'iaapa';
  }

  getName(): string {
    return 'iaapa.search';
  }
}

/**
 * IAAPA Filter Handler - Filter IAAPA results
 */
export class IaapaFilterHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.filters || typeof payload.filters !== 'object') {
      errors.push('filters is required and must be an object');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const filters = _payload.filters as Record<string, unknown>;
      const options = _payload.options as Record<string, unknown> | undefined;
      const dataDir = path.join(process.cwd(), 'Data');
      let allData: Record<string, unknown>[] = [];

      // Load all IAAPA data
      if (fs.existsSync(dataDir)) {
        const files = fs
          .readdirSync(dataDir)
          .filter(f => f.endsWith('.json') && f.startsWith('iaapa'));

        for (const file of files) {
          const filePath = path.join(dataDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const rows = data.DATA || data.data || [];
          allData = allData.concat(rows);
        }
      }

      // Apply filters
      const filtered = allData.filter((item: unknown) => {
        const row = item as Record<string, unknown>;
        for (const [key, value] of Object.entries(filters)) {
          if (row[key] !== value) {
            return false;
          }
        }
        return true;
      });

      const limit = (options?.limit as number | undefined) || 100;
      const offset = (options?.offset as number | undefined) || 0;

      return {
        success: true,
        data: {
          results: filtered.slice(offset, offset + limit),
          total: filtered.length,
          filtered: filtered.length,
          offset,
          limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'IAAPA_FILTER_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'iaapa';
  }

  getName(): string {
    return 'iaapa.filter';
  }
}

/**
 * IAAPA Export Handler - Export IAAPA data
 */
export class IaapaExportHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    const format = payload.format as string;
    if (!format || !['csv', 'json', 'xlsx'].includes(format)) {
      errors.push('format is required and must be csv, json, or xlsx');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const format = _payload.format as 'csv' | 'json' | 'xlsx';
      const _filters = _payload.filters as Record<string, unknown> | undefined;
      const filename = _payload.filename as string | undefined;

      const dataDir = path.join(process.cwd(), 'Data');
      let allData: Record<string, unknown>[] = [];

      // Load all IAAPA data
      if (fs.existsSync(dataDir)) {
        const files = fs
          .readdirSync(dataDir)
          .filter(f => f.endsWith('.json') && f.startsWith('iaapa'));

        for (const file of files) {
          const filePath = path.join(dataDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const rows = data.DATA || data.data || [];
          allData = allData.concat(rows);
        }
      }

      let exportedData: string;
      let mimeType: string;

      if (format === 'json') {
        exportedData = JSON.stringify(allData, null, 2);
        mimeType = 'application/json';
      } else {
        // CSV export
        const headers = allData.length > 0 ? Object.keys(allData[0] as object) : [];
        const csvRows = [headers.join(',')];

        for (const row of allData) {
          const values = headers.map(h => {
            const val = (row as Record<string, unknown>)[h];
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
          });
          csvRows.push(values.join(','));
        }

        exportedData = csvRows.join('\n');
        mimeType = 'text/csv';
      }

      return {
        success: true,
        data: {
          format,
          filename: filename || `iaapa_export_${Date.now()}.${format}`,
          size: exportedData.length,
          mimeType,
          recordCount: allData.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'IAAPA_EXPORT_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'iaapa';
  }

  getName(): string {
    return 'iaapa.export';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'export';
  }
}

/**
 * IAAPA Import Handler - Import IAAPA data
 */
export class IaapaImportHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.source || typeof payload.source !== 'string') {
      errors.push('source is required and must be a string');
    }

    const format = payload.format as string;
    if (!format || !['csv', 'json'].includes(format)) {
      errors.push('format is required and must be csv or json');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const source = _payload.source as string;
      const format = _payload.format as 'csv' | 'json';
      const options = _payload.options as Record<string, unknown> | undefined;

      let importedCount = 0;

      if (source.startsWith('http')) {
        // Import from URL
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${source}: ${response.statusText}`);
        }

        if (format === 'json') {
          const data = await response.json();
          importedCount = Array.isArray(data) ? data.length : 0;
        }
      } else {
        // Import from file
        if (fs.existsSync(source)) {
          const content = fs.readFileSync(source, 'utf-8');

          if (format === 'json') {
            const data = JSON.parse(content);
            importedCount = Array.isArray(data) ? data.length : 0;
          }
        } else {
          throw new Error(`File not found: ${source}`);
        }
      }

      return {
        success: true,
        data: {
          source,
          format,
          importedCount,
          options,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'IAAPA_IMPORT_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'iaapa';
  }

  getName(): string {
    return 'iaapa.import';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * IAAPA Run Job Handler - Run IAAPA scraping job
 */
export class IaapaRunJobHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.file || typeof payload.file !== 'string') {
      errors.push('file is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await iaapaController.runAll(
        { query: { file: _payload.file } } as any,
        {
          json: (data: unknown) => data,
        } as any
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'IAAPA_RUN_JOB_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'iaapa';
  }

  getName(): string {
    return 'iaapa.runJob';
  }
}

/**
 * IAAPA Status Handler - Get job status
 */
export class IaapaStatusHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.jobId || typeof payload.jobId !== 'string') {
      errors.push('jobId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(_payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await iaapaController.status(
        { query: { id: _payload.jobId } } as any,
        {
          json: (data: unknown) => data,
        } as any
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'IAAPA_STATUS_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'iaapa';
  }

  getName(): string {
    return 'iaapa.status';
  }
}

/**
 * Export all IAAPA handlers
 */
export const iaapaHandlers = {
  'iaapa.search': new IaapaSearchHandler(),
  'iaapa.filter': new IaapaFilterHandler(),
  'iaapa.export': new IaapaExportHandler(),
  'iaapa.import': new IaapaImportHandler(),
  'iaapa.runJob': new IaapaRunJobHandler(),
  'iaapa.status': new IaapaStatusHandler(),
};
