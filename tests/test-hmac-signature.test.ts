// tests/test-hmac-signature.test.ts

import crypto from 'crypto';
import { verifySignature } from '../middleware/hmacSignature';
import { Request, Response, NextFunction } from 'express';

describe('HMAC Signature Middleware', () => {
  const secret = 'test_secret_key_32_chars_long!!';

  beforeEach(() => {
    process.env.LOCALBROWSER_SECRET = secret;
  });

  describe('Valid Signatures', () => {
    it('should accept valid signature with current timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(timestamp.toString())
        .digest('hex');

      const req = {
        headers: {
          'x-signature': signature,
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      } as unknown as Request;

      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn(),
        locals: {},
      } as unknown as Response;

      verifySignature(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it('should accept signature within 5 minute window', () => {
      const timestamp = Math.floor(Date.now() / 1000) - 60;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(timestamp.toString())
        .digest('hex');

      const req = {
        headers: {
          'x-signature': signature,
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      } as unknown as Request;

      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn(),
        locals: {},
      } as unknown as Response;

      verifySignature(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe('Invalid Signatures', () => {
    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const invalidSignature = 'invalid_signature_hex_string';

      const req = {
        headers: {
          'x-signature': invalidSignature,
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      } as unknown as Request;

      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn(),
        locals: {},
      } as unknown as Response;

      verifySignature(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject expired timestamp', () => {
      const timestamp = Math.floor(Date.now() / 1000) - 400;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(timestamp.toString())
        .digest('hex');

      const req = {
        headers: {
          'x-signature': signature,
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      } as unknown as Request;

      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn(),
        locals: {},
      } as unknown as Response;

      verifySignature(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject missing X-Signature header', () => {
      const timestamp = Math.floor(Date.now() / 1000);

      const req = {
        headers: {
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      } as unknown as Request;

      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn(),
        locals: {},
      } as unknown as Response;

      verifySignature(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject missing X-Timestamp header', () => {
      const signature = 'some_signature';

      const req = {
        headers: {
          'x-signature': signature,
        },
        path: '/internal/request-work',
      } as unknown as Request;

      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn(),
        locals: {},
      } as unknown as Response;

      verifySignature(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Response Signing', () => {
    it('should sign response with headers', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(timestamp.toString())
        .digest('hex');

      const req = {
        headers: {
          'x-signature': signature,
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      } as unknown as Request;

      const responseHeaders: Record<string, string> = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockImplementation(function (this: Response, data: unknown) {
          return this;
        }),
        set: function (key: string, value: string) {
          responseHeaders[key] = value;
        },
        setHeader: function (k: string, v: string) {
          responseHeaders[k] = v;
        },
        locals: {},
      } as unknown as Response;

      const next: NextFunction = jest.fn();

      verifySignature(req, res, next);

      res.json({ status: 'ok' });

      expect(responseHeaders['X-Signature']).toBeDefined();
      expect(responseHeaders['X-Timestamp']).toBeDefined();
    });
  });
});
