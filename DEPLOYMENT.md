# Personal Reading Tracker - Deployment Guide

This guide provides comprehensive instructions for deploying the Personal Reading Tracker application on a Raspberry Pi with Docker and Tailscale access.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Deployment Options](#deployment-options)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Prerequisites

### Hardware Requirements

- **Raspberry Pi 4** (recommended) or Raspberry Pi 3B+
- **Minimum 2GB RAM** (4GB recommended)
- **32GB+ microSD card** (Class 10 or better)
- **Stable internet connection**

### Software Requirements

- **Raspberry Pi OS** (64-bit recommended)
- **Docker** and **Docker Compose**
- **Tailscale** (for remote access)
- **Git** (for cloning the repository)

## Quick Start

For experienced users who want to get up and running quickly:

```bash
# Clone the repository
git clone <repository-url>
cd personal-reading-tracker

# Run the automated deployment script
./scripts/deploy-rpi.sh

# Check deployment status
./scripts/health-check.sh
```

The application will be available at `http://localhost:3000` and through your Tailscale network.

## Detailed Setup

### 1. Prepare Your Raspberry Pi

#### Install Raspberry Pi OS

1. Download and flash Raspberry Pi OS (64-bit) to your microSD card
2. Enable SSH and configure WiFi during setup
3. Boot your Pi and update the system:

```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose -y

# Reboot to apply group changes
sudo reboot
```

#### Install Tailscale

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect to your Tailscale network
sudo tailscale up

# Note your Tailscale IP address
tailscale ip -4
```

### 2. Clone and Configure the Application

```bash
# Clone the repository
git clone <repository-url>
cd personal-reading-tracker

# Copy and configure environment file
cp .env.example .env.production
nano .env.production
```

#### Essential Configuration

Update these values in `.env.production`:

```bash
# Set your Tailscale hostname or IP
CORS_ORIGIN=http://your-tailscale-ip:3000

# Set your Tailscale hostname
TAILSCALE_HOSTNAME=your-device-name

# Generate a strong session secret
SESSION_SECRET=your-very-strong-random-secret-here
```

### 3. Deploy the Application

#### Option A: Automated Deployment (Recommended)

```bash
# Run the automated deployment script
./scripts/deploy-rpi.sh

# The script will:
# - Check system requirements
# - Build Docker images optimized for ARM64
# - Start the application with proper resource limits
# - Set up monitoring and health checks
```

#### Option B: Manual Deployment

```bash
# Build and start the application
docker-compose -f docker-compose.rpi.yml --env-file .env.production up -d

# Check status
docker-compose -f docker-compose.rpi.yml ps
```

### 4. Verify Deployment

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check application logs
docker-compose -f docker-compose.rpi.yml logs -f

# Test the application
curl http://localhost:3000/health
```

## Configuration

### Environment Variables

The application uses environment variables for configuration. Key variables include:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `PORT` | Application port | `3000` | No |
| `DATABASE_PATH` | SQLite database path | `/app/data/reading-tracker.db` | No |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` | Yes |
| `LOG_LEVEL` | Logging level | `info` | No |
| `RASPBERRY_PI` | Enable Pi optimizations | `true` | No |
| `TAILSCALE_HOSTNAME` | Your Tailscale device name | - | Recommended |

### Resource Limits

The Raspberry Pi configuration includes optimized resource limits:

- **Memory**: 384MB limit (192MB reserved)
- **CPU**: 0.8 cores limit (0.4 cores reserved)
- **Node.js heap**: 256MB maximum
- **Database cache**: 8MB
- **Log files**: 5MB max size, 2 files retained

### Security Settings

Production deployment includes several security measures:

- Non-root user execution
- Read-only root filesystem
- No new privileges
- Security headers enabled
- CORS protection
- Input validation and sanitization

## Deployment Options

### Standard Deployment

Basic deployment with essential services:

```bash
docker-compose -f docker-compose.rpi.yml up -d
```

### With Monitoring

Include system monitoring:

```bash
docker-compose -f docker-compose.rpi.yml --profile monitoring up -d
```

### With Log Rotation

Include log rotation for SD card health:

```bash
docker-compose -f docker-compose.rpi.yml --profile logrotate up -d
```

### Full Deployment

All services including monitoring and log rotation:

```bash
docker-compose -f docker-compose.rpi.yml --profile monitoring --profile logrotate up -d
```

## Monitoring and Maintenance

### Health Monitoring

The application includes comprehensive health monitoring:

```bash
# Manual health check
./scripts/health-check.sh

# Continuous monitoring
./scripts/monitor-rpi.sh

# Check application metrics
curl http://localhost:3000/health
```

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.rpi.yml logs -f

# View specific service logs
docker-compose -f docker-compose.rpi.yml logs -f reading-tracker

# Check log file sizes
du -sh logs/
```

### Database Maintenance

The application automatically performs database maintenance:

- **Vacuum**: Every 6 hours
- **Analyze**: After significant data changes
- **Backup**: Daily (if enabled)

Manual database operations:

```bash
# Create manual backup
docker exec personal-reading-tracker-rpi node backend/dist/scripts/backup.js

# Check database stats
curl http://localhost:3000/health | jq '.database'
```

### System Monitoring

Monitor system resources:

```bash
# Container resource usage
docker stats personal-reading-tracker-rpi

# System temperature (Pi specific)
vcgencmd measure_temp

# Memory usage
free -h

# Disk usage
df -h
```

### Updates and Maintenance

```bash
# Update the application
git pull
docker-compose -f docker-compose.rpi.yml build --no-cache
docker-compose -f docker-compose.rpi.yml up -d

# Clean up old Docker images
docker image prune -f

# Restart services
docker-compose -f docker-compose.rpi.yml restart
```

## Troubleshooting

### Common Issues

#### Application Won't Start

1. Check system resources:
   ```bash
   free -h
   df -h
   ```

2. Check Docker logs:
   ```bash
   docker-compose -f docker-compose.rpi.yml logs
   ```

3. Verify configuration:
   ```bash
   docker-compose -f docker-compose.rpi.yml config
   ```

#### High Memory Usage

1. Check container memory usage:
   ```bash
   docker stats personal-reading-tracker-rpi
   ```

2. Restart the application:
   ```bash
   docker-compose -f docker-compose.rpi.yml restart
   ```

3. Check for memory leaks in logs

#### Database Issues

1. Check database file permissions:
   ```bash
   ls -la data/
   ```

2. Verify database integrity:
   ```bash
   docker exec personal-reading-tracker-rpi sqlite3 /app/data/reading-tracker.db "PRAGMA integrity_check;"
   ```

#### Network Connectivity

1. Check Tailscale status:
   ```bash
   tailscale status
   ```

2. Test local connectivity:
   ```bash
   curl http://localhost:3000/health
   ```

3. Check firewall settings:
   ```bash
   sudo ufw status
   ```

### Performance Optimization

#### For Limited Memory

1. Reduce Node.js heap size:
   ```bash
   NODE_OPTIONS="--max-old-space-size=192"
   ```

2. Enable swap (if not already enabled):
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=1024
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

#### For Better Performance

1. Use faster storage (USB 3.0 SSD instead of microSD)
2. Increase GPU memory split:
   ```bash
   sudo raspi-config  # Advanced Options > Memory Split > 16
   ```

### Logs and Debugging

#### Enable Debug Logging

```bash
# Temporary debug mode
docker-compose -f docker-compose.rpi.yml exec reading-tracker \
  sh -c "LOG_LEVEL=debug node backend/dist/index.js"
```

#### Log Locations

- **Application logs**: `logs/application.log`
- **Docker logs**: `docker-compose logs`
- **System logs**: `/var/log/syslog`

## Security Considerations

### Network Security

1. **Tailscale**: Provides encrypted mesh networking
2. **Firewall**: Configure UFW to block unnecessary ports
3. **CORS**: Properly configured for your domain/IP
4. **HTTPS**: Consider adding SSL termination

### Application Security

1. **Non-root execution**: Application runs as nodejs user
2. **Read-only filesystem**: Root filesystem is read-only
3. **Input validation**: All API inputs are validated
4. **Security headers**: Helmet.js provides security headers

### Data Security

1. **Database encryption**: Consider enabling SQLite encryption
2. **Backup encryption**: Encrypt database backups
3. **Access control**: Limit physical access to the Pi

### Recommended Security Setup

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow from 100.64.0.0/10 to any port 3000  # Tailscale network

# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon

# Keep system updated
sudo apt update && sudo apt upgrade -y
```

## Advanced Configuration

### Custom Domain with SSL

If you want to use a custom domain with SSL:

1. Set up a reverse proxy (nginx)
2. Obtain SSL certificates (Let's Encrypt)
3. Configure DNS to point to your Tailscale IP

### Backup Strategy

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec personal-reading-tracker-rpi \
  sqlite3 /app/data/reading-tracker.db ".backup /app/data/backup_${DATE}.db"
```

### Monitoring Integration

For advanced monitoring, consider integrating with:

- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **Alertmanager**: Alerting

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Check logs and system resources
2. **Monthly**: Update system packages and Docker images
3. **Quarterly**: Review and rotate logs, check backups

### Getting Help

1. Check the troubleshooting section above
2. Review application logs for error messages
3. Check system resources and temperature
4. Verify network connectivity

### Backup and Recovery

Always maintain regular backups of:

- Database files (`data/reading-tracker.db`)
- Configuration files (`.env.production`)
- Custom modifications

---

## Quick Reference

### Essential Commands

```bash
# Start application
./scripts/deploy-rpi.sh

# Check health
./scripts/health-check.sh

# View logs
docker-compose -f docker-compose.rpi.yml logs -f

# Restart application
docker-compose -f docker-compose.rpi.yml restart

# Stop application
docker-compose -f docker-compose.rpi.yml down

# Update application
git pull && docker-compose -f docker-compose.rpi.yml up -d --build
```

### Important URLs

- **Application**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
- **Tailscale Access**: `http://[tailscale-ip]:3000`
- **Monitoring** (if enabled): `http://localhost:9100`

This deployment guide should get your Personal Reading Tracker running smoothly on your Raspberry Pi with Tailscale access. Remember to customize the configuration for your specific needs and maintain regular backups.