import { Request, Response, NextFunction } from 'express';
import { correlationMiddleware } from '../../../src/server/middleware/correlation.middleware';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('correlationMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it('should generate a new correlation ID if none provided', () => {
    correlationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.headers!['x-correlation-id']).toBe('mock-uuid-1234');
    expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'mock-uuid-1234');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use existing correlation ID from request headers', () => {
    mockReq.headers = { 'x-correlation-id': 'existing-id-5678' };

    correlationMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.headers['x-correlation-id']).toBe('existing-id-5678');
    expect(mockRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-id-5678');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should always call next()', () => {
    correlationMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
