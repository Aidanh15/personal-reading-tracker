#!/bin/bash

# Raspberry Pi deployment script for Personal Reading Tracker
# This script handles the complete deployment process optimized for Pi hardware

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="docker-compose.rpi.yml"
CONTAINER_NAME="personal-reading-tracker-rpi"
DATA_DIR="${DATA_DIR:-$PROJECT_DIR/data}"
LOGS_DIR="${LOGS_DIR:-$PROJECT_DIR/logs}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
        log "${GREEN}✅ Detected Raspberry Pi: $(cat /proc/device-tree/model)${NC}"
        return 0
    else
        log "${YELLOW}⚠️ Not running on Raspberry Pi hardware - continuing anyway${NC}"
        return 1
    fi
}

# Check system requirements
check_requirements() {
    log "${BLUE}🔍 Checking system requirements...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check available memory
    local mem_total=$(free -m | awk 'NR==2{print $2}')
    if [ "$mem_total" -lt 512 ]; then
        log "${YELLOW}⚠️ Low memory detected: ${mem_total}MB (recommended: 1GB+)${NC}"
    else
        log "${GREEN}✅ Memory OK: ${mem_total}MB${NC}"
    fi
    
    # Check available disk space
    local disk_free=$(df -BG "$PROJECT_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$disk_free" -lt 2 ]; then
        log "${RED}❌ Insufficient disk space: ${disk_free}GB (minimum: 2GB)${NC}"
        exit 1
    else
        log "${GREEN}✅ Disk space OK: ${disk_free}GB available${NC}"
    fi
    
    log "${GREEN}✅ System requirements check passed${NC}"
}

# Prepare directories
prepare_directories() {
    log "${BLUE}📁 Preparing directories...${NC}"
    
    mkdir -p "$DATA_DIR" "$LOGS_DIR"
    
    # Set appropriate permissions
    chmod 755 "$DATA_DIR" "$LOGS_DIR"
    
    log "${GREEN}✅ Directories prepared${NC}"
}

# Create environment file
create_env_file() {
    log "${BLUE}⚙️ Creating environment configuration...${NC}"
    
    local env_file="$PROJECT_DIR/.env.rpi"
    
    cat > "$env_file" << EOF
# Raspberry Pi Environment Configuration
NODE_ENV=production
APP_PORT=3000
LOG_LEVEL=warn
CORS_ORIGIN=http://localhost:3000

# Raspberry Pi specific settings
RASPBERRY_PI=true
NODE_OPTIONS=--max-old-space-size=256 --gc-interval=100
UV_THREADPOOL_SIZE=4

# Data paths
DATA_PATH=$DATA_DIR
LOGS_PATH=$LOGS_DIR

# Docker settings
COMPOSE_PROJECT_NAME=reading-tracker-rpi
EOF
    
    log "${GREEN}✅ Environment file created: $env_file${NC}"
}

# Build and deploy
deploy() {
    log "${BLUE}🚀 Starting deployment...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Stop existing containers
    if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
        log "${YELLOW}🛑 Stopping existing containers...${NC}"
        docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi down
    fi
    
    # Build images
    log "${BLUE}🔨 Building Docker images for ARM64...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi build --no-cache
    
    # Start services
    log "${BLUE}▶️ Starting services...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi up -d
    
    # Wait for services to be ready
    log "${BLUE}⏳ Waiting for services to be ready...${NC}"
    sleep 30
    
    # Check health
    local max_attempts=12
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            log "${GREEN}✅ Application is healthy and ready${NC}"
            break
        else
            log "${YELLOW}⏳ Attempt $attempt/$max_attempts - waiting for application...${NC}"
            sleep 10
            ((attempt++))
        fi
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log "${RED}❌ Application failed to start properly${NC}"
        docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi logs --tail=50
        exit 1
    fi
    
    log "${GREEN}🎉 Deployment completed successfully!${NC}"
}

# Show deployment info
show_info() {
    log "${BLUE}📋 Deployment Information:${NC}"
    echo
    echo "🌐 Application URL: http://localhost:3000"
    echo "🏥 Health Check: http://localhost:3000/health"
    echo "📊 Container Stats: docker stats $CONTAINER_NAME"
    echo "📝 Logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo "🛑 Stop: docker-compose -f $COMPOSE_FILE down"
    echo
    echo "📁 Data Directory: $DATA_DIR"
    echo "📄 Logs Directory: $LOGS_DIR"
    echo
    
    # Show current status
    log "${BLUE}📊 Current Status:${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi ps
    
    # Show resource usage
    echo
    log "${BLUE}💾 Resource Usage:${NC}"
    docker stats "$CONTAINER_NAME" --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
}

# Setup monitoring
setup_monitoring() {
    log "${BLUE}📊 Setting up monitoring...${NC}"
    
    # Create monitoring script
    local monitor_script="$SCRIPT_DIR/monitor-rpi.sh"
    
    cat > "$monitor_script" << 'EOF'
#!/bin/bash
# Simple monitoring script for Raspberry Pi deployment

while true; do
    echo "=== $(date) ==="
    
    # Container status
    docker ps --filter "name=personal-reading-tracker-rpi" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Resource usage
    docker stats personal-reading-tracker-rpi --no-stream --format "CPU: {{.CPUPerc}}, Memory: {{.MemUsage}}"
    
    # System temperature (if available)
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        temp=$(($(cat /sys/class/thermal/thermal_zone0/temp) / 1000))
        echo "Temperature: ${temp}°C"
    fi
    
    # Disk usage
    df -h / | grep -E "/$" | awk '{print "Disk: " $5 " used"}'
    
    echo "---"
    sleep 60
done
EOF
    
    chmod +x "$monitor_script"
    log "${GREEN}✅ Monitoring script created: $monitor_script${NC}"
}

# Main function
main() {
    log "${GREEN}🍓 Raspberry Pi Deployment Script for Personal Reading Tracker${NC}"
    echo
    
    check_raspberry_pi || true
    check_requirements
    prepare_directories
    create_env_file
    deploy
    setup_monitoring
    show_info
    
    echo
    log "${GREEN}🎉 Deployment completed! Your Personal Reading Tracker is now running on Raspberry Pi.${NC}"
    log "${BLUE}💡 Run './scripts/health-check.sh' to perform health checks${NC}"
    log "${BLUE}💡 Run './scripts/monitor-rpi.sh' to start monitoring${NC}"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "stop")
        log "${YELLOW}🛑 Stopping services...${NC}"
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi down
        log "${GREEN}✅ Services stopped${NC}"
        ;;
    "restart")
        log "${BLUE}🔄 Restarting services...${NC}"
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi restart
        log "${GREEN}✅ Services restarted${NC}"
        ;;
    "logs")
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi logs -f
        ;;
    "status")
        cd "$PROJECT_DIR"
        docker-compose -f "$COMPOSE_FILE" --env-file .env.rpi ps
        docker stats "$CONTAINER_NAME" --no-stream
        ;;
    *)
        echo "Usage: $0 [deploy|stop|restart|logs|status]"
        exit 1
        ;;
esac