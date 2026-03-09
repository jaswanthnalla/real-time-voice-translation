import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Voice Translation API',
      version: '1.0.0',
      description: 'Real-time voice call translation system API. Supports bidirectional voice translation during live phone calls and browser sessions with sub-1500ms latency.',
      contact: {
        name: 'Voice Translation Team',
      },
    },
    servers: [
      { url: '/', description: 'Current server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key for service authentication',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            callSid: { type: 'string' },
            streamSid: { type: 'string' },
            sourceLang: { type: 'string', example: 'en' },
            targetLang: { type: 'string', example: 'es' },
            status: { type: 'string', enum: ['active', 'paused', 'completed', 'error'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            transcript: {
              type: 'array',
              items: { $ref: '#/components/schemas/TranscriptEntry' },
            },
          },
        },
        TranscriptEntry: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            speaker: { type: 'string', enum: ['caller', 'callee'] },
            originalText: { type: 'string' },
            translatedText: { type: 'string' },
            sourceLang: { type: 'string' },
            targetLang: { type: 'string' },
          },
        },
        TranslationRequest: {
          type: 'object',
          required: ['text', 'sourceLang', 'targetLang'],
          properties: {
            text: { type: 'string', example: 'Hello, how are you?' },
            sourceLang: { type: 'string', example: 'en' },
            targetLang: { type: 'string', example: 'es' },
            sessionId: { type: 'string', format: 'uuid' },
          },
        },
        TranslationResult: {
          type: 'object',
          properties: {
            originalText: { type: 'string' },
            translatedText: { type: 'string' },
            sourceLang: { type: 'string' },
            targetLang: { type: 'string' },
            durationMs: { type: 'number' },
          },
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            version: { type: 'string' },
            uptime: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' },
            checks: { type: 'object' },
          },
        },
      },
    },
  },
  apis: ['./src/server/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
