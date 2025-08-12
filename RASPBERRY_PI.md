# Raspberry Pi Deployment Guide

This document provides comprehensive information about deploying the Personal Reading Tracker on Raspberry Pi with optimizations for ARM64 architecture and limited resources.

## 🍓 Raspberry Pi Optimizations

The application has been specifically optimized for Raspberry Pi deployment with the following enhancements:

### 🐳 Docker Configuration
- **ARM64 Architecture**: Native support for Raspberry Pi ARM64 processors
- **Multi-stage Build**: Optimized build process to minimize image size
- **Memory Limits**: Conservative memory allocation (384MB limit, 192MB reservation)
- **CPU Limits**: Balanced CPU usage (0.8 cores limit, 0.4 cores reservation)
- **Process Management**: Uses `tini` for proper signal handling and zombie reaping

### 🧠 Memory Optimization
- **Node.js Memory Limit**: `--max-old-space-size=256` to prevent memory overflow
- **Garbage Collection**: Frequent GC with `--gc-interval=100`
- **Database Cache**: Conservative 8MB SQLite cache for limited RAM
- **Memory Monitoring**: Automatic monitoring with warnings at 200MB usage
- **Forced GC**: Automatic garbage collection when memory exceeds 300MB

### 💾 Database Optimization
- **SQLite Tuning**: Pi-specific pragma settings for optimal performance
- **WAL Mode**: Write-Ahead Logging for better concurrent access
- **Memory Mapping**: 64MB memory map size optimized for Pi
- **Batch Operations**: Smaller batch sizes (50 vs 100) for memory efficiency
- **Automatic Maintenance**: Periodic ANALYZE and OPTIMIZE operations
- **Checkpoint Management**: Regular WAL file truncation to save space

### 📁 Static File Serving
- **Aggressive Caching**: 1-year cache for versioned assets
- **Compression Headers**: Optimized for bandwidth-limited connections
- **Immutable Assets**: Cache-Control headers for better performance
- **Conditional Serving**: No-cache for HTML files to ensure updates

### 🔄 Process Management
- **Enhanced Shutdown**: 15-second graceful shutdown timeout
- **Signal Handling**: Comprehensive handling of SIGTERM, SIGINT, SIGHUP
- **Exception Handling**: Graceful handling of uncaught exceptions
- **Database Cleanup**: Proper database connection closure on shutdown
- **Memory Cleanup**: Interval cleanup and forced garbage collection

### 📊 Monitoring & Health Checks
- **Temperature Monitoring**: Pi-specific CPU temperature checks
- **Resource Monitoring**: CPU and memory usage tracking
- **Health Endpoints**: Comprehensive health check with system stats
- **Container Health**: Docker health checks with Pi-optimized intervals
- **Log Rotation**: SD card-friendly log management

### 🔒 Security & Stability
- **Read-only Filesystem**: Enhanced security with tmpfs for writable areas
- **Non-root User**: Runs as `nodejs` user for security
- **Resource Limits**: Process and file descriptor limits
- **No New Privileges**: Security hardening
- **Compressed Logs**: Automatic log compression to save space

## 🚀 Quick Deployment

### Prerequisites
- Raspberry Pi 4 (2GB+ RAM recommended)
- Docker and Docker Compose installed
- At least 2GB free disk space

### Deploy with One Command
```bash
./scripts/deploy-rpi.sh
```

This script will:
1. ✅ Check system requirements
2. 📁 Prepare directories
3. ⚙️ Create environment configuration
4. 🔨 Build ARM64 Docker images
5. ▶️ Start optimized services
6. 🏥 Verify application health
7. 📊 Set up monitoring

### Manual Deployment
```bash
# Build and start services
docker-compose -f docker-compose.rpi.yml up -d

# Check status
docker-compose -f docker-compose.rpi.yml ps

# View logs
docker-compose -f docker-compose.rpi.yml logs -f

# Stop services
docker-compose -f docker-compose.rpi.yml down
```

## 📋 Management Commands

### Health Monitoring
```bash
# Run comprehensive health check
./scripts/health-check.sh

# Monitor resources continuously
./scripts/monitor-rpi.sh

# Check application health
curl http://localhost:3000/health
```

### Service Management
```bash
# Deploy/redeploy
./scripts/deploy-rpi.sh deploy

# Stop services
./scripts/deploy-rpi.sh stop

# Restart services
./scripts/deploy-rpi.sh restart

# View logs
./scripts/deploy-rpi.sh logs

# Check status
./scripts/deploy-rpi.sh status
```

### Testing
```bash
# Test all Pi optimizations
./scripts/test-rpi-deployment.sh

# Validate Docker configuration
./scripts/validate-docker-config.sh
```

## 🔧 Configuration

### Environment Variables
The deployment uses `.env.rpi` with Pi-specific settings:

```bash
# Raspberry Pi Environment Configuration
NODE_ENV=production
RASPBERRY_PI=true
NODE_OPTIONS=--max-old-space-size=256 --gc-interval=100
UV_THREADPOOL_SIZE=4

# Resource limits
APP_PORT=3000
LOG_LEVEL=warn

# Data persistence
DATA_PATH=./data
LOGS_PATH=./logs
```

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      memory: 384M    # Conservative for Pi
      cpus: '0.8'     # Leave CPU for system
    reservations:
      memory: 192M
      cpus: '0.4'
```

### Database Configuration
Pi-specific SQLite optimizations:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -8192;      -- 8MB cache
PRAGMA mmap_size = 67108864;    -- 64MB memory map
PRAGMA wal_autocheckpoint = 1000;
```

## 📊 Performance Expectations

### Typical Resource Usage
- **Memory**: 150-250MB under normal load
- **CPU**: 10-30% during active use
- **Disk**: ~100MB for application + data
- **Network**: Minimal bandwidth usage with caching

### Performance Characteristics
- **Startup Time**: 30-60 seconds
- **Response Time**: <500ms for most operations
- **Concurrent Users**: 5-10 simultaneous users
- **Database Size**: Handles 1000+ books efficiently

## 🛠️ Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check memory stats
docker stats personal-reading-tracker-rpi

# Force garbage collection (if enabled)
curl http://localhost:3000/health

# Restart if memory is critically high
./scripts/deploy-rpi.sh restart
```

#### High Temperature
```bash
# Check Pi temperature
./scripts/health-check.sh

# Monitor temperature continuously
watch -n 5 'vcgencmd measure_temp'

# Ensure proper cooling and ventilation
```

#### Slow Performance
```bash
# Check disk space
df -h

# Optimize database
docker exec personal-reading-tracker-rpi node -e "
  const { DatabaseConnection } = require('./backend/dist/database/connection');
  DatabaseConnection.getInstance().performMaintenance();
"

# Check for SD card issues
sudo dmesg | grep -i "mmc\|sd"
```

#### Container Won't Start
```bash
# Check logs
docker-compose -f docker-compose.rpi.yml logs

# Verify system requirements
./scripts/deploy-rpi.sh

# Check available resources
free -h && df -h
```

### Log Locations
- **Application Logs**: `./logs/`
- **Container Logs**: `docker-compose logs`
- **System Logs**: `/var/log/syslog`
- **Health Check Logs**: `/tmp/health-check.log`

## 🔄 Maintenance

### Regular Maintenance Tasks

#### Weekly
```bash
# Health check
./scripts/health-check.sh

# Check disk space
df -h

# Review logs
./scripts/deploy-rpi.sh logs --tail=100
```

#### Monthly
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Clean Docker images
docker system prune -f

# Backup database
cp ./data/reading-tracker.db ./data/backup-$(date +%Y%m%d).db
```

#### As Needed
```bash
# Restart services
./scripts/deploy-rpi.sh restart

# Rebuild images
docker-compose -f docker-compose.rpi.yml build --no-cache

# Reset database (if needed)
npm run seed:reset
```

## 📈 Monitoring

### Built-in Monitoring
- **Health Endpoint**: `/health` with system metrics
- **Resource Monitoring**: Automatic memory and CPU tracking
- **Temperature Monitoring**: Pi-specific thermal monitoring
- **Log Monitoring**: Automatic log rotation and compression

### Optional Monitoring Stack
Enable with `--profile monitoring`:
```bash
docker-compose -f docker-compose.rpi.yml --profile monitoring up -d
```

Includes:
- **Node Exporter**: System metrics on port 9100
- **Log Rotation**: Automatic log management
- **Health Checks**: Comprehensive system validation

## 🌐 Network Access

### Tailscale Integration
The application is designed to work seamlessly with Tailscale:

1. **Install Tailscale** on your Raspberry Pi
2. **Connect to your network**: `sudo tailscale up`
3. **Access remotely**: Use your Pi's Tailscale IP
4. **Secure by default**: No additional firewall configuration needed

### Local Network Access
```bash
# Find Pi IP address
hostname -I

# Access from local network
http://[PI_IP_ADDRESS]:3000
```

## 🎯 Best Practices

### SD Card Longevity
- ✅ Use high-quality SD cards (Class 10, A1/A2)
- ✅ Enable log rotation and compression
- ✅ Use read-only filesystem where possible
- ✅ Regular database maintenance
- ✅ Monitor disk usage

### Performance Optimization
- ✅ Ensure adequate cooling
- ✅ Use fast SD cards or USB 3.0 storage
- ✅ Monitor memory usage regularly
- ✅ Keep system updated
- ✅ Use wired network when possible

### Security
- ✅ Keep Pi OS updated
- ✅ Use strong passwords
- ✅ Enable SSH key authentication
- ✅ Configure firewall if needed
- ✅ Regular security updates

## 📚 Additional Resources

- [Raspberry Pi Documentation](https://www.raspberrypi.org/documentation/)
- [Docker on Raspberry Pi](https://docs.docker.com/engine/install/debian/)
- [Tailscale Setup Guide](https://tailscale.com/kb/1017/install/)
- [SQLite Optimization](https://www.sqlite.org/optoverview.html)

---

**Ready to deploy?** Run `./scripts/deploy-rpi.sh` to get started! 🚀