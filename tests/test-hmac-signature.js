// tests/test-hmac-signature.js

const crypto = require('crypto');
const assert = require('assert');
const hmacSignature = require('../middleware/hmacSignature');

describe('HMAC Signature Middleware', () => {
  const secret = 'test_secret_key_32_chars_long!!';
  const SIGNATURE_WINDOW_SECONDS = 300;

  beforeEach(() => {
    process.env.LOCALBROWSER_SECRET = secret;
  });

  describe('Valid Signatures', () => {
    it('should accept valid signature with current timestamp', (done) => {
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
      };

      const res = {
        set: () => {},
        status: function() { return this; },
        json: function(data) { return data; },
        headers: {},
        setHeader: function(k, v) { this.headers[k] = v; },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      hmacSignature(req, res, next);
      assert(nextCalled, 'Next middleware should have been called');
      done();
    });

    it('should accept signature within 5 minute window', (done) => {
      const timestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
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
      };

      const res = {
        set: () => {},
        status: function() { return this; },
        json: function(data) { return data; },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      hmacSignature(req, res, next);
      assert(nextCalled, 'Next middleware should have been called');
      done();
    });
  });

  describe('Invalid Signatures', () => {
    it('should reject invalid signature', (done) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const invalidSignature = 'invalid_signature_hex_string';

      const req = {
        headers: {
          'x-signature': invalidSignature,
          'x-timestamp': timestamp.toString(),
        },
        path: '/internal/request-work',
      };

      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          assert.strictEqual(this.statusCode, 401);
          assert(data.error);
          return data;
        },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = false;
      };

      hmacSignature(req, res, next);
      assert(!nextCalled, 'Next middleware should not have been called');
      done();
    });

    it('should reject expired timestamp (older than 5 minutes)', (done) => {
      const timestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
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
      };

      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          assert.strictEqual(this.statusCode, 401);
          assert(data.error.includes('Timestamp'));
          return data;
        },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = false;
      };

      hmacSignature(req, res, next);
      assert(!nextCalled, 'Next middleware should not have been called');
      done();
    });

    it('should reject missing X-Signature header', (done) => {
      const timestamp = Math.floor(Date.now() / 1000);

      const req = {
        headers: {
          'x-timestamp': timestamp.toString(),
          // Missing X-Signature
        },
        path: '/internal/request-work',
      };

      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          assert.strictEqual(this.statusCode, 401);
          assert(data.error);
          return data;
        },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = false;
      };

      hmacSignature(req, res, next);
      assert(!nextCalled, 'Next middleware should not have been called');
      done();
    });

    it('should reject missing X-Timestamp header', (done) => {
      const signature = 'some_signature';

      const req = {
        headers: {
          'x-signature': signature,
          // Missing X-Timestamp
        },
        path: '/internal/request-work',
      };

      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          assert.strictEqual(this.statusCode, 401);
          assert(data.error);
          return data;
        },
      };

      let nextCalled = false;
      const next = () => {
        nextCalled = false;
      };

      hmacSignature(req, res, next);
      assert(!nextCalled, 'Next middleware should not have been called');
      done();
    });
  });

  describe('Response Signing', () => {
    it('should sign response with X-Signature and X-Timestamp headers', (done) => {
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
      };

      let responseHeaders = {};
      const res = {
        set: function(key, value) {
          responseHeaders[key] = value;
        },
        headers: {},
        setHeader: function(k, v) {
          this.headers[k] = v;
        },
        status: function() { return this; },
        json: function(data) { return data; },
        locals: {},
      };

      const next = () => {
        // Call res.json to trigger signing
        res.json({ status: 'ok' });

        // Verify response was signed
        assert(responseHeaders['X-Signature'], 'X-Signature header should be set');
        assert(responseHeaders['X-Timestamp'], 'X-Timestamp header should be set');
        done();
      };

      hmacSignature(req, res, next);
    });
  });
});
