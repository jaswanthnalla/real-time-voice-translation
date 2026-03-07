import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from '../../../src/server/middleware/error.middleware';
import { ERROR_CODES } from '../../../src/shared/constants';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function createMockResponse(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = jest.fn() as NextFunction;

describe('Error Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AppError', () => {
    it('creates an error with proper fields', () => {
      const err = new AppError(404, 'SESSION_NOT_FOUND', 'Session not found', { id: '123' });
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('SESSION_NOT_FOUND');
      expect(err.message).toBe('Session not found');
      expect(err.details).toEqual({ id: '123' });
      expect(err.name).toBe('AppError');
    });
  });

  describe('errorHandler', () => {
    it('handles AppError with proper status and response', () => {
      const res = createMockResponse();
      const err = new AppError(400, 'VALIDATION_ERROR', 'Invalid input', { field: 'text' });

      errorHandler(err, mockReq, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: { field: 'text' },
          },
        })
      );
    });

    it('handles generic Error with 500 status', () => {
      const res = createMockResponse();
      const err = new Error('Something went wrong');

      errorHandler(err, mockReq, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'Internal server error',
          },
        })
      );
    });

    it('response includes timestamp', () => {
      const res = createMockResponse();
      const err = new Error('test');

      errorHandler(err, mockReq, res, mockNext);

      const responseBody = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseBody.timestamp).toBeDefined();
    });
  });
});
