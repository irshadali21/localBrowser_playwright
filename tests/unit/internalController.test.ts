/**
 * Unit Tests for Internal Controller
 * Tests internal API controller methods with mocked dependencies
 */

import { Response } from 'express';
import { InternalController } from '../../controllers/internalController';

// Mock the logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock TaskExecutor
const mockTaskExecutor = {
  execute: jest.fn(),
};

// Mock ResultSubmitter
const mockResultSubmitter = {
  submit: jest.fn(),
};

// Mock TaskQueueService
const mockTaskQueueService = {
  getPendingTasks: jest.fn(),
};

// Mock database module
const mockDb = {
  prepare: jest.fn().mockReturnValue({
    all: jest.fn().mockReturnValue([]),
    run: jest.fn(),
  }),
};

// Mock os module
jest.mock('os', () => ({
  hostname: jest.fn().mockReturnValue('test-host'),
}));

// Mock database
jest.mock('../../utils/db', () => ({
  default: mockDb,
}));

describe('InternalController', () => {
  let controller: InternalController;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create controller with mocked dependencies
    controller = new InternalController({
      taskExecutor: mockTaskExecutor,
      resultSubmitter: mockResultSubmitter,
      taskQueueService: mockTaskQueueService,
      logger: mockLogger,
    });

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('ping', () => {
    it('should respond with status ok', async () => {
      const mockRequest = {
        headers: { 'x-timestamp': '1234567890' },
      };

      await controller.ping(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          worker_id: expect.any(String),
          uptime: expect.any(Number),
        })
      );
    });

    it('should log ping received', async () => {
      const mockRequest = {
        headers: {},
      };

      await controller.ping(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[InternalController] Ping received - START',
        expect.any(Object)
      );
    });
  });

  describe('requestWork', () => {
    it('should return tasks when available', async () => {
      const mockRequest = {
        body: { max_tasks: 5 },
      };

      const mockTasks = [
        { id: 'task-1', type: 'scrape', url: 'https://example.com' },
        { id: 'task-2', type: 'visit', url: 'https://test.com' },
      ];

      mockTaskQueueService.getPendingTasks.mockResolvedValue(mockTasks);
      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue([]),
        run: jest.fn(),
      });

      await controller.requestWork(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockTaskQueueService.getPendingTasks).toHaveBeenCalledWith(5);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          tasks: mockTasks,
        })
      );
    });

    it('should return no_work when no tasks available', async () => {
      const mockRequest = {
        body: {},
      };

      mockTaskQueueService.getPendingTasks.mockResolvedValue([]);

      await controller.requestWork(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'no_work',
        tasks: [],
        timestamp: expect.any(Number),
      });
    });

    it('should use default max_tasks when not provided', async () => {
      const mockRequest = {
        body: {},
      };

      mockTaskQueueService.getPendingTasks.mockResolvedValue([]);

      await controller.requestWork(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockTaskQueueService.getPendingTasks).toHaveBeenCalledWith(5); // Default
    });
  });

  describe('submitResult', () => {
    it('should accept valid task result', async () => {
      const mockRequest = {
        body: {
          task_id: 'task-123',
          success: true,
          result: { data: 'test' },
          duration_ms: 1500,
        },
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
      });

      await controller.submitResult(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'accepted',
        task_id: 'task-123',
        timestamp: expect.any(Number),
      });
    });

    it('should return 400 when task_id is missing', async () => {
      const mockRequest = {
        body: {
          success: true,
        },
      };

      await controller.submitResult(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'task_id required',
      });
    });

    it('should handle error result', async () => {
      const mockRequest = {
        body: {
          task_id: 'task-456',
          success: false,
          error: 'Page load timeout',
          duration_ms: 30000,
        },
      };

      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
      });

      await controller.submitResult(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'accepted',
        task_id: 'task-456',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('task validation', () => {
    it('should validate task with all required fields', () => {
      const validTask = {
        id: 'task-1',
        type: 'scrape',
        url: 'https://example.com',
      };

      // Access private method for testing
      const validateTask = (controller as any)._validateTask.bind(controller);
      const result = validateTask(validTask);

      expect(result).toBe(true);
    });

    it('should reject task missing id', () => {
      const invalidTask = {
        type: 'scrape',
        url: 'https://example.com',
      };

      const validateTask = (controller as any)._validateTask.bind(controller);
      const result = validateTask(invalidTask);

      expect(result).toBe(false);
    });

    it('should reject task missing type', () => {
      const invalidTask = {
        id: 'task-1',
        url: 'https://example.com',
      };

      const validateTask = (controller as any)._validateTask.bind(controller);
      const result = validateTask(invalidTask);

      expect(result).toBe(false);
    });

    it('should reject task missing url', () => {
      const invalidTask = {
        id: 'task-1',
        type: 'scrape',
      };

      const validateTask = (controller as any)._validateTask.bind(controller);
      const result = validateTask(invalidTask);

      expect(result).toBe(false);
    });

    it('should reject null task', () => {
      const validateTask = (controller as any)._validateTask.bind(controller);
      const result = validateTask(null);

      expect(result).toBe(false);
    });

    it('should reject non-object task', () => {
      const validateTask = (controller as any)._validateTask.bind(controller);
      const result = validateTask('string');

      expect(result).toBe(false);
    });
  });
});
