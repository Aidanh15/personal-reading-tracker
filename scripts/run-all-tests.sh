#!/bin/bash

# Comprehensive Test Runner Script
# This script runs all types of tests for the Personal Reading Tracker

set -e

echo "🧪 Starting Comprehensive Test Suite for Personal Reading Tracker"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi

if ! command_exists docker; then
    print_warning "Docker is not installed - skipping Docker tests"
    SKIP_DOCKER=true
fi

# Install dependencies if needed
print_status "Installing dependencies..."

if [ ! -d "node_modules" ]; then
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    cd frontend && npm install && cd ..
fi

# Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    print_status "Installing Playwright browsers..."
    npx playwright install
fi

# Initialize test results
BACKEND_TESTS_PASSED=false
FRONTEND_TESTS_PASSED=false
E2E_TESTS_PASSED=false
VISUAL_TESTS_PASSED=false
PERFORMANCE_TESTS_PASSED=false
DOCKER_TESTS_PASSED=false

# 1. Backend Unit Tests
print_status "Running backend unit tests..."
cd backend
if npm test -- --coverage; then
    print_success "Backend unit tests passed"
    BACKEND_TESTS_PASSED=true
else
    print_error "Backend unit tests failed"
fi
cd ..

# 2. Frontend Unit Tests
print_status "Running frontend unit tests..."
cd frontend
if npm test; then
    print_success "Frontend unit tests passed"
    FRONTEND_TESTS_PASSED=true
else
    print_error "Frontend unit tests failed"
fi
cd ..

# 3. Build Applications
print_status "Building applications..."
cd frontend
if npm run build; then
    print_success "Frontend build successful"
else
    print_error "Frontend build failed"
    exit 1
fi
cd ..

cd backend
if npm run build; then
    print_success "Backend build successful"
else
    print_error "Backend build failed"
    exit 1
fi
cd ..

# 4. Start applications for E2E tests
print_status "Starting applications for E2E tests..."

# Start backend in background
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Start frontend in background
cd frontend
npm run preview &
FRONTEND_PID=$!
cd ..

# Wait for services to start
sleep 10

# Function to cleanup background processes
cleanup() {
    print_status "Cleaning up background processes..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# 5. End-to-End Tests
print_status "Running end-to-end tests..."
if npx playwright test --reporter=html; then
    print_success "E2E tests passed"
    E2E_TESTS_PASSED=true
else
    print_error "E2E tests failed"
fi

# 6. Visual Regression Tests
print_status "Running visual regression tests..."
if npx playwright test visual-regression.spec.ts; then
    print_success "Visual regression tests passed"
    VISUAL_TESTS_PASSED=true
else
    print_warning "Visual regression tests failed (may be due to baseline differences)"
fi

# 7. Performance Tests
print_status "Running performance tests..."
cd backend
if npm test -- --testNamePattern="Performance"; then
    print_success "Performance tests passed"
    PERFORMANCE_TESTS_PASSED=true
else
    print_warning "Performance tests failed (may require running server)"
fi
cd ..

# 8. Docker Tests (if Docker is available)
if [ "$SKIP_DOCKER" != true ]; then
    print_status "Running Docker build test..."
    if docker build -t personal-reading-tracker:test .; then
        print_success "Docker build successful"
        
        # Test Docker container
        print_status "Testing Docker container..."
        if docker run -d --name test-container -p 3000:3000 personal-reading-tracker:test; then
            sleep 10
            if curl -f http://localhost:3000/health 2>/dev/null; then
                print_success "Docker container test passed"
                DOCKER_TESTS_PASSED=true
            else
                print_warning "Docker container health check failed"
            fi
            docker stop test-container 2>/dev/null || true
            docker rm test-container 2>/dev/null || true
        else
            print_error "Docker container failed to start"
        fi
    else
        print_error "Docker build failed"
    fi
fi

# Generate Test Report
print_status "Generating test report..."

echo ""
echo "🧪 Test Results Summary"
echo "======================="

if [ "$BACKEND_TESTS_PASSED" = true ]; then
    print_success "✅ Backend Unit Tests"
else
    print_error "❌ Backend Unit Tests"
fi

if [ "$FRONTEND_TESTS_PASSED" = true ]; then
    print_success "✅ Frontend Unit Tests"
else
    print_error "❌ Frontend Unit Tests"
fi

if [ "$E2E_TESTS_PASSED" = true ]; then
    print_success "✅ End-to-End Tests"
else
    print_error "❌ End-to-End Tests"
fi

if [ "$VISUAL_TESTS_PASSED" = true ]; then
    print_success "✅ Visual Regression Tests"
else
    print_warning "⚠️  Visual Regression Tests"
fi

if [ "$PERFORMANCE_TESTS_PASSED" = true ]; then
    print_success "✅ Performance Tests"
else
    print_warning "⚠️  Performance Tests"
fi

if [ "$SKIP_DOCKER" != true ]; then
    if [ "$DOCKER_TESTS_PASSED" = true ]; then
        print_success "✅ Docker Tests"
    else
        print_error "❌ Docker Tests"
    fi
else
    print_warning "⚠️  Docker Tests (Skipped)"
fi

echo ""
echo "📊 Test Coverage Reports:"
echo "- Backend: backend/coverage/lcov-report/index.html"
echo "- E2E: playwright-report/index.html"
echo ""

# Calculate overall success
CRITICAL_TESTS_PASSED=0
TOTAL_CRITICAL_TESTS=3

if [ "$BACKEND_TESTS_PASSED" = true ]; then
    ((CRITICAL_TESTS_PASSED++))
fi

if [ "$FRONTEND_TESTS_PASSED" = true ]; then
    ((CRITICAL_TESTS_PASSED++))
fi

if [ "$E2E_TESTS_PASSED" = true ]; then
    ((CRITICAL_TESTS_PASSED++))
fi

if [ $CRITICAL_TESTS_PASSED -eq $TOTAL_CRITICAL_TESTS ]; then
    print_success "🎉 All critical tests passed! Ready for deployment."
    exit 0
else
    print_error "💥 Some critical tests failed. Please review and fix issues before deployment."
    exit 1
fi