# Multi-stage Docker build for production-grade voice translation software
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
RUN npm run build
EXPOSE 3000 3001
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies and source files
RUN npm prune --production && \
    rm -rf src tests *.md .git .gitignore

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S voicetranslation -u 1001

# Install production system dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    dumb-init

# Set working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build --chown=voicetranslation:nodejs /app/dist ./dist
COPY --from=build --chown=voicetranslation:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=voicetranslation:nodejs /app/package*.json ./
COPY --from=build --chown=voicetranslation:nodejs /app/config ./config

# Create necessary directories
RUN mkdir -p logs temp uploads && \
    chown -R voicetranslation:nodejs logs temp uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV WEBSOCKET_PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node dist/scripts/healthcheck.js

# Switch to non-root user
USER voicetranslation

# Expose ports
EXPOSE 3000 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server/index.js"]