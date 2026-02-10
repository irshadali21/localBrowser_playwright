/**
 * Unit Tests for Browser Controller
 * Tests browser automation controller methods with mocked dependencies
 */

import { Response } from 'express';
import * as browserController from '../../controllers/browserController';
import { ValidationError } from '../../types/errors';

// Mock data for getHtmlFile
const mockFileData = {
  html: '<html>test</html>',
  fileName: 'test-file-123.html',
};

// Create mock functions separately
const mockExecuteCode = jest.fn();
const mockGoogleSearch = jest.fn();
const mockVisitUrl = jest.fn();
const mockScrapeProduct = jest.fn();
const mockGetHtmlFile = jest.fn();

// Mock the browserHelper module
jest.mock('../../helpers/browserHelper', () => ({
  browserHelper: {
    executeCode: (...args: any[]) => mockExecuteCode(...args),
    googleSearch: (...args: any[]) => mockGoogleSearch(...args),
    visitUrl: (...args: any[]) => mockVisitUrl(...args),
    scrapeProduct: (...args: any[]) => mockScrapeProduct(...args),
    getBrowserPage: jest.fn(),
    closeBrowser: jest.fn(),
  },
  getHtmlFile: (...args: any[]) => mockGetHtmlFile(...args),
}));

// Mock the errorLogger
jest.mock('../../utils/errorLogger', () => ({
  logErrorToDB: jest.fn().mockResolvedValue(undefined),
}));

describe('BrowserController', () => {
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe('execute', () => {
    it('should execute code successfully', async () => {
      const mockRequest = {
        body: { code: 'console.log("test")' },
      };

      const expectedResult = { output: 'test output' };
      mockExecuteCode.mockResolvedValue(expectedResult);

      await browserController.execute(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockExecuteCode).toHaveBeenCalledWith('console.log("test")');
      expect(mockResponse.json).toHaveBeenCalledWith({ result: expectedResult });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for empty code', async () => {
      const mockRequest = {
        body: { code: '' },
      };

      // Validation errors are thrown synchronously
      await expect(
        browserController.execute(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should handle execution errors', async () => {
      const mockRequest = {
        body: { code: 'throw new Error("test")' },
      };

      mockExecuteCode.mockRejectedValue(new Error('Execution failed'));

      await browserController.execute(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('search', () => {
    it('should perform Google search successfully', async () => {
      const mockRequest = {
        query: { q: 'test query' },
      };

      const expectedResults = [
        { title: 'Result 1', link: 'https://example1.com', snippet: 'Snippet 1' },
        { title: 'Result 2', link: 'https://example2.com', snippet: 'Snippet 2' },
      ];
      mockGoogleSearch.mockResolvedValue(expectedResults);

      await browserController.search(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockGoogleSearch).toHaveBeenCalledWith('test query');
      expect(mockResponse.json).toHaveBeenCalledWith({ results: expectedResults });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for missing query', async () => {
      const mockRequest = {
        query: {},
      };

      // Validation errors are thrown synchronously
      await expect(
        browserController.search(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Search query is required');
    });

    it('should throw ValidationError for empty query', async () => {
      const mockRequest = {
        query: { q: '' },
      };

      await expect(
        browserController.search(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Search query is required');
    });

    it('should handle search errors', async () => {
      const mockRequest = {
        query: { q: 'test query' },
      };

      mockGoogleSearch.mockRejectedValue(new Error('Search failed'));

      await browserController.search(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('visit', () => {
    it('should visit URL with default options', async () => {
      const mockRequest = {
        query: { url: 'https://example.com' },
      };

      const expectedResult = { html: '<html>...</html>', url: 'https://example.com' };
      mockVisitUrl.mockResolvedValue(expectedResult);

      await browserController.visit(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      // The visit function parses options with defaults
      expect(mockVisitUrl).toHaveBeenCalledWith('https://example.com', {
        returnHtml: false,
        saveToFile: true,
        waitUntil: 'networkidle',
        timeout: 60000,
        handleCloudflare: true,
        useProgressiveRetry: true,
      });
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should visit URL with custom options', async () => {
      const mockRequest = {
        query: {
          url: 'https://example.com',
          waitUntil: 'load',
          timeout: '30000',
          returnHtml: 'true',
          saveToFile: 'false',
        },
      };

      const expectedResult = '<html>...</html>';
      mockVisitUrl.mockResolvedValue(expectedResult);

      await browserController.visit(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockVisitUrl).toHaveBeenCalledWith('https://example.com', {
        returnHtml: true,
        saveToFile: false,
        waitUntil: 'load',
        timeout: 30000,
        handleCloudflare: true,
        useProgressiveRetry: true,
      });
    });

    it('should return HTML when returnHtml is true', async () => {
      const mockRequest = {
        query: { url: 'https://example.com', returnHtml: 'true' },
      };

      const expectedHtml = '<html><body>Test</body></html>';
      mockVisitUrl.mockResolvedValue(expectedHtml);

      await browserController.visit(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({ html: expectedHtml });
    });

    it('should throw ValidationError for missing URL', async () => {
      const mockRequest = {
        query: {},
      };

      await expect(
        browserController.visit(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Valid URL (http/https) is required');
    });

    it('should throw ValidationError for URL without protocol', async () => {
      const mockRequest = {
        query: { url: 'example.com' },
      };

      await expect(
        browserController.visit(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Valid URL (http/https) is required');
    });

    it('should handle visit errors', async () => {
      const mockRequest = {
        query: { url: 'https://example.com' },
      };

      mockVisitUrl.mockRejectedValue(new Error('Navigation failed'));

      await browserController.visit(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('download', () => {
    it('should download file successfully', async () => {
      const mockRequest = {
        params: { fileId: 'test-file-123' },
      };

      mockGetHtmlFile.mockResolvedValue(mockFileData);

      await browserController.download(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockGetHtmlFile).toHaveBeenCalledWith('test-file-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="test-file-123.html"'
      );
      expect(mockResponse.send).toHaveBeenCalledWith('<html>test</html>');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for missing fileId', async () => {
      const mockRequest = {
        params: {},
      };

      await expect(
        browserController.download(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Invalid file ID');
    });

    it('should return 404 when file not found', async () => {
      const mockRequest = {
        params: { fileId: 'nonexistent-file' },
      };

      mockGetHtmlFile.mockRejectedValue(new Error('File not found'));

      await browserController.download(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'File not found' });
    });
  });

  describe('view', () => {
    it('should view file metadata successfully', async () => {
      const mockRequest = {
        params: { fileId: 'test-file-123' },
      };

      mockGetHtmlFile.mockResolvedValue(mockFileData);

      await browserController.view(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockGetHtmlFile).toHaveBeenCalledWith('test-file-123');
      expect(mockResponse.json).toHaveBeenCalledWith(mockFileData);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for missing fileId', async () => {
      const mockRequest = {
        params: {},
      };

      await expect(
        browserController.view(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Invalid file ID');
    });

    it('should handle view errors', async () => {
      const mockRequest = {
        params: { fileId: 'test-file-123' },
      };

      mockGetHtmlFile.mockRejectedValue(new Error('Failed to load file'));

      await browserController.view(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('scrape', () => {
    it('should scrape product successfully', async () => {
      const mockRequest = {
        query: { url: 'https://example.com/product', vendor: 'test-vendor' },
      };

      const expectedResult = {
        name: 'Test Product',
        price: '29.99',
        description: 'A test product',
      };
      mockScrapeProduct.mockResolvedValue(expectedResult);

      await browserController.scrape(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockScrapeProduct).toHaveBeenCalledWith(
        'https://example.com/product',
        'test-vendor'
      );
      expect(mockResponse.json).toHaveBeenCalledWith(expectedResult);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for missing URL', async () => {
      const mockRequest = {
        query: { vendor: 'test-vendor' },
      };

      await expect(
        browserController.scrape(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Valid URL (http/https) is required');
    });

    it('should throw ValidationError for URL without protocol', async () => {
      const mockRequest = {
        query: { url: 'example.com/product', vendor: 'test-vendor' },
      };

      await expect(
        browserController.scrape(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Valid URL (http/https) is required');
    });

    it('should throw ValidationError for missing vendor', async () => {
      const mockRequest = {
        query: { url: 'https://example.com/product' },
      };

      await expect(
        browserController.scrape(
          mockRequest as any,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Vendor parameter is required');
    });

    it('should handle scrape errors', async () => {
      const mockRequest = {
        query: { url: 'https://example.com/product', vendor: 'test-vendor' },
      };

      mockScrapeProduct.mockRejectedValue(new Error('Scraping failed'));

      await browserController.scrape(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
    });
  });
});
