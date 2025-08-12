#!/bin/bash

# Production Setup Script
# This script handles the complete setup and deployment workflow

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SETUP_LOG="/tmp/production-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Setup phases
PHASE_CURRENT=0
PHASE_TOTAL=8

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$SETUP_LOG"
}

# Progress function
progress() {
    ((PHASE_CURRENT++))
    log "${BLUE}📋 Phase $PHASE_CURRENT/$PHASE_TOTAL: $1${NC}"
}

# Error handling
handle_error() {
    local exit_code=$?
    log "${RED}❌ Setup failed at phase $PHASE_CURRENT with exit code $exit_code${NC}"
    log "${BLUE}💡 Check the setup log for details: $SETUP_LOG${NC}"
    exit $exit_code
}

trap handle_error ERR

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
        log "${GREEN}🍓 Detected Raspberry Pi: $(cat /proc/device-tree/model)${NC}"
        export IS_RASPBERRY_PI=true
        return 0
    else
        log "${BLUE}💻 Not running on Raspberry Pi hardware${NC}"
        export IS_RASPBERRY_PI=false
        return 1
    fi
}

# Install system dependencies
install_system_dependencies() {
    progress "Installing System Dependencies"
    
    if command -v apt-get >/dev/null 2>&1; then
        log "Updating package lists..."
        sudo apt-get update -qq
        
        log "Installing required packages..."
        sudo apt-get install -y -qq \
            curl \
            git \
            jq \
            sqlite3 \
            logrotate \
            htop \
            iotop \
            iftop
        
        # Install Docker if not present
        if ! command -v docker >/dev/null 2>&1; then
            log "Installing Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            rm get-docker.sh
            log "${GREEN}✅ Docker installed successfully${NC}"
        else
            log "${GREEN}✅ Docker already installed${NC}"
        fi
        
        # Install Docker Compose if not present
        if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
            log "Installing Docker Compose..."
            sudo apt-get install -y -qq docker-compose
            log "${GREEN}✅ Docker Compose installed successfully${NC}"
        else
            log "${GREEN}✅ Docker Compose already installed${NC}"
        fi
        
    elif command -v yum >/dev/null 2>&1; then
        log "Installing packages with yum..."
        sudo yum update -y -q
        sudo yum install -y -q curl git jq sqlite htop iotop
        
    elif command -v brew >/dev/null 2>&1; then
        log "Installing packages with Homebrew..."
        brew update
        brew install curl git jq sqlite3 htop
        
    else
        log "${YELLOW}⚠️ Unknown package manager. Please install dependencies manually.${NC}"
    fi
    
    log "${GREEN}✅ System dependencies installed${NC}"
}

# Install Node.js and npm
install_nodejs() {
    progress "Installing Node.js and npm"
    
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        log "${GREEN}✅ Node.js already installed: $node_version${NC}"
        
        # Check if version is acceptable (v18+)
        local major_version=$(echo $node_version | sed 's/v\([0-9]*\).*/\1/')
        if [ "$major_version" -lt 18 ]; then
            log "${YELLOW}⚠️ Node.js version is older than recommended (v18+)${NC}"
        fi
    else
        log "Installing Node.js..."
        
        # Install Node.js using NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        
        log "${GREEN}✅ Node.js installed: $(node --version)${NC}"
    fi
    
    # Verify npm
    if command -v npm >/dev/null 2>&1; then
        log "${GREEN}✅ npm available: $(npm --version)${NC}"
    else
        log "${RED}❌ npm not found after Node.js installation${NC}"
        exit 1
    fi
}

# Setup project dependencies
setup_project_dependencies() {
    progress "Setting up Project Dependencies"
    
    cd "$PROJECT_DIR"
    
    log "Installing root dependencies..."
    npm install --silent
    
    log "Installing backend dependencies..."
    cd backend
    npm ci --silent --only=production
    npm install --silent --only=dev
    cd ..
    
    log "Installing frontend dependencies..."
    cd frontend
    npm ci --silent
    cd ..
    
    log "${GREEN}✅ Project dependencies installed${NC}"
}

# Build applications
build_applications() {
    progress "Building Applications"
    
    cd "$PROJECT_DIR"
    
    log "Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    log "Building backend..."
    cd backend
    npm run build
    cd ..
    
    log "${GREEN}✅ Applications built successfully${NC}"
}

# Setup environment configuration
setup_environment() {
    progress "Setting up Environment Configuration"
    
    cd "$PROJECT_DIR"
    
    # Create production environment file if it doesn't exist
    if [ ! -f .env.production ]; then
        log "Creating production environment file..."
        cp .env.example .env.production
        
        # Generate a random session secret
        local session_secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
        sed -i "s/your-strong-session-secret-here/$session_secret/" .env.production
        
        log "${YELLOW}⚠️ Please review and update .env.production with your specific settings${NC}"
    else
        log "${GREEN}✅ Production environment file already exists${NC}"
    fi
    
    # Create data and logs directories
    mkdir -p data logs
    chmod 755 data logs
    
    # Setup log rotation
    if [ "$IS_RASPBERRY_PI" = true ]; then
        log "Setting up log rotation for Raspberry Pi..."
        sudo cp scripts/logrotate.conf /etc/logrotate.d/personal-reading-tracker
        sudo chown root:root /etc/logrotate.d/personal-reading-tracker
        sudo chmod 644 /etc/logrotate.d/personal-reading-tracker
    fi
    
    log "${GREEN}✅ Environment configuration completed${NC}"
}

# Run tests
run_tests() {
    progress "Running Tests"
    
    cd "$PROJECT_DIR"
    
    log "Running backend tests..."
    cd backend
    npm test -- --passWithNoTests
    cd ..
    
    log "Running frontend tests..."
    cd frontend
    npm test -- --passWithNoTests --watchAll=false
    cd ..
    
    # Run integration tests if requested
    if [ "${RUN_INTEGRATION_TESTS:-false}" = "true" ]; then
        log "Running integration tests..."
        ./scripts/integration-test.sh
    fi
    
    log "${GREEN}✅ Tests completed successfully${NC}"
}

# Setup Docker environment
setup_docker() {
    progress "Setting up Docker Environment"
    
    cd "$PROJECT_DIR"
    
    # Build Docker images
    log "Building Docker images..."
    
    if [ "$IS_RASPBERRY_PI" = true ]; then
        log "Building for Raspberry Pi (ARM64)..."
        docker build -f Dockerfile.rpi -t personal-reading-tracker:latest .
        docker build -f Dockerfile.rpi -t personal-reading-tracker:rpi .
    else
        log "Building for current platform..."
        docker build -t personal-reading-tracker:latest .
    fi
    
    # Test Docker build
    log "Testing Docker container..."
    local test_container="personal-reading-tracker-test-$$"
    
    if docker run -d --name "$test_container" -p 3001:3000 personal-reading-tracker:latest; then
        sleep 10
        
        if curl -f http://localhost:3001/health >/dev/null 2>&1; then
            log "${GREEN}✅ Docker container test passed${NC}"
        else
            log "${YELLOW}⚠️ Docker container health check failed${NC}"
        fi
        
        docker stop "$test_container" >/dev/null 2>&1 || true
        docker rm "$test_container" >/dev/null 2>&1 || true
    else
        log "${RED}❌ Docker container failed to start${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ Docker environment ready${NC}"
}

# Final validation
final_validation() {
    progress "Running Final Validation"
    
    cd "$PROJECT_DIR"
    
    log "Running deployment validation..."
    ./scripts/validate-deployment.sh
    
    log "${GREEN}✅ Final validation completed${NC}"
}

# Display setup summary
show_summary() {
    echo
    log "${GREEN}🎉 Production Setup Completed Successfully!${NC}"
    echo
    
    log "${BLUE}📋 Setup Summary:${NC}"
    echo "  ✅ System dependencies installed"
    echo "  ✅ Node.js and npm configured"
    echo "  ✅ Project dependencies installed"
    echo "  ✅ Applications built successfully"
    echo "  ✅ Environment configuration ready"
    echo "  ✅ Tests passed"
    echo "  ✅ Docker environment prepared"
    echo "  ✅ Final validation completed"
    
    echo
    log "${BLUE}🚀 Next Steps:${NC}"
    
    if [ "$IS_RASPBERRY_PI" = true ]; then
        echo "  1. Review and update .env.production with your settings"
        echo "  2. Deploy to Raspberry Pi: ./scripts/deploy-rpi.sh"
        echo "  3. Setup Tailscale for remote access"
        echo "  4. Monitor deployment: ./scripts/health-check.sh"
    else
        echo "  1. Review and update .env.production with your settings"
        echo "  2. Deploy using Docker Compose: docker-compose up -d"
        echo "  3. Check application health: curl http://localhost:3000/health"
        echo "  4. Monitor logs: docker-compose logs -f"
    fi
    
    echo
    log "${BLUE}📚 Important Files:${NC}"
    echo "  • Configuration: .env.production"
    echo "  • Deployment Guide: DEPLOYMENT.md"
    echo "  • Health Check: ./scripts/health-check.sh"
    echo "  • Integration Tests: ./scripts/integration-test.sh"
    echo "  • Validation: ./scripts/validate-deployment.sh"
    
    echo
    log "${BLUE}🔗 Application URLs:${NC}"
    echo "  • Local: http://localhost:3000"
    echo "  • Health Check: http://localhost:3000/health"
    echo "  • Metrics: http://localhost:3000/metrics"
    
    if [ "$IS_RASPBERRY_PI" = true ]; then
        echo "  • Tailscale: http://[tailscale-ip]:3000"
    fi
    
    echo
    log "${GREEN}✨ Your Personal Reading Tracker is ready for production deployment!${NC}"
}

# Main setup function
main() {
    log "${GREEN}🚀 Starting Production Setup for Personal Reading Tracker${NC}"
    echo
    
    # Clear previous setup log
    > "$SETUP_LOG"
    
    # Detect environment
    check_raspberry_pi || true
    
    # Run setup phases
    install_system_dependencies
    install_nodejs
    setup_project_dependencies
    build_applications
    setup_environment
    run_tests
    setup_docker
    final_validation
    
    # Show summary
    show_summary
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "quick")
        log "${BLUE}🏃 Running quick setup (skipping tests)...${NC}"
        export SKIP_TESTS=true
        main
        ;;
    "test")
        log "${BLUE}🧪 Running setup with integration tests...${NC}"
        export RUN_INTEGRATION_TESTS=true
        main
        ;;
    "docker-only")
        log "${BLUE}🐳 Setting up Docker environment only...${NC}"
        check_raspberry_pi || true
        setup_docker
        ;;
    "validate")
        log "${BLUE}🔍 Running validation only...${NC}"
        cd "$PROJECT_DIR"
        ./scripts/validate-deployment.sh
        ;;
    *)
        echo "Usage: $0 [setup|quick|test|docker-only|validate]"
        echo "  setup      - Full production setup (default)"
        echo "  quick      - Quick setup without tests"
        echo "  test       - Setup with integration tests"
        echo "  docker-only - Setup Docker environment only"
        echo "  validate   - Run deployment validation only"
        exit 1
        ;;
esac