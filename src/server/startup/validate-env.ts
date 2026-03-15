import { config } from '../../config';
import { logger } from '../../utils/logger';

export function validateEnvironment(): void {
  const warnings: string[] = [];

  // Production-specific checks
  if (config.env === 'production') {
    if (config.jwt.secret === 'dev-secret-change-in-production') {
      warnings.push('JWT_SECRET should be changed from default for production');
    }
    if (!config.apiKey) {
      warnings.push('API_KEY not set - API endpoints are unprotected');
    }
  }

  // Optional service warnings
  if (!config.google.projectId) {
    warnings.push('GOOGLE_CLOUD_PROJECT_ID not set - using free translation API (MyMemory)');
  }
  if (!config.twilio.accountSid) {
    warnings.push('TWILIO_ACCOUNT_SID not set - phone call features disabled');
  }
  if (!config.openai.apiKey) {
    warnings.push('OPENAI_API_KEY not set - conversation summaries disabled');
  }

  // Log all warnings
  warnings.forEach((w) => logger.warn(`ENV: ${w}`));

  logger.info('Environment validation complete', {
    environment: config.env,
    translationMode: config.google.projectId ? 'Google Cloud' : 'MyMemory (free)',
    warnings: warnings.length,
  });
}
