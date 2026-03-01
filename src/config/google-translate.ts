import { TranslationServiceClient } from '@google-cloud/translate';
import config from './index';

let translateClient: TranslationServiceClient | null = null;

export function getTranslateClient(): TranslationServiceClient {
  if (!translateClient) {
    const options: Record<string, unknown> = {};
    if (config.googleTranslate.projectId) {
      options['projectId'] = config.googleTranslate.projectId;
    }
    if (config.googleTranslate.credentials) {
      options['keyFilename'] = config.googleTranslate.credentials;
    }
    translateClient = new TranslationServiceClient(options);
  }
  return translateClient;
}

export function getProjectId(): string {
  return config.googleTranslate.projectId ?? '';
}
