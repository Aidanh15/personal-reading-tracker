#!/bin/bash
# Docker configuration validation script
# Tests Docker configuration files without requiring Docker to be installed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC} - $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Validation functions
validate_dockerfile() {
    local dockerfile="$1"
    local name="$2"
    
    log "Validating $name..."
    
    if [[ ! -f "$dockerfile" ]]; then
        error "$name not found"
        return 1
    fi
    
    # Check for required instructions
    local required_instructions=("FROM" "WORKDIR" "COPY" "RUN" "EXPOSE" "CMD")
    local missing_instructions=()
    
    for instruction in "${required_instructions[@]}"; do
        if ! grep -q "^$instruction" "$dockerfile"; then
            missing_instructions+=("$instruction")
        fi
    done
    
    if [[ ${#missing_instructions[@]} -gt 0 ]]; then
        error "$name missing required instructions: ${missing_instructions[*]}"
        return 1
    fi
    
    # Check for security best practices
    if grep -q "^USER root" "$dockerfile" || ! grep -q "^USER" "$dockerfile"; then
        warning "$name should use non-root user"
    fi
    
    if ! grep -q "HEALTHCHECK" "$dockerfile"; then
        warning "$name missing health check"
    fi
    
    success "$name validation passed"
    return 0
}

validate_compose_file() {
    local compose_file="$1"
    local name="$2"
    
    log "Validating $name..."
    
    if [[ ! -f "$compose_file" ]]; then
        error "$name not found"
        return 1
    fi
    
    # Check YAML syntax (basic check)
    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import yaml" 2>/dev/null; then
            if ! python3 -c "import yaml; yaml.safe_load(open('$compose_file'))" 2>/dev/null; then
                error "$name has invalid YAML syntax"
                return 1
            fi
        else
            warning "PyYAML not available, skipping YAML syntax validation for $name"
        fi
    else
        warning "Python3 not available, skipping YAML syntax validation for $name"
    fi
    
    # Check for required sections
    local required_sections=("version" "services")
    for section in "${required_sections[@]}"; do
        if ! grep -q "^$section:" "$compose_file"; then
            error "$name missing required section: $section"
            return 1
        fi
    done
    
    # Check for volumes section
    if ! grep -q "^volumes:" "$compose_file"; then
        warning "$name missing volumes section"
    fi
    
    # Check for networks section
    if ! grep -q "^networks:" "$compose_file"; then
        warning "$name missing networks section"
    fi
    
    success "$name validation passed"
    return 0
}

validate_env_file() {
    local env_file="$1"
    local name="$2"
    
    log "Validating $name..."
    
    if [[ ! -f "$env_file" ]]; then
        error "$name not found"
        return 1
    fi
    
    # Check for required environment variables
    local required_vars=("NODE_ENV" "PORT" "DATABASE_PATH")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file" && ! grep -q "^# $var=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        warning "$name missing recommended variables: ${missing_vars[*]}"
    fi
    
    success "$name validation passed"
    return 0
}

validate_scripts() {
    log "Validating scripts..."
    
    local scripts=("scripts/docker-build.sh" "scripts/health-check.sh")
    local all_valid=true
    
    for script in "${scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            error "Script not found: $script"
            all_valid=false
            continue
        fi
        
        if [[ ! -x "$script" ]]; then
            error "Script not executable: $script"
            all_valid=false
            continue
        fi
        
        # Basic shell syntax check
        if ! bash -n "$script" 2>/dev/null; then
            error "Script has syntax errors: $script"
            all_valid=false
            continue
        fi
        
        success "Script validation passed: $script"
    done
    
    return $([[ "$all_valid" == "true" ]] && echo 0 || echo 1)
}

validate_project_structure() {
    log "Validating project structure..."
    
    local required_files=(
        "frontend/package.json"
        "backend/package.json"
        "frontend/src/main.tsx"
        "backend/src/index.ts"
    )
    
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        error "Missing required project files: ${missing_files[*]}"
        return 1
    fi
    
    # Check for build directories (should not exist in repo)
    local build_dirs=("frontend/dist" "backend/dist" "frontend/node_modules" "backend/node_modules")
    for dir in "${build_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            warning "Build directory exists (should be in .gitignore): $dir"
        fi
    done
    
    success "Project structure validation passed"
    return 0
}

validate_dockerignore() {
    log "Validating .dockerignore..."
    
    if [[ ! -f ".dockerignore" ]]; then
        error ".dockerignore not found"
        return 1
    fi
    
    # Check for important exclusions
    local important_exclusions=("node_modules" ".git" "*.log" "dist" "build")
    local missing_exclusions=()
    
    for exclusion in "${important_exclusions[@]}"; do
        if ! grep -q "$exclusion" ".dockerignore"; then
            missing_exclusions+=("$exclusion")
        fi
    done
    
    if [[ ${#missing_exclusions[@]} -gt 0 ]]; then
        warning ".dockerignore missing recommended exclusions: ${missing_exclusions[*]}"
    fi
    
    success ".dockerignore validation passed"
    return 0
}

# Main validation function
main() {
    log "Starting Docker configuration validation..."
    
    local validation_results=()
    
    # Validate Dockerfiles
    validate_dockerfile "Dockerfile" "Main Dockerfile" && validation_results+=("dockerfile_main") || validation_results+=("dockerfile_main_failed")
    validate_dockerfile "Dockerfile.dev" "Development Dockerfile" && validation_results+=("dockerfile_dev") || validation_results+=("dockerfile_dev_failed")
    
    # Validate docker-compose files
    validate_compose_file "docker-compose.yml" "Main docker-compose.yml" && validation_results+=("compose_main") || validation_results+=("compose_main_failed")
    validate_compose_file "docker-compose.prod.yml" "Production docker-compose.yml" && validation_results+=("compose_prod") || validation_results+=("compose_prod_failed")
    validate_compose_file "docker-compose.override.yml" "Override docker-compose.yml" && validation_results+=("compose_override") || validation_results+=("compose_override_failed")
    
    # Validate environment file
    validate_env_file ".env.example" "Environment example file" && validation_results+=("env") || validation_results+=("env_failed")
    
    # Validate scripts
    validate_scripts && validation_results+=("scripts") || validation_results+=("scripts_failed")
    
    # Validate project structure
    validate_project_structure && validation_results+=("structure") || validation_results+=("structure_failed")
    
    # Validate .dockerignore
    validate_dockerignore && validation_results+=("dockerignore") || validation_results+=("dockerignore_failed")
    
    # Summary
    log "Validation Summary:"
    local passed=0
    local failed=0
    
    for result in "${validation_results[@]}"; do
        if [[ "$result" == *"_failed" ]]; then
            ((failed++))
        else
            ((passed++))
        fi
    done
    
    echo
    success "Passed: $passed"
    if [[ $failed -gt 0 ]]; then
        error "Failed: $failed"
        echo
        error "Some validations failed. Please review the issues above."
        exit 1
    else
        echo
        success "All Docker configuration validations passed!"
        log "The Docker containerization setup is ready for deployment."
    fi
}

# Run main function
main "$@"