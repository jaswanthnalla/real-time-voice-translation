import { config } from '../../config';
import { logger } from '../../utils/logger';

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical checks for Google Cloud (required for core functionality)
  if (!config.google.projectId) {
    errors.push('GOOGLE_CLOUD_PROJECT_ID is required for STT/Translation/TTS services');
  }

  // Production-specific checks
  if (config.env === 'production') {
    if (config.jwt.secret === 'dev-secret-change-in-production') {
      errors.push('JWT_SECRET must be changed from default for production');
    }
    if (!config.apiKey) {
      warnings.push('API_KEY not set - API endpoints are unprotected');
    }
  }

  // Optional service warnings
  if (!config.twilio.accountSid) {
    warnings.push('TWILIO_ACCOUNT_SID not set - phone call features disabled');
  }
  if (!config.google.credentials) {
    warnings.push('GOOGLE_APPLICATION_CREDENTIALS not set - using default credentials');
  }

  // Log all warnings
  warnings.forEach((w) => logger.warn(`ENV WARNING: ${w}`));

  // Fail on errors
  if (errors.length > 0) {
    errors.forEach((e) => logger.error(`ENV ERROR: ${e}`));
    if (config.env === 'production') {
      throw new Error(`Missing required configuration: ${errors.join(', ')}`);
    } else {
      logger.warn('Configuration errors detected - some features may not work in development mode');
    }
  }

  logger.info('Environment validation complete', {
    environment: config.env,
    warnings: warnings.length,
    errors: errors.length,
  });
}
