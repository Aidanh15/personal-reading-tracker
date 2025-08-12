#!/bin/bash

# Final Deployment Validation Script
# This script performs comprehensive validation of the deployment readiness

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VALIDATION_LOG="/tmp/deployment-validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation results
VALIDATIONS_PASSED=0
VALIDATIONS_FAILED=0
VALIDATION_RESULTS=()

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$VALIDATION_LOG"
}

# Validation function
validate() {
    local validation_name="$1"
    local validation_command="$2"
    local is_critical="${3:-true}"
    
    log "${BLUE}🔍 Validating: $validation_name${NC}"
    
    if eval "$validation_command" >/dev/null 2>&1; then
        log "${GREEN}✅ PASS: $validation_name${NC}"
        VALIDATION_RESULTS+=("PASS: $validation_name")
        ((VALIDATIONS_PASSED++))
        return 0
    else
        if [ "$is_critical" = "true" ]; then
            log "${RED}❌ FAIL: $validation_name (CRITICAL)${NC}"
            VALIDATION_RESULTS+=("FAIL: $validation_name (CRITICAL)")
        else
            log "${YELLOW}⚠️ WARN: $validation_name (NON-CRITICAL)${NC}"
            VALIDATION_RESULTS+=("WARN: $validation_name (NON-CRITICAL)")
        fi
        ((VALIDATIONS_FAILED++))
        return 1
    fi
}

# Check file exists and is not empty
check_file() {
    local file_path="$1"
    [ -f "$file_path" ] && [ -s "$file_path" ]
}

# Check directory exists
check_directory() {
    local dir_path="$1"
    [ -d "$dir_path" ]
}

# Check script is executable
check_executable() {
    local script_path="$1"
    [ -x "$script_path" ]
}

# Check JSON is valid
check_json() {
    local json_file="$1"
    jq . "$json_file" >/dev/null 2>&1
}

# Check environment variable is set
check_env_var() {
    local var_name="$1"
    [ -n "${!var_name}" ]
}

# Main validation function
main() {
    log "${GREEN}🚀 Starting Final Deployment Validation${NC}"
    echo
    
    # Clear previous validation log
    > "$VALIDATION_LOG"
    
    cd "$PROJECT_DIR"
    
    # Phase 1: Project Structure Validation
    log "${BLUE}📁 Phase 1: Project Structure Validation${NC}"
    
    validate "Root package.json exists" "check_file 'package.json'"
    validate "Frontend package.json exists" "check_file 'frontend/package.json'"
    validate "Backend package.json exists" "check_file 'backend/package.json'"
    validate "Main Dockerfile exists" "check_file 'Dockerfile'"
    validate "Raspberry Pi Dockerfile exists" "check_file 'Dockerfile.rpi'"
    validate "Docker Compose file exists" "check_file 'docker-compose.yml'"
    validate "Raspberry Pi Docker Compose exists" "check_file 'docker-compose.rpi.yml'"
    validate "Production environment file exists" "check_file '.env.production'"
    validate "Deployment documentation exists" "check_file 'DEPLOYMENT.md'"
    
    # Phase 2: Configuration Validation
    log "${BLUE}⚙️ Phase 2: Configuration Validation${NC}"
    
    validate "Package.json is valid JSON" "check_json 'package.json'"
    validate "Frontend package.json is valid JSON" "check_json 'frontend/package.json'"
    validate "Backend package.json is valid JSON" "check_json 'backend/package.json'"
    validate "TypeScript config exists (backend)" "check_file 'backend/tsconfig.json'"
    validate "TypeScript config exists (frontend)" "check_file 'frontend/tsconfig.json'"
    validate "Vite config exists" "check_file 'frontend/vite.config.ts'"
    validate "Jest config exists" "check_file 'backend/jest.config.js'"
    validate "Playwright config exists" "check_file 'playwright.config.ts'"
    
    # Phase 3: Scripts Validation
    log "${BLUE}📜 Phase 3: Scripts Validation${NC}"
    
    validate "Deploy script exists and is executable" "check_executable 'scripts/deploy-rpi.sh'"
    validate "Health check script exists and is executable" "check_executable 'scripts/health-check.sh'"
    validate "Docker build script exists and is executable" "check_executable 'scripts/docker-build.sh'"
    validate "Integration test script exists and is executable" "check_executable 'scripts/integration-test.sh'"
    validate "All tests script exists and is executable" "check_executable 'scripts/run-all-tests.sh'"
    validate "Validation script exists and is executable" "check_executable 'scripts/validate-deployment.sh'"
    validate "Logrotate config exists" "check_file 'scripts/logrotate.conf'"
    
    # Phase 4: Source Code Validation
    log "${BLUE}💻 Phase 4: Source Code Validation${NC}"
    
    validate "Backend main entry point exists" "check_file 'backend/src/index.ts'"
    validate "Frontend main entry point exists" "check_file 'frontend/src/main.tsx'"
    validate "Frontend App component exists" "check_file 'frontend/src/App.tsx'"
    validate "Backend database connection exists" "check_file 'backend/src/database/connection.ts'"
    validate "Backend routes directory exists" "check_directory 'backend/src/routes'"
    validate "Frontend components directory exists" "check_directory 'frontend/src/components'"
    validate "Backend middleware directory exists" "check_directory 'backend/src/middleware'"
    validate "Backend utils directory exists" "check_directory 'backend/src/utils'"
    validate "Enhanced logger exists" "check_file 'backend/src/utils/logger.ts'"
    validate "Monitoring service exists" "check_file 'backend/src/utils/monitoring.ts'"
    
    # Phase 5: Dependencies Validation
    log "${BLUE}📦 Phase 5: Dependencies Validation${NC}"
    
    validate "Root node_modules exists" "check_directory 'node_modules'" false
    validate "Backend node_modules exists" "check_directory 'backend/node_modules'" false
    validate "Frontend node_modules exists" "check_directory 'frontend/node_modules'" false
    
    # Check if dependencies can be installed
    validate "Backend dependencies can be installed" "(cd backend && npm ci --dry-run >/dev/null 2>&1)"
    validate "Frontend dependencies can be installed" "(cd frontend && npm ci --dry-run >/dev/null 2>&1)"
    
    # Phase 6: Build Validation
    log "${BLUE}🔨 Phase 6: Build Validation${NC}"
    
    # Check if builds work
    validate "Backend TypeScript compiles" "cd backend && npx tsc --noEmit"
    validate "Frontend TypeScript compiles" "cd frontend && npx tsc --noEmit"
    
    # Phase 7: Docker Validation
    log "${BLUE}🐳 Phase 7: Docker Validation${NC}"
    
    validate "Docker is available" "command -v docker"
    validate "Docker Compose is available" "command -v docker-compose || docker compose version"
    validate "Main Dockerfile syntax is valid" "docker build -f Dockerfile --target frontend-builder . --dry-run" false
    validate "Raspberry Pi Dockerfile syntax is valid" "docker build -f Dockerfile.rpi --target frontend-builder . --dry-run" false
    validate "Docker Compose config is valid" "docker-compose config"
    validate "Raspberry Pi Docker Compose config is valid" "docker-compose -f docker-compose.rpi.yml config"
    
    # Phase 8: Security Validation
    log "${BLUE}🔒 Phase 8: Security Validation${NC}"
    
    validate "No sensitive files in git" "! git ls-files | grep -E '\\.(env|key|pem|p12|pfx)$'"$'"
    validate "Dockerfile uses non-root user" "grep -q 'USER nodejs' Dockerfile"
    validate "Raspberry Pi Dockerfile uses non-root user" "grep -q 'USER nodejs' Dockerfile.rpi"
    validate "Docker Compose has security options" "grep -q 'no-new-privileges' docker-compose.rpi.yml"
    validate "Docker Compose has read-only filesystem" "grep -q 'read_only: true' docker-compose.rpi.yml"
    
    # Phase 9: Performance Optimization Validation
    log "${BLUE}⚡ Phase 9: Performance Optimization Validation${NC}"
    
    validate "Raspberry Pi memory limits configured" "grep -q 'memory: 384M' docker-compose.rpi.yml"
    validate "Node.js memory optimization configured" "grep -q 'max-old-space-size=256' Dockerfile.rpi"
    validate "Database optimizations present" "grep -q 'configureSQLiteForRaspberryPi' backend/src/database/connection.ts" false
    validate "Static file caching configured" "grep -q 'maxAge.*1y' backend/src/index.ts"
    validate "Compression hints configured" "grep -q 'Accept-Encoding' backend/src/index.ts"
    
    # Phase 10: Monitoring and Logging Validation
    log "${BLUE}📊 Phase 10: Monitoring and Logging Validation${NC}"
    
    validate "Enhanced health check endpoint" "grep -q '/health.*monitoring' backend/src/index.ts"
    validate "Metrics endpoint exists" "grep -q '/metrics' backend/src/index.ts"
    validate "Structured logging implemented" "grep -q 'logger.info' backend/src/index.ts"
    validate "Monitoring service integration" "grep -q 'monitoring.startMonitoring' backend/src/index.ts"
    validate "Log rotation configured" "grep -q 'max-size.*5m' docker-compose.rpi.yml"
    validate "Health check intervals optimized" "grep -q 'interval: 60s' docker-compose.rpi.yml"
    
    # Phase 11: Environment Configuration Validation
    log "${BLUE}🌍 Phase 11: Environment Configuration Validation${NC}"
    
    validate "Production environment template exists" "check_file '.env.production'"
    validate "Environment example exists" "check_file '.env.example'"
    validate "Raspberry Pi environment variables configured" "grep -q 'RASPBERRY_PI=true' docker-compose.rpi.yml"
    validate "Thread pool optimization configured" "grep -q 'UV_THREADPOOL_SIZE=4' docker-compose.rpi.yml"
    
    # Phase 12: Documentation Validation
    log "${BLUE}📚 Phase 12: Documentation Validation${NC}"
    
    validate "Main README exists" "check_file 'README.md'" false
    validate "Deployment guide exists" "check_file 'DEPLOYMENT.md'"
    validate "Docker documentation exists" "check_file 'DOCKER.md'" false
    validate "Raspberry Pi documentation exists" "check_file 'RASPBERRY_PI.md'" false
    validate "Test report exists" "check_file 'TEST_REPORT.md'" false
    
    # Phase 13: Final Integration Checks
    log "${BLUE}🔗 Phase 13: Final Integration Checks${NC}"
    
    validate "All critical scripts are present" "ls scripts/*.sh | wc -l | grep -q '[5-9]'"
    validate "Database schema exists" "check_file 'backend/src/database/schema.sql'"
    validate "Database migrations exist" "check_file 'backend/src/database/migrations.ts'"
    validate "Seed data script exists" "check_file 'backend/src/scripts/seed.ts'"
    validate "Error handling middleware exists" "check_file 'backend/src/middleware/errorHandler.ts'"
    validate "Request logging middleware exists" "check_file 'backend/src/middleware/requestLogger.ts'"
    
    # Generate Validation Report
    echo
    log "${BLUE}📋 Deployment Validation Results${NC}"
    echo "========================================"
    
    local critical_failures=0
    local warnings=0
    
    for result in "${VALIDATION_RESULTS[@]}"; do
        if [[ $result == *"CRITICAL"* ]]; then
            log "${RED}❌ ${result}${NC}"
            ((critical_failures++))
        elif [[ $result == *"NON-CRITICAL"* ]]; then
            log "${YELLOW}⚠️ ${result}${NC}"
            ((warnings++))
        elif [[ $result == PASS:* ]]; then
            log "${GREEN}✅ ${result#PASS: }${NC}"
        else
            log "${RED}❌ ${result#FAIL: }${NC}"
        fi
    done
    
    echo
    log "${BLUE}📊 Validation Summary${NC}"
    log "${GREEN}✅ Validations Passed: $VALIDATIONS_PASSED${NC}"
    log "${RED}❌ Validations Failed: $VALIDATIONS_FAILED${NC}"
    log "${YELLOW}⚠️ Critical Failures: $critical_failures${NC}"
    log "${YELLOW}⚠️ Warnings: $warnings${NC}"
    
    local total_validations=$((VALIDATIONS_PASSED + VALIDATIONS_FAILED))
    local success_rate=$((VALIDATIONS_PASSED * 100 / total_validations))
    
    log "${BLUE}📈 Success Rate: ${success_rate}%${NC}"
    
    # Final Assessment
    echo
    if [ $critical_failures -eq 0 ]; then
        log "${GREEN}🎉 Deployment validation passed! Application is ready for production deployment.${NC}"
        
        echo
        log "${BLUE}✅ Deployment Readiness Checklist:${NC}"
        echo "  🏗️ Project structure is complete"
        echo "  ⚙️ Configuration files are valid"
        echo "  📜 Deployment scripts are ready"
        echo "  💻 Source code is properly structured"
        echo "  🐳 Docker configuration is optimized"
        echo "  🔒 Security measures are implemented"
        echo "  ⚡ Performance optimizations are in place"
        echo "  📊 Monitoring and logging are configured"
        echo "  🌍 Environment configuration is ready"
        echo "  📚 Documentation is available"
        echo "  🔗 All components are integrated"
        
        if [ $warnings -gt 0 ]; then
            echo
            log "${YELLOW}⚠️ Note: There are $warnings non-critical warnings that should be addressed when possible.${NC}"
        fi
        
        echo
        log "${BLUE}🚀 Next Steps:${NC}"
        echo "  1. Run integration tests: ./scripts/integration-test.sh"
        echo "  2. Deploy to Raspberry Pi: ./scripts/deploy-rpi.sh"
        echo "  3. Verify deployment: ./scripts/health-check.sh"
        echo "  4. Monitor application: check logs and metrics"
        
        exit 0
    else
        log "${RED}💥 Deployment validation failed with $critical_failures critical issues.${NC}"
        
        echo
        log "${BLUE}🔧 Required Actions:${NC}"
        echo "  1. Fix all critical failures listed above"
        echo "  2. Re-run validation: ./scripts/validate-deployment.sh"
        echo "  3. Address warnings when possible"
        echo "  4. Test thoroughly before deployment"
        
        echo
        log "${BLUE}🆘 Common Issues and Solutions:${NC}"
        echo "  • Missing files: Ensure all required files are created"
        echo "  • Invalid JSON: Check syntax in package.json files"
        echo "  • Script permissions: Run 'chmod +x scripts/*.sh'"
        echo "  • Docker issues: Verify Docker is installed and running"
        echo "  • Dependencies: Run 'npm install' in backend and frontend"
        
        exit 1
    fi
}

# Handle script arguments
case "${1:-validate}" in
    "validate")
        main
        ;;
    "quick")
        log "${BLUE}🏃 Running quick validation (critical checks only)...${NC}"
        # Set flag for quick validation
        QUICK_VALIDATION=true
        main
        ;;
    "report")
        if [ -f "$VALIDATION_LOG" ]; then
            log "${BLUE}📋 Displaying last validation report...${NC}"
            cat "$VALIDATION_LOG"
        else
            log "${YELLOW}⚠️ No validation report found. Run validation first.${NC}"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 [validate|quick|report]"
        echo "  validate - Run full deployment validation (default)"
        echo "  quick    - Run critical validations only"
        echo "  report   - Display last validation report"
        exit 1
        ;;
esac