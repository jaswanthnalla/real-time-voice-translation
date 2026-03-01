export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class TranslationError extends AppError {
  constructor(message = 'Translation failed') {
    super(message, 500, 'TRANSLATION_ERROR');
  }
}

export class AudioProcessingError extends AppError {
  constructor(message = 'Audio processing failed') {
    super(message, 500, 'AUDIO_PROCESSING_ERROR');
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message = 'External service error') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(sessionId?: string) {
    super(sessionId ? `Session ${sessionId}` : 'Session');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}
