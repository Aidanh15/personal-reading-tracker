#!/bin/bash
# Docker build and deployment script for Personal Reading Tracker
# Supports different build targets and deployment scenarios

set -e

# Configuration
IMAGE_NAME="personal-reading-tracker"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_TARGET="${BUILD_TARGET:-production}"
PLATFORM="${PLATFORM:-linux/arm64,linux/amd64}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}$(date '+%Y-%m-%d %H:%M:%S')${NC} - $1"
}

error() {
    echo -e "${RED}$(date '+%Y-%m-%d %H:%M:%S') ERROR${NC} - $1" >&2
}

success() {
    echo -e "${GREEN}$(date '+%Y-%m-%d %H:%M:%S') SUCCESS${NC} - $1"
}

warning() {
    echo -e "${YELLOW}$(date '+%Y-%m-%d %H:%M:%S') WARNING${NC} - $1"
}

# Help function
show_help() {
    cat << EOF
Docker Build Script for Personal Reading Tracker

Usage: $0 [OPTIONS] COMMAND

Commands:
    build       Build Docker image
    push        Push Docker image to registry
    deploy      Deploy using docker-compose
    test        Test the built image
    clean       Clean up Docker resources
    help        Show this help message

Options:
    -t, --tag TAG           Set image tag (default: latest)
    -p, --platform PLATFORM Set build platform (default: linux/arm64,linux/amd64)
    --target TARGET         Set build target (default: production)
    --no-cache             Build without cache
    --push                 Push image after building
    --env ENV              Environment (dev, prod) for deployment

Examples:
    $0 build                    # Build production image
    $0 build --tag v1.0.0       # Build with specific tag
    $0 build --target development # Build development image
    $0 deploy --env prod        # Deploy production environment
    $0 test                     # Test the built image

EOF
}

# Build function
build_image() {
    local no_cache=""
    local push_after=""
    
    # Parse build options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-cache)
                no_cache="--no-cache"
                shift
                ;;
            --push)
                push_after="true"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    log "Building Docker image..."
    log "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    log "Target: ${BUILD_TARGET}"
    log "Platform: ${PLATFORM}"
    
    # Check if buildx is available for multi-platform builds
    if docker buildx version >/dev/null 2>&1; then
        log "Using Docker Buildx for multi-platform build"
        
        # Create builder if it doesn't exist
        if ! docker buildx inspect reading-tracker-builder >/dev/null 2>&1; then
            log "Creating buildx builder..."
            docker buildx create --name reading-tracker-builder --use
        else
            docker buildx use reading-tracker-builder
        fi
        
        # Build command
        docker buildx build \
            --platform "${PLATFORM}" \
            --target "${BUILD_TARGET}" \
            --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
            ${no_cache} \
            --load \
            .
    else
        warning "Docker Buildx not available, building for current platform only"
        docker build \
            --target "${BUILD_TARGET}" \
            --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
            ${no_cache} \
            .
    fi
    
    success "Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}"
    
    # Push if requested
    if [[ "$push_after" == "true" ]]; then
        push_image
    fi
}

# Push function
push_image() {
    log "Pushing Docker image to registry..."
    
    if docker push "${IMAGE_NAME}:${IMAGE_TAG}"; then
        success "Image pushed successfully: ${IMAGE_NAME}:${IMAGE_TAG}"
    else
        error "Failed to push image"
        exit 1
    fi
}

# Deploy function
deploy_app() {
    local env="${1:-dev}"
    
    log "Deploying application (environment: ${env})..."
    
    case $env in
        dev|development)
            log "Starting development environment..."
            docker-compose --profile dev up -d
            ;;
        prod|production)
            log "Starting production environment..."
            docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
            ;;
        *)
            error "Unknown environment: $env"
            error "Supported environments: dev, prod"
            exit 1
            ;;
    esac
    
    success "Application deployed successfully"
    
    # Show status
    docker-compose ps
}

# Test function
test_image() {
    log "Testing Docker image..."
    
    # Start container in background
    local container_id
    container_id=$(docker run -d -p 3001:3000 "${IMAGE_NAME}:${IMAGE_TAG}")
    
    # Wait for container to start
    log "Waiting for container to start..."
    sleep 10
    
    # Test health endpoint
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:3001/health >/dev/null; then
            success "Health check passed"
            break
        fi
        
        log "Attempt $attempt/$max_attempts - waiting for service..."
        sleep 2
        ((attempt++))
    done
    
    if [[ $attempt -gt $max_attempts ]]; then
        error "Health check failed after $max_attempts attempts"
        docker logs "$container_id"
        docker stop "$container_id"
        docker rm "$container_id"
        exit 1
    fi
    
    # Run additional tests
    log "Running API tests..."
    
    # Test API endpoints
    if curl -f -s http://localhost:3001/api/books >/dev/null; then
        success "API endpoints accessible"
    else
        warning "API endpoints test failed (may be expected if no data)"
    fi
    
    # Cleanup
    log "Cleaning up test container..."
    docker stop "$container_id"
    docker rm "$container_id"
    
    success "Image testing completed successfully"
}

# Clean function
clean_resources() {
    log "Cleaning up Docker resources..."
    
    # Stop and remove containers
    docker-compose down --remove-orphans
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (with confirmation)
    read -p "Remove unused volumes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
    fi
    
    success "Cleanup completed"
}

# Main function
main() {
    # Parse global options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -p|--platform)
                PLATFORM="$2"
                shift 2
                ;;
            --target)
                BUILD_TARGET="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            build|push|deploy|test|clean|help)
                COMMAND="$1"
                shift
                break
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Check if command is provided
    if [[ -z "${COMMAND:-}" ]]; then
        error "No command provided"
        show_help
        exit 1
    fi
    
    # Execute command
    case $COMMAND in
        build)
            build_image "$@"
            ;;
        push)
            push_image
            ;;
        deploy)
            local env="${1:-dev}"
            if [[ "$1" == "--env" ]]; then
                env="$2"
            fi
            deploy_app "$env"
            ;;
        test)
            test_image
            ;;
        clean)
            clean_resources
            ;;
        help)
            show_help
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"