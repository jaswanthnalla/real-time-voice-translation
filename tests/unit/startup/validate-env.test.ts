import { validateEnvironment } from '../../../src/server/startup/validate-env';

// We need to mock config since it reads from process.env at import time
jest.mock('../../../src/config', () => ({
  config: {
    env: 'development',
    google: {
      projectId: 'test-project',
      credentials: '/path/to/creds.json',
    },
    jwt: {
      secret: 'dev-secret-change-in-production',
    },
    apiKey: 'test-key',
    twilio: {
      accountSid: 'test-sid',
    },
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { logger } = require('../../../src/utils/logger');
const { config } = require('../../../src/config');

describe('validateEnvironment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset config to defaults
    config.env = 'development';
    config.google.projectId = 'test-project';
    config.google.credentials = '/path/to/creds.json';
    config.jwt.secret = 'dev-secret-change-in-production';
    config.apiKey = 'test-key';
    config.twilio.accountSid = 'test-sid';
  });

  it('should complete without errors when all config is valid', () => {
    validateEnvironment();
    expect(logger.info).toHaveBeenCalledWith(
      'Environment validation complete',
      expect.objectContaining({ environment: 'development' })
    );
  });

  it('should warn when GOOGLE_APPLICATION_CREDENTIALS is not set', () => {
    config.google.credentials = '';
    validateEnvironment();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GOOGLE_APPLICATION_CREDENTIALS')
    );
  });

  it('should warn when TWILIO_ACCOUNT_SID is not set', () => {
    config.twilio.accountSid = '';
    validateEnvironment();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('TWILIO_ACCOUNT_SID')
    );
  });

  it('should error when GOOGLE_CLOUD_PROJECT_ID is missing', () => {
    config.google.projectId = '';
    validateEnvironment();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('GOOGLE_CLOUD_PROJECT_ID')
    );
  });

  it('should throw in production when GOOGLE_CLOUD_PROJECT_ID is missing', () => {
    config.env = 'production';
    config.google.projectId = '';
    expect(() => validateEnvironment()).toThrow('Missing required configuration');
  });

  it('should throw in production when JWT_SECRET is default', () => {
    config.env = 'production';
    config.jwt.secret = 'dev-secret-change-in-production';
    expect(() => validateEnvironment()).toThrow('Missing required configuration');
  });

  it('should warn in production when API_KEY is not set', () => {
    config.env = 'production';
    config.apiKey = '';
    // This produces a warning but shouldn't throw (if other required configs are ok)
    config.jwt.secret = 'a-secure-production-secret';
    validateEnvironment();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('API_KEY')
    );
  });

  it('should only warn in development when errors exist', () => {
    config.env = 'development';
    config.google.projectId = '';
    // Should NOT throw in development
    expect(() => validateEnvironment()).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      'Configuration errors detected - some features may not work in development mode'
    );
  });
});
