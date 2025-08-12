#!/bin/bash

# Test script for Raspberry Pi deployment optimizations
# This script validates all the optimizations implemented for Pi deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_LOG="/tmp/rpi-deployment-test.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$TEST_LOG"
}

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    log "${BLUE}🧪 Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        log "${GREEN}✅ PASS: $test_name${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        log "${RED}❌ FAIL: $test_name${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test Docker files exist and are valid
test_docker_files() {
    log "${BLUE}🐳 Testing Docker configuration files...${NC}"
    
    run_test "Dockerfile.rpi exists" "[ -f '$PROJECT_DIR/Dockerfile.rpi' ]"
    run_test "docker-compose.rpi.yml exists" "[ -f '$PROJECT_DIR/docker-compose.rpi.yml' ]"
    run_test "Dockerfile.rpi has ARM64 platform" "grep -q 'linux/arm64' '$PROJECT_DIR/Dockerfile.rpi'"
    run_test "Docker compose has memory limits" "grep -q 'memory: 384M' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Docker compose has CPU limits" "grep -q 'cpus:' '$PROJECT_DIR/docker-compose.rpi.yml'"
}

# Test deployment scripts
test_deployment_scripts() {
    log "${BLUE}📜 Testing deployment scripts...${NC}"
    
    run_test "deploy-rpi.sh exists and executable" "[ -x '$SCRIPT_DIR/deploy-rpi.sh' ]"
    run_test "health-check.sh exists and executable" "[ -x '$SCRIPT_DIR/health-check.sh' ]"
    run_test "logrotate.conf exists" "[ -f '$SCRIPT_DIR/logrotate.conf' ]"
    run_test "deploy-rpi.sh has Pi detection" "grep -q 'Raspberry Pi' '$SCRIPT_DIR/deploy-rpi.sh'"
    run_test "health-check.sh has temperature monitoring" "grep -q 'thermal_zone0' '$SCRIPT_DIR/health-check.sh'"
}

# Test backend optimizations
test_backend_optimizations() {
    log "${BLUE}⚙️ Testing backend optimizations...${NC}"
    
    run_test "Database connection has Pi optimizations" "grep -q 'configureSQLiteForRaspberryPi' '$PROJECT_DIR/backend/src/database/connection.ts'"
    run_test "Server has memory monitoring" "grep -q 'startMemoryMonitoring' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has database maintenance" "grep -q 'startDatabaseMaintenance' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has enhanced shutdown" "grep -q 'gracefulShutdown' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Database has batch operations" "grep -q 'batchInsert' '$PROJECT_DIR/backend/src/database/connection.ts'"
    run_test "Database has maintenance method" "grep -q 'performMaintenance' '$PROJECT_DIR/backend/src/database/connection.ts'"
}

# Test Docker build for ARM64
test_docker_build() {
    log "${BLUE}🔨 Testing Docker build process...${NC}"
    
    # Only test build if Docker is available and we're not in CI
    if command -v docker &> /dev/null && [ -z "$CI" ]; then
        run_test "Docker build for ARM64 (dry run)" "docker buildx build --platform linux/arm64 -f '$PROJECT_DIR/Dockerfile.rpi' --target frontend-builder '$PROJECT_DIR' --dry-run 2>/dev/null || docker build -f '$PROJECT_DIR/Dockerfile.rpi' --target frontend-builder '$PROJECT_DIR' --dry-run 2>/dev/null"
    else
        log "${YELLOW}⏭️ Skipping Docker build test (Docker not available or in CI)${NC}"
    fi
}

# Test memory optimization settings
test_memory_optimizations() {
    log "${BLUE}🧠 Testing memory optimization settings...${NC}"
    
    run_test "Dockerfile.rpi has Node memory limits" "grep -q 'max-old-space-size=256' '$PROJECT_DIR/Dockerfile.rpi'"
    run_test "Docker compose has Node options" "grep -q 'NODE_OPTIONS' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Database has Pi-specific cache settings" "grep -q 'cache_size = -8192' '$PROJECT_DIR/backend/src/database/connection.ts'"
    run_test "Database has memory map optimization" "grep -q 'mmap_size = 67108864' '$PROJECT_DIR/backend/src/database/connection.ts'"
}

# Test static file serving optimizations
test_static_file_optimizations() {
    log "${BLUE}📁 Testing static file serving optimizations...${NC}"
    
    run_test "Server has optimized static file serving" "grep -q 'maxAge.*1y' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has cache headers" "grep -q 'Cache-Control' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has compression hints" "grep -q 'Accept-Encoding' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has immutable cache for assets" "grep -q 'immutable' '$PROJECT_DIR/backend/src/index.ts'"
}

# Test process management
test_process_management() {
    log "${BLUE}🔄 Testing process management...${NC}"
    
    run_test "Server has signal handlers" "grep -q 'SIGTERM' '$PROJECT_DIR/backend/src/index.ts' && grep -q 'SIGINT' '$PROJECT_DIR/backend/src/index.ts' && grep -q 'SIGHUP' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has uncaught exception handling" "grep -q 'uncaughtException' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Server has unhandled rejection handling" "grep -q 'unhandledRejection' '$PROJECT_DIR/backend/src/index.ts'"
    run_test "Dockerfile uses tini for process management" "grep -q 'tini' '$PROJECT_DIR/Dockerfile.rpi'"
    run_test "Server has shutdown timeout" "grep -q '15000' '$PROJECT_DIR/backend/src/index.ts'"
}

# Test logging and monitoring
test_logging_monitoring() {
    log "${BLUE}📊 Testing logging and monitoring...${NC}"
    
    run_test "Docker compose has log rotation" "grep -q 'max-size.*5m' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Docker compose has log compression" "grep -q 'compress.*true' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Health check script has comprehensive checks" "grep -q 'check_temperature' '$SCRIPT_DIR/health-check.sh' && grep -q 'check_memory_pressure' '$SCRIPT_DIR/health-check.sh'"
    run_test "Monitoring service is available" "grep -q 'monitoring:' '$PROJECT_DIR/docker-compose.rpi.yml'"
}

# Test environment configuration
test_environment_config() {
    log "${BLUE}🌍 Testing environment configuration...${NC}"
    
    run_test "Docker compose has Pi-specific environment" "grep -q 'RASPBERRY_PI=true' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Docker compose has thread pool optimization" "grep -q 'UV_THREADPOOL_SIZE=4' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Health check has longer intervals" "grep -q 'interval: 60s' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Health check has longer timeout" "grep -q 'timeout: 15s' '$PROJECT_DIR/docker-compose.rpi.yml'"
}

# Test security optimizations
test_security_optimizations() {
    log "${BLUE}🔒 Testing security optimizations...${NC}"
    
    run_test "Docker compose has read-only filesystem" "grep -q 'read_only: true' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Docker compose has no new privileges" "grep -q 'no-new-privileges' '$PROJECT_DIR/docker-compose.rpi.yml'"
    run_test "Dockerfile uses non-root user" "grep -q 'USER nodejs' '$PROJECT_DIR/Dockerfile.rpi'"
    run_test "Docker compose has tmpfs mounts" "grep -q 'tmpfs:' '$PROJECT_DIR/docker-compose.rpi.yml'"
}

# Main test function
main() {
    log "${GREEN}🍓 Starting Raspberry Pi Deployment Optimization Tests${NC}"
    echo
    
    # Clear previous test log
    > "$TEST_LOG"
    
    # Run all test suites
    test_docker_files
    test_deployment_scripts
    test_backend_optimizations
    test_docker_build
    test_memory_optimizations
    test_static_file_optimizations
    test_process_management
    test_logging_monitoring
    test_environment_config
    test_security_optimizations
    
    # Summary
    echo
    log "${BLUE}📋 Test Summary:${NC}"
    log "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
    
    if [ $TESTS_FAILED -gt 0 ]; then
        log "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
        echo
        log "${RED}❌ Some optimizations are missing or incorrect!${NC}"
        log "${BLUE}💡 Check the test log for details: $TEST_LOG${NC}"
        exit 1
    else
        log "${GREEN}🎉 All tests passed! Raspberry Pi optimizations are properly implemented.${NC}"
        echo
        log "${BLUE}📋 Optimization Summary:${NC}"
        echo "  🐳 ARM64 Docker configuration"
        echo "  🧠 Memory usage optimization (256MB limit)"
        echo "  💾 Database tuning for limited resources"
        echo "  📁 Efficient static file serving with caching"
        echo "  🔄 Enhanced process management and graceful shutdown"
        echo "  📊 System monitoring and health checks"
        echo "  🔒 Security hardening with read-only filesystem"
        echo "  📝 Log rotation for SD card longevity"
        echo
        log "${GREEN}✅ Ready for Raspberry Pi deployment!${NC}"
        exit 0
    fi
}

# Run tests
main "$@"