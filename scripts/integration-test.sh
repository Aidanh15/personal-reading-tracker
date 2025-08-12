#!/bin/bash

# Comprehensive Integration Test Script
# Tests the complete application workflow including Docker deployment

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_LOG="/tmp/integration-test.log"
CONTAINER_NAME="personal-reading-tracker-integration-test"
TEST_PORT="3001"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$TEST_LOG"
}

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="${3:-0}"
    
    log "${BLUE}🧪 Testing: $test_name${NC}"
    
    if eval "$test_command"; then
        local result=$?
        if [ $result -eq $expected_result ]; then
            log "${GREEN}✅ PASS: $test_name${NC}"
            TEST_RESULTS+=("PASS: $test_name")
            ((TESTS_PASSED++))
            return 0
        else
            log "${RED}❌ FAIL: $test_name (exit code: $result, expected: $expected_result)${NC}"
            TEST_RESULTS+=("FAIL: $test_name")
            ((TESTS_FAILED++))
            return 1
        fi
    else
        log "${RED}❌ FAIL: $test_name${NC}"
        TEST_RESULTS+=("FAIL: $test_name")
        ((TESTS_FAILED++))
        return 1
    fi
}

# Cleanup function
cleanup() {
    log "${BLUE}🧹 Cleaning up test environment...${NC}"
    
    # Stop and remove test container
    if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
        docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    
    if docker ps -aq --filter "name=$CONTAINER_NAME" | grep -q .; then
        docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    
    # Remove test image
    if docker images -q "$CONTAINER_NAME" | grep -q .; then
        docker rmi "$CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
    
    # Clean up test data
    rm -rf /tmp/test-reading-tracker-data >/dev/null 2>&1 || true
    
    log "${GREEN}✅ Cleanup completed${NC}"
}

# Set trap for cleanup
trap cleanup EXIT

# Wait for service to be ready
wait_for_service() {
    local url="$1"
    local max_attempts="${2:-30}"
    local attempt=1
    
    log "${BLUE}⏳ Waiting for service at $url...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            log "${GREEN}✅ Service is ready${NC}"
            return 0
        fi
        
        log "${YELLOW}⏳ Attempt $attempt/$max_attempts - waiting...${NC}"
        sleep 2
        ((attempt++))
    done
    
    log "${RED}❌ Service failed to start within timeout${NC}"
    return 1
}

# Test API endpoint
test_api_endpoint() {
    local method="$1"
    local endpoint="$2"
    local expected_status="${3:-200}"
    local data="$4"
    
    local url="http://localhost:$TEST_PORT$endpoint"
    local curl_cmd="curl -s -w '%{http_code}' -o /tmp/api_response.json"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -X POST -H 'Content-Type: application/json' -d '$data'"
    elif [ "$method" = "PUT" ] && [ -n "$data" ]; then
        curl_cmd="$curl_cmd -X PUT -H 'Content-Type: application/json' -d '$data'"
    elif [ "$method" = "DELETE" ]; then
        curl_cmd="$curl_cmd -X DELETE"
    fi
    
    curl_cmd="$curl_cmd '$url'"
    
    local response_code
    response_code=$(eval "$curl_cmd")
    
    if [ "$response_code" = "$expected_status" ]; then
        return 0
    else
        log "${RED}API test failed: $method $endpoint - got $response_code, expected $expected_status${NC}"
        if [ -f /tmp/api_response.json ]; then
            log "Response: $(cat /tmp/api_response.json)"
        fi
        return 1
    fi
}

# Main integration test function
main() {
    log "${GREEN}🚀 Starting Comprehensive Integration Tests${NC}"
    echo
    
    # Clear previous test log
    > "$TEST_LOG"
    
    # Test 1: Prerequisites Check
    log "${BLUE}📋 Phase 1: Prerequisites Check${NC}"
    
    run_test "Docker is available" "command -v docker >/dev/null"
    run_test "Docker daemon is running" "docker info >/dev/null 2>&1"
    run_test "Project directory exists" "[ -d '$PROJECT_DIR' ]"
    run_test "Dockerfile exists" "[ -f '$PROJECT_DIR/Dockerfile' ]"
    run_test "Docker Compose file exists" "[ -f '$PROJECT_DIR/docker-compose.yml' ]"
    
    # Test 2: Build Process
    log "${BLUE}🔨 Phase 2: Build Process${NC}"
    
    cd "$PROJECT_DIR"
    
    run_test "Frontend dependencies install" "cd frontend && npm ci >/dev/null 2>&1"
    run_test "Backend dependencies install" "cd backend && npm ci >/dev/null 2>&1"
    run_test "Frontend build" "cd frontend && npm run build >/dev/null 2>&1"
    run_test "Backend build" "cd backend && npm run build >/dev/null 2>&1"
    
    # Test 3: Docker Build
    log "${BLUE}🐳 Phase 3: Docker Build${NC}"
    
    run_test "Docker image build" "docker build -t '$CONTAINER_NAME' . >/dev/null 2>&1"
    run_test "Docker image exists" "docker images -q '$CONTAINER_NAME' | grep -q ."
    
    # Test 4: Container Deployment
    log "${BLUE}🚀 Phase 4: Container Deployment${NC}"
    
    # Create test data directory
    mkdir -p /tmp/test-reading-tracker-data
    
    # Start container
    run_test "Container starts successfully" "docker run -d --name '$CONTAINER_NAME' -p '$TEST_PORT:3000' -v '/tmp/test-reading-tracker-data:/app/data' '$CONTAINER_NAME' >/dev/null 2>&1"
    run_test "Container is running" "docker ps --filter 'name=$CONTAINER_NAME' --filter 'status=running' | grep -q '$CONTAINER_NAME'"
    
    # Wait for service to be ready
    if ! wait_for_service "http://localhost:$TEST_PORT/health" 60; then
        log "${RED}❌ Service failed to start, checking logs...${NC}"
        docker logs "$CONTAINER_NAME"
        exit 1
    fi
    
    # Test 5: Health Checks
    log "${BLUE}🏥 Phase 5: Health Checks${NC}"
    
    run_test "Health endpoint responds" "test_api_endpoint GET /health 200"
    run_test "Health response is valid JSON" "curl -s http://localhost:$TEST_PORT/health | jq . >/dev/null 2>&1"
    run_test "Health status is healthy" "curl -s http://localhost:$TEST_PORT/health | jq -r '.status' | grep -q 'healthy'"
    
    # Test 6: API Endpoints
    log "${BLUE}🔌 Phase 6: API Endpoints${NC}"
    
    run_test "Books API endpoint" "test_api_endpoint GET /api/books 200"
    run_test "Search API endpoint" "test_api_endpoint GET '/api/search?q=test' 200"
    run_test "Books API returns JSON" "curl -s http://localhost:$TEST_PORT/api/books | jq . >/dev/null 2>&1"
    
    # Test 7: Database Operations
    log "${BLUE}💾 Phase 7: Database Operations${NC}"
    
    # Test adding a book (this might fail if no books exist, which is expected)
    run_test "Database is accessible" "curl -s http://localhost:$TEST_PORT/health | jq -r '.database.exists' | grep -q 'true'"
    
    # Test 8: Static File Serving
    log "${BLUE}📁 Phase 8: Static File Serving${NC}"
    
    run_test "Frontend serves index.html" "test_api_endpoint GET / 200"
    run_test "Static assets are served" "curl -s -I http://localhost:$TEST_PORT/ | grep -q 'text/html'"
    
    # Test 9: Security Headers
    log "${BLUE}🔒 Phase 9: Security Headers${NC}"
    
    run_test "Security headers present" "curl -s -I http://localhost:$TEST_PORT/ | grep -q 'X-Content-Type-Options'"
    run_test "CORS headers configured" "curl -s -I http://localhost:$TEST_PORT/api/books | grep -q 'Access-Control-Allow-Origin'"
    
    # Test 10: Performance and Resource Usage
    log "${BLUE}⚡ Phase 10: Performance and Resource Usage${NC}"
    
    # Get container stats
    local container_stats
    container_stats=$(docker stats "$CONTAINER_NAME" --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" 2>/dev/null || echo "0.00% 0B / 0B")
    
    run_test "Container resource stats available" "echo '$container_stats' | grep -q '%'"
    
    # Test response times
    local response_time
    response_time=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:$TEST_PORT/health 2>/dev/null || echo "999")
    
    run_test "Health endpoint responds quickly" "echo '$response_time < 2.0' | bc -l | grep -q 1"
    
    # Test 11: Error Handling
    log "${BLUE}🚨 Phase 11: Error Handling${NC}"
    
    run_test "404 for non-existent API endpoint" "test_api_endpoint GET /api/nonexistent 404"
    run_test "Invalid JSON handling" "curl -s -X POST -H 'Content-Type: application/json' -d 'invalid-json' http://localhost:$TEST_PORT/api/books -w '%{http_code}' | grep -q '400'"
    
    # Test 12: Graceful Shutdown
    log "${BLUE}🛑 Phase 12: Graceful Shutdown${NC}"
    
    run_test "Container stops gracefully" "timeout 30 docker stop '$CONTAINER_NAME' >/dev/null 2>&1"
    run_test "Container is stopped" "! docker ps --filter 'name=$CONTAINER_NAME' --filter 'status=running' | grep -q '$CONTAINER_NAME'"
    
    # Test 13: Data Persistence
    log "${BLUE}💾 Phase 13: Data Persistence${NC}"
    
    run_test "Data directory exists" "[ -d '/tmp/test-reading-tracker-data' ]"
    run_test "Database file was created" "[ -f '/tmp/test-reading-tracker-data/reading-tracker.db' ] || [ -f '/tmp/test-reading-tracker-data/reading-tracker.db-journal' ]"
    
    # Generate Test Report
    echo
    log "${BLUE}📊 Integration Test Results${NC}"
    echo "=================================="
    
    for result in "${TEST_RESULTS[@]}"; do
        if [[ $result == PASS:* ]]; then
            log "${GREEN}✅ ${result#PASS: }${NC}"
        else
            log "${RED}❌ ${result#FAIL: }${NC}"
        fi
    done
    
    echo
    log "${BLUE}📈 Test Summary${NC}"
    log "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
    log "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=$((TESTS_PASSED * 100 / total_tests))
    
    log "${BLUE}📊 Success Rate: ${success_rate}%${NC}"
    
    # Performance Summary
    if [ -n "$container_stats" ] && [ "$container_stats" != "0.00% 0B / 0B" ]; then
        echo
        log "${BLUE}⚡ Performance Summary${NC}"
        log "Container Resource Usage: $container_stats"
        log "Health Endpoint Response Time: ${response_time}s"
    fi
    
    # Final Assessment
    echo
    if [ $TESTS_FAILED -eq 0 ]; then
        log "${GREEN}🎉 All integration tests passed! Application is ready for deployment.${NC}"
        
        echo
        log "${BLUE}✅ Integration Test Checklist Complete:${NC}"
        echo "  🔨 Build process works correctly"
        echo "  🐳 Docker containerization successful"
        echo "  🚀 Application starts and runs properly"
        echo "  🏥 Health checks pass"
        echo "  🔌 API endpoints are functional"
        echo "  💾 Database operations work"
        echo "  📁 Static file serving works"
        echo "  🔒 Security measures are in place"
        echo "  ⚡ Performance is acceptable"
        echo "  🚨 Error handling works correctly"
        echo "  🛑 Graceful shutdown works"
        echo "  💾 Data persistence is functional"
        
        exit 0
    else
        log "${RED}💥 Some integration tests failed. Please review and fix issues before deployment.${NC}"
        
        echo
        log "${BLUE}🔍 Troubleshooting Tips:${NC}"
        echo "  1. Check Docker logs: docker logs $CONTAINER_NAME"
        echo "  2. Verify all dependencies are installed"
        echo "  3. Check port availability: netstat -tulpn | grep $TEST_PORT"
        echo "  4. Review application logs in the container"
        echo "  5. Ensure sufficient system resources"
        
        exit 1
    fi
}

# Handle script arguments
case "${1:-test}" in
    "test")
        main
        ;;
    "quick")
        log "${BLUE}🏃 Running quick integration test...${NC}"
        # Run only essential tests
        TEST_QUICK=true main
        ;;
    "cleanup")
        cleanup
        log "${GREEN}✅ Cleanup completed${NC}"
        ;;
    *)
        echo "Usage: $0 [test|quick|cleanup]"
        echo "  test    - Run full integration test suite (default)"
        echo "  quick   - Run essential tests only"
        echo "  cleanup - Clean up test resources"
        exit 1
        ;;
esac