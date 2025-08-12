# Multi-stage build for Personal Reading Tracker
# Optimized for Raspberry Pi ARM64 deployment

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

# Set working directory
WORKDIR /app/frontend

# Copy package files first for better caching
COPY frontend/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build the frontend application
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder

# Set working directory
WORKDIR /app/backend

# Copy package files first for better caching
COPY backend/package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy backend source code
COPY backend/ ./

# Build the backend application
RUN npm run build

# Remove dev dependencies to reduce size
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Production image
FROM node:20-alpine AS production

# Install system dependencies for better container management
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user for security (non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built backend application
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./backend/

# Copy built frontend static files
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Create directories for data persistence and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app/data /app/logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/reading-tracker.db

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Add comprehensive health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling and zombie reaping
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/dist/index.js"]