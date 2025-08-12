#!/bin/bash

# Health check script for Raspberry Pi deployment
# This script performs comprehensive health checks optimized for Pi hardware

set -e

# Configuration
CONTAINER_NAME="${CONTAINER_NAME:-personal-reading-tracker-rpi}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:3000/health}"
LOG_FILE="${LOG_FILE:-/tmp/health-check.log}"
MAX_MEMORY_MB="${MAX_MEMORY_MB:-350}"
MAX_CPU_PERCENT="${MAX_CPU_PERCENT:-80}"
MAX_TEMP_C="${MAX_TEMP_C:-70}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Check if running on Raspberry Pi
check_raspberry_pi() {
    if [ -f /proc/device-tree/model ] && grep -q "Raspberry Pi" /proc/device-tree/model; then
        log "✅ Running on Raspberry Pi: $(cat /proc/device-tree/model)"
        return 0
    else
        log "ℹ️ Not running on Raspberry Pi hardware"
        return 1
    fi
}

# Check system temperature (Pi specific)
check_temperature() {
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        local temp_raw=$(cat /sys/class/thermal/thermal_zone0/temp)
        local temp_c=$((temp_raw / 1000))
        
        if [ "$temp_c" -gt "$MAX_TEMP_C" ]; then
            log "🌡️ ${RED}WARNING: High temperature: ${temp_c}°C (max: ${MAX_TEMP_C}°C)${NC}"
            return 1
        else
            log "🌡️ ${GREEN}Temperature OK: ${temp_c}°C${NC}"
            return 0
        fi
    else
        log "🌡️ Temperature monitoring not available"
        return 0
    fi
}

# Check container health
check_container_health() {
    if ! docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" | grep -q "$CONTAINER_NAME"; then
        log "🐳 ${RED}ERROR: Container $CONTAINER_NAME is not running${NC}"
        return 1
    fi
    
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
    
    case "$health_status" in
        "healthy")
            log "🐳 ${GREEN}Container health: healthy${NC}"
            return 0
            ;;
        "unhealthy")
            log "🐳 ${RED}ERROR: Container health: unhealthy${NC}"
            return 1
            ;;
        "starting")
            log "🐳 ${YELLOW}Container health: starting${NC}"
            return 0
            ;;
        *)
            log "🐳 ${YELLOW}Container health: unknown${NC}"
            return 0
            ;;
    esac
}

# Check application endpoint
check_application_health() {
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$HEALTH_ENDPOINT" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        local memory_used=$(jq -r '.memory.used // 0' /tmp/health_response.json 2>/dev/null || echo "0")
        local uptime=$(jq -r '.uptime // 0' /tmp/health_response.json 2>/dev/null || echo "0")
        
        log "🚀 ${GREEN}Application health: OK (uptime: ${uptime}s, memory: ${memory_used}MB)${NC}"
        
        # Check memory usage
        if [ "$memory_used" -gt "$MAX_MEMORY_MB" ]; then
            log "💾 ${YELLOW}WARNING: High memory usage: ${memory_used}MB (max: ${MAX_MEMORY_MB}MB)${NC}"
        fi
        
        return 0
    else
        log "🚀 ${RED}ERROR: Application health check failed (HTTP $response)${NC}"
        return 1
    fi
}

# Check container resource usage
check_container_resources() {
    local stats=$(docker stats "$CONTAINER_NAME" --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | tail -n 1)
    
    if [ -n "$stats" ]; then
        local cpu_percent=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
        local memory_usage=$(echo "$stats" | awk '{print $2}')
        
        log "📊 Container resources: CPU: ${cpu_percent}%, Memory: ${memory_usage}"
        
        # Check CPU usage (remove decimal point for comparison)
        local cpu_int=$(echo "$cpu_percent" | cut -d'.' -f1)
        if [ "$cpu_int" -gt "$MAX_CPU_PERCENT" ]; then
            log "⚡ ${YELLOW}WARNING: High CPU usage: ${cpu_percent}%${NC}"
        fi
        
        return 0
    else
        log "📊 ${YELLOW}Could not retrieve container resource stats${NC}"
        return 0
    fi
}

# Check disk space
check_disk_space() {
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 85 ]; then
        log "💽 ${RED}WARNING: High disk usage: ${disk_usage}%${NC}"
        return 1
    else
        log "💽 ${GREEN}Disk usage OK: ${disk_usage}%${NC}"
        return 0
    fi
}

# Check memory pressure
check_memory_pressure() {
    local mem_available=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    
    if [ "$mem_available" -lt 100 ]; then
        log "🧠 ${RED}WARNING: Low available memory: ${mem_available}MB${NC}"
        return 1
    else
        log "🧠 ${GREEN}Available memory OK: ${mem_available}MB${NC}"
        return 0
    fi
}

# Main health check function
main() {
    log "🔍 Starting health check for Raspberry Pi deployment"
    
    local exit_code=0
    
    # Run all checks
    check_raspberry_pi || true  # Don't fail if not on Pi
    check_temperature || exit_code=1
    check_container_health || exit_code=1
    check_application_health || exit_code=1
    check_container_resources || true  # Don't fail on resource check
    check_disk_space || exit_code=1
    check_memory_pressure || exit_code=1
    
    if [ $exit_code -eq 0 ]; then
        log "✅ ${GREEN}All health checks passed${NC}"
    else
        log "❌ ${RED}Some health checks failed${NC}"
    fi
    
    # Clean up old log entries (keep last 100 lines)
    if [ -f "$LOG_FILE" ]; then
        tail -n 100 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi
    
    exit $exit_code
}

# Run main function
main "$@"