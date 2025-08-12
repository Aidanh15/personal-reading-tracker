# Docker Containerization Guide

This document provides comprehensive instructions for building, deploying, and managing the Personal Reading Tracker application using Docker.

## Overview

The application uses a multi-stage Docker build process optimized for:
- **Production deployment** on Raspberry Pi with ARM64 architecture
- **Development environment** with hot reloading
- **Resource optimization** for limited hardware resources
- **Security best practices** with non-root user execution

## Quick Start

### Production Deployment

```bash
# Build and start the application
docker-compose up -d

# Check application status
docker-compose ps

# View logs
docker-compose logs -f reading-tracker

# Stop the application
docker-compose down
```

### Development Environment

```bash
# Start development environment with hot reloading
docker-compose --profile dev up -d

# View development logs
docker-compose logs -f reading-tracker-dev
```

## Docker Configuration Files

### Core Files

- **`Dockerfile`** - Multi-stage production build
- **`Dockerfile.dev`** - Development environment with hot reloading
- **`docker-compose.yml`** - Main orchestration configuration
- **`docker-compose.prod.yml`** - Production-specific overrides
- **`docker-compose.override.yml`** - Local development overrides
- **`.dockerignore`** - Build context optimization

### Scripts

- **`scripts/docker-build.sh`** - Comprehensive build and deployment script
- **`scripts/health-check.sh`** - Container health monitoring
- **`scripts/validate-docker-config.sh`** - Configuration validation

## Build Process

### Multi-Stage Build Architecture

1. **Frontend Builder Stage**
   - Installs Node.js dependencies
   - Builds React application with Vite
   - Optimizes static assets

2. **Backend Builder Stage**
   - Installs Node.js dependencies
   - Compiles TypeScript to JavaScript
   - Removes development dependencies

3. **Production Stage**
   - Uses minimal Alpine Linux base
   - Copies built applications
   - Configures non-root user
   - Sets up health checks

### Build Commands

```bash
# Build production image
./scripts/docker-build.sh build

# Build with specific tag
./scripts/docker-build.sh build --tag v1.0.0

# Build development image
./scripts/docker-build.sh build --target development

# Build without cache
./scripts/docker-build.sh build --no-cache

# Build and push to registry
./scripts/docker-build.sh build --push
```

## Deployment Scenarios

### 1. Local Development

```bash
# Start with hot reloading
docker-compose --profile dev up -d

# Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### 2. Production Deployment

```bash
# Standard production deployment
docker-compose up -d

# Production with resource limits
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Access application: http://localhost:3000
```

### 3. Raspberry Pi Deployment

```bash
# Build for ARM64 architecture
./scripts/docker-build.sh build --platform linux/arm64

# Deploy with resource optimization
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Environment Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

### Key Configuration Options

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
APP_PORT=3000

# Database
DATABASE_PATH=/app/data/reading-tracker.db

# CORS (set to your Tailscale IP or domain)
CORS_ORIGIN=http://your-tailscale-ip:3000

# Logging
LOG_LEVEL=info
```

## Volume Management

### Data Persistence

The application uses Docker volumes for data persistence:

- **`reading_data`** - SQLite database and user data
- **`reading_logs`** - Application logs
- **`reading_dev_data`** - Development database
- **`reading_dev_logs`** - Development logs

### Volume Commands

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect reading_data

# Backup data volume
docker run --rm -v reading_data:/data -v $(pwd):/backup alpine tar czf /backup/reading-data-backup.tar.gz -C /data .

# Restore data volume
docker run --rm -v reading_data:/data -v $(pwd):/backup alpine tar xzf /backup/reading-data-backup.tar.gz -C /data
```

## Health Monitoring

### Built-in Health Checks

The application includes comprehensive health monitoring:

```bash
# Check container health
docker-compose ps

# Run manual health check
./scripts/health-check.sh

# View health check logs
docker inspect personal-reading-tracker | grep -A 10 Health
```

### Health Check Endpoints

- **`/health`** - Basic application health
- Returns: Status, uptime, memory usage, database status

### Monitoring Service (Optional)

Enable system monitoring with Node Exporter:

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Access metrics: http://localhost:9100/metrics
```

## Security Features

### Container Security

- **Non-root user execution** - Application runs as `nodejs` user (UID 1001)
- **Read-only root filesystem** - In production mode
- **Security options** - `no-new-privileges` flag
- **Resource limits** - Memory and CPU constraints
- **Network isolation** - Custom Docker network

### Content Security Policy

The application includes CSP headers for additional security:

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
  },
}
```

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
./scripts/docker-build.sh build --no-cache
```

#### 2. Permission Issues

```bash
# Fix volume permissions
docker-compose exec reading-tracker chown -R nodejs:nodejs /app/data
```

#### 3. Memory Issues on Raspberry Pi

```bash
# Check memory usage
docker stats

# Adjust memory limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 256M  # Reduce if needed
```

#### 4. Database Issues

```bash
# Check database file
docker-compose exec reading-tracker ls -la /app/data/

# Reset database (WARNING: This will delete all data)
docker volume rm reading_data
```

### Debugging Commands

```bash
# Access container shell
docker-compose exec reading-tracker sh

# View application logs
docker-compose logs -f reading-tracker

# Check container resources
docker stats personal-reading-tracker

# Inspect container configuration
docker inspect personal-reading-tracker
```

## Performance Optimization

### Raspberry Pi Specific

1. **Memory Management**
   - Limited to 512MB RAM usage
   - Efficient SQLite configuration
   - Minimal base image (Alpine Linux)

2. **Storage Optimization**
   - Database on persistent volume
   - Log rotation configured
   - Efficient static file serving

3. **CPU Usage**
   - Single-threaded Node.js application
   - CPU limits set to prevent overload
   - Efficient build process

### Build Optimization

```bash
# Multi-platform builds
docker buildx build --platform linux/arm64,linux/amd64 .

# Layer caching optimization
# Package files copied before source code
# Dependencies installed in separate layers
```

## Maintenance

### Regular Tasks

```bash
# Update application
git pull
./scripts/docker-build.sh build
docker-compose up -d

# Backup data
./scripts/docker-build.sh backup

# Clean up old images
docker image prune -a

# Update base images
docker-compose pull
```

### Log Management

```bash
# View logs with timestamps
docker-compose logs -f -t reading-tracker

# Limit log output
docker-compose logs --tail=100 reading-tracker

# Log rotation is configured automatically in production
```

## Integration with Tailscale

For secure remote access via Tailscale:

1. **Install Tailscale on Raspberry Pi**
2. **Configure CORS_ORIGIN** to your Tailscale IP
3. **Access via Tailscale network**: `http://your-tailscale-ip:3000`

### Example Configuration

```bash
# In .env file
CORS_ORIGIN=http://100.64.1.100:3000  # Your Tailscale IP
```

## Validation and Testing

### Configuration Validation

```bash
# Validate all Docker configurations
./scripts/validate-docker-config.sh

# Test image functionality
./scripts/docker-build.sh test
```

### Manual Testing

```bash
# Build and test locally
./scripts/docker-build.sh build --tag test
./scripts/docker-build.sh test

# Deploy and verify
docker-compose up -d
curl http://localhost:3000/health
```

## Support and Troubleshooting

For issues or questions:

1. **Check logs**: `docker-compose logs -f reading-tracker`
2. **Validate configuration**: `./scripts/validate-docker-config.sh`
3. **Test health**: `./scripts/health-check.sh`
4. **Review this documentation** for common solutions

The Docker setup is designed to be robust and self-healing, with comprehensive monitoring and error handling built-in.