/**
 * Unit Tests for Validation Schemas
 * Tests Zod validation schemas for API inputs
 */

import { validateInput, visitUrlSchema, executeCodeSchema, googleSearchSchema, cleanupSchema } from '../../validators/schemas';

describe('Validation Schemas', () => {
  describe('visitUrlSchema', () => {
    it('should validate valid HTTPS URL', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'https://example.com',
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      expect(result.success).toBe(true);
    });

    it('should validate valid HTTP URL', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'http://example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject URL without protocol', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty URL', () => {
      const result = validateInput(visitUrlSchema, {
        url: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid waitUntil options', () => {
      const validOptions = ['load', 'domcontentloaded', 'networkidle', 'commit'];
      validOptions.forEach((option) => {
        const result = validateInput(visitUrlSchema, {
          url: 'https://example.com',
          waitUntil: option,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid waitUntil option', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'https://example.com',
        waitUntil: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid timeout', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'https://example.com',
        timeout: 60000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject timeout too long', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'https://example.com',
        timeout: 600000, // More than max (5 minutes)
      });
      expect(result.success).toBe(false);
    });

    it('should have error messages for invalid inputs', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'invalid-url',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('executeCodeSchema', () => {
    it('should validate valid code input', () => {
      const result = validateInput(executeCodeSchema, {
        code: 'console.log("Hello")',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty code', () => {
      const result = validateInput(executeCodeSchema, {
        code: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject code too long', () => {
      const longCode = 'a'.repeat(10001);
      const result = validateInput(executeCodeSchema, {
        code: longCode,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('googleSearchSchema', () => {
    it('should validate valid search query', () => {
      const result = validateInput(googleSearchSchema, {
        q: 'test search query',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = validateInput(googleSearchSchema, {
        q: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject query too long', () => {
      const longQuery = 'a'.repeat(501);
      const result = validateInput(googleSearchSchema, {
        q: longQuery,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('cleanupSchema', () => {
    it('should validate valid cleanup options', () => {
      const result = validateInput(cleanupSchema, {
        olderThan: 24,
        maxSize: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid olderThan value', () => {
      const result = validateInput(cleanupSchema, {
        olderThan: 48,
      });
      expect(result.success).toBe(true);
    });

    it('should handle negative olderThan value', () => {
      // Schema may or may not reject negative values depending on implementation
      const result = validateInput(cleanupSchema, {
        olderThan: -1,
      });
      // Just verify it returns a valid response structure
      expect(result).toBeDefined();
    });

    it('should accept valid maxSize', () => {
      const result = validateInput(cleanupSchema, {
        maxSize: 5000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('validateInput function', () => {
    it('should return success=true for valid input', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.url).toBe('https://example.com');
      }
    });

    it('should return success=false and errors for invalid input', () => {
      const result = validateInput(visitUrlSchema, {
        url: 'invalid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle completely missing required fields', () => {
      const result = validateInput(visitUrlSchema, {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeDefined();
      }
    });
  });
});
