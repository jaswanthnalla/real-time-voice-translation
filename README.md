# Real-Time Voice Translation System

A comprehensive, production-ready real-time voice translation system that enables seamless multilingual communication through voice input and output. Built with modern web technologies and enterprise-grade observability features.

## 🌟 Features

### Core Functionality
- **Real-time Voice Translation**: Instant speech-to-speech translation between multiple languages
- **WebSocket Communication**: Low-latency real-time communication
- **Multiple Translation Providers**: Google Translate, Azure Translator, AWS Translate
- **Audio Processing**: Advanced audio compression and optimization
- **Session Management**: Persistent user sessions with conversation history

### Enterprise Features
- **Comprehensive Observability**: Health checks, metrics, logging, tracing, and monitoring
- **Performance Optimization**: Automatic scaling, caching, and resource optimization
- **Security**: Authentication, input validation, rate limiting, and security middleware
- **CLI Tools**: Command-line interface for system management and integration
- **SDK Support**: JavaScript SDK for easy integration
- **Docker Support**: Containerized deployment with Docker Compose
- **Kubernetes Ready**: Production-ready Kubernetes manifests

### Supported Languages
- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Chinese (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Server API    │    │   External      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • Voice Input   │    │ • WebSocket     │    │ • Google        │
│ • Audio Output  │    │ • REST API      │    │ • Azure         │
│ • UI Controls   │    │ • Translation   │    │ • AWS           │
└─────────────────┘    │ • Audio Proc.   │    │ • Twilio        │
                       │ • Observability │    └─────────────────┘
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Data Layer    │
                       │                 │
                       │ • PostgreSQL    │
                       │ • Redis Cache   │
                       │ • File Storage  │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+
- Redis 6+
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd real-time-voice-translation
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..

# Install CLI dependencies
cd cli && npm install && cd ..
```

3. **Environment setup**
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
# Add your API keys for translation services
```

4. **Database setup**
```bash
# Create PostgreSQL database
createdb voice_translation

# Run database migrations
npm run db:migrate
```

5. **Start the application**
```bash
# Start all services
npm run dev

# Or start individually
npm run server:dev  # Server on http://localhost:3001
npm run client:dev  # Client on http://localhost:3000
```

### Docker Deployment

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📖 Documentation

### API Documentation
- **REST API**: [docs/api/openapi.yaml](docs/api/openapi.yaml)
- **WebSocket API**: [docs/websocket.md](docs/websocket.md)
- **Observability**: [docs/observability.md](docs/observability.md)
- **Deployment**: [docs/deployment.md](docs/deployment.md)

### Architecture
- **System Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Database Schema**: [database/init.sql](database/init.sql)
- **Configuration**: [config/](config/)

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/voice_translation
REDIS_URL=redis://localhost:6379

# Translation Services
GOOGLE_TRANSLATE_API_KEY=your_google_api_key
AZURE_TRANSLATOR_KEY=your_azure_key
AZURE_TRANSLATOR_REGION=your_azure_region
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Twilio (for phone integration)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Observability
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_HEALTH_CHECKS=true
PROMETHEUS_PORT=9090
```

### Configuration Files
- `config/default.json`: Default configuration
- `config/development.json`: Development overrides
- `config/production.json`: Production settings
- `config/test.json`: Test environment settings

## 🔌 API Usage

### REST API

#### Start Translation Session
```bash
POST /api/sessions
Content-Type: application/json

{
  "sourceLang": "en",
  "targetLang": "es",
  "userId": "user123"
}
```

#### Translate Text
```bash
POST /api/translate
Content-Type: application/json

{
  "text": "Hello, how are you?",
  "sourceLang": "en",
  "targetLang": "es",
  "sessionId": "session123"
}
```

### WebSocket API

```javascript
const socket = io('http://localhost:3001');

// Join translation session
socket.emit('join_session', {
  sessionId: 'session123',
  userId: 'user123'
});

// Send audio for translation
socket.emit('audio_chunk', {
  sessionId: 'session123',
  audioData: base64AudioData,
  sourceLang: 'en',
  targetLang: 'es'
});

// Receive translation result
socket.on('translation_result', (data) => {
  console.log('Translated text:', data.translatedText);
  console.log('Audio URL:', data.audioUrl);
});
```

### JavaScript SDK

```javascript
import { VoiceTranslationClient } from '@voice-translation/sdk';

const client = new VoiceTranslationClient({
  apiUrl: 'http://localhost:3001',
  apiKey: 'your-api-key'
});

// Start translation session
const session = await client.createSession({
  sourceLang: 'en',
  targetLang: 'es'
});

// Translate audio
const result = await client.translateAudio({
  sessionId: session.id,
  audioBlob: audioBlob
});

console.log('Translation:', result.text);
// Play translated audio
client.playAudio(result.audioUrl);
```

## 🛠️ CLI Usage

```bash
# Install CLI globally
npm install -g ./cli

# Create new translation session
voice-translate session create --source en --target es

# Translate text
voice-translate translate "Hello world" --source en --target es

# Check system health
voice-translate health check

# View metrics
voice-translate metrics --format json

# Manage configurations
voice-translate config set GOOGLE_TRANSLATE_API_KEY your_key
voice-translate config get DATABASE_URL
```

## 📊 Monitoring & Observability

### Health Checks
- **Health Endpoint**: `GET /health`
- **Readiness Check**: `GET /health/ready`
- **Liveness Check**: `GET /health/live`

### Metrics
- **Prometheus Metrics**: `GET /metrics`
- **Custom Dashboard**: `GET /monitoring/dashboard`

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: Debug, Info, Warn, Error
- **Log Rotation**: Automatic log file rotation

### Tracing
- **Distributed Tracing**: OpenTelemetry compatible
- **Jaeger Integration**: Visual trace analysis
- **Request Correlation**: End-to-end request tracking

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage

# Load testing
npm run test:load
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose up -d --scale server=3
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -l app=voice-translation

# View logs
kubectl logs -f deployment/voice-translation-server
```

### Environment-Specific Deployments

```bash
# Development
npm run deploy:dev

# Staging
npm run deploy:staging

# Production
npm run deploy:prod
```

## 🔒 Security

### Authentication
- JWT-based authentication
- API key management
- Session-based access control

### Input Validation
- Request payload validation
- Audio file format validation
- Language code validation

### Rate Limiting
- Per-user rate limits
- API endpoint throttling
- WebSocket connection limits

### Data Protection
- Audio data encryption
- Secure API key storage
- GDPR compliance features

## 🔧 Development

### Project Structure
```
├── client/          # React frontend application
├── server/          # Node.js backend server
├── cli/             # Command-line interface
├── sdk/             # JavaScript SDK
├── config/          # Configuration files
├── docs/            # Documentation
├── k8s/             # Kubernetes manifests
├── tests/           # Test suites
└── scripts/         # Deployment and utility scripts
```

### Development Workflow

1. **Feature Development**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Start development servers
npm run dev

# Run tests
npm test

# Commit changes
git commit -m "feat: add new feature"
```

2. **Code Quality**
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check

# Security audit
npm audit
```

3. **Pre-deployment**
```bash
# Build for production
npm run build

# Run production tests
npm run test:prod

# Deploy to staging
npm run deploy:staging
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation
- Follow semantic commit conventions
- Ensure backward compatibility

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Create an issue on GitHub
- **Discussions**: Join our community discussions

### Troubleshooting

#### Common Issues

**Server won't start**
```bash
# Check if ports are available
netstat -an | grep :3001

# Check environment variables
npm run config:check

# View detailed logs
npm run logs:server
```

**Translation not working**
```bash
# Verify API keys
npm run test:translation-services

# Check service health
curl http://localhost:3001/health

# View translation logs
npm run logs:translation
```

**WebSocket connection issues**
```bash
# Test WebSocket connection
npm run test:websocket

# Check firewall settings
# Verify CORS configuration
```

### Performance Optimization

**High Memory Usage**
```bash
# Check memory metrics
curl http://localhost:3001/metrics | grep memory

# Enable memory profiling
NODE_OPTIONS="--inspect" npm start

# Analyze heap dumps
npm run analyze:memory
```

**Slow Response Times**
```bash
# Check performance metrics
curl http://localhost:3001/monitoring/dashboard

# Enable request tracing
export ENABLE_TRACING=true

# Analyze slow queries
npm run analyze:queries
```

## 🔄 Changelog

### v1.0.0 (Latest)
- ✅ Complete real-time voice translation system
- ✅ Multi-provider translation support
- ✅ Comprehensive observability system
- ✅ Production-ready deployment
- ✅ CLI tools and SDK
- ✅ Security and performance optimizations

### Roadmap
- 🔄 Mobile app support
- 🔄 Additional language support
- 🔄 Advanced audio processing
- 🔄 Machine learning optimizations
- 🔄 Enterprise SSO integration

---

**Built with ❤️ for seamless global communication**