#!/bin/bash

# Log Management Script for Raspberry Pi
# Helps monitor and manage log storage to prevent disk space issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:3003/api"  # Updated for SSD deployment port
LOGS_DIR="/mnt/SSD/projects/personal-reading-tracker/logs"  # SSD path

echo -e "${BLUE}🍓 Personal Reading Tracker - Log Management${NC}"
echo "=================================================="

# Function to check if service is running
check_service() {
    if curl -s "${API_BASE}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Service is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Service is not running${NC}"
        return 1
    fi
}

# Function to get log statistics
get_log_stats() {
    echo -e "\n${BLUE}📊 Log Statistics${NC}"
    echo "=================="
    
    if check_service; then
        # Get stats from API
        curl -s "${API_BASE}/logs/stats" | jq '.' 2>/dev/null || echo "API stats not available"
    fi
    
    # Get local filesystem stats
    if [ -d "$LOGS_DIR" ]; then
        echo -e "\n${YELLOW}Local Log Directory Stats:${NC}"
        echo "Directory: $LOGS_DIR"
        echo "Files: $(find $LOGS_DIR -name "*.log" | wc -l)"
        echo "Total Size: $(du -sh $LOGS_DIR 2>/dev/null | cut -f1 || echo "0B")"
        echo "Oldest Log: $(find $LOGS_DIR -name "*.log" -type f -exec stat -f "%Sm %N" -t "%Y-%m-%d %H:%M" {} \; 2>/dev/null | sort | head -1 || echo "None")"
    else
        echo -e "${YELLOW}No logs directory found${NC}"
    fi
}

# Function to rotate logs
rotate_logs() {
    echo -e "\n${BLUE}🔄 Rotating Logs${NC}"
    echo "================"
    
    if check_service; then
        echo "Triggering log rotation via API..."
        curl -s -X POST "${API_BASE}/logs/rotate" | jq '.' 2>/dev/null || echo "Rotation triggered"
        echo -e "${GREEN}✅ Log rotation completed${NC}"
    else
        echo -e "${YELLOW}Service not running, performing manual rotation...${NC}"
        
        if [ -d "$LOGS_DIR" ]; then
            # Manual rotation for when service is down
            cd "$LOGS_DIR"
            for log in *.log; do
                if [ -f "$log" ] && [ $(stat -f%z "$log" 2>/dev/null || echo 0) -gt 10485760 ]; then # 10MB
                    timestamp=$(date +%Y%m%d_%H%M%S)
                    mv "$log" "${log%.log}_${timestamp}.log"
                    echo "Rotated: $log -> ${log%.log}_${timestamp}.log"
                fi
            done
            
            # Clean up old logs (keep only 5 most recent)
            ls -t *_*.log 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
            echo -e "${GREEN}✅ Manual rotation completed${NC}"
        fi
    fi
}

# Function to clean old logs
clean_logs() {
    echo -e "\n${BLUE}🧹 Cleaning Old Logs${NC}"
    echo "==================="
    
    if [ -d "$LOGS_DIR" ]; then
        echo "Removing logs older than 7 days..."
        find "$LOGS_DIR" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
        
        echo "Removing empty log files..."
        find "$LOGS_DIR" -name "*.log" -type f -size 0 -delete 2>/dev/null || true
        
        echo -e "${GREEN}✅ Cleanup completed${NC}"
    else
        echo -e "${YELLOW}No logs directory found${NC}"
    fi
}

# Function to monitor disk space
check_disk_space() {
    echo -e "\n${BLUE}💾 Disk Space Check${NC}"
    echo "==================="
    
    # Check overall disk usage
    df -h . | tail -1 | while read filesystem size used avail capacity mounted; do
        echo "Filesystem: $filesystem"
        echo "Total: $size"
        echo "Used: $used"
        echo "Available: $avail"
        echo "Capacity: $capacity"
        
        # Extract percentage (remove %)
        usage_percent=${capacity%\%}
        
        if [ "$usage_percent" -gt 85 ]; then
            echo -e "${RED}⚠️  WARNING: Disk usage is high ($capacity)${NC}"
        elif [ "$usage_percent" -gt 70 ]; then
            echo -e "${YELLOW}⚠️  CAUTION: Disk usage is elevated ($capacity)${NC}"
        else
            echo -e "${GREEN}✅ Disk usage is normal ($capacity)${NC}"
        fi
    done
}

# Function to show system info
show_system_info() {
    echo -e "\n${BLUE}🍓 System Information${NC}"
    echo "====================="
    
    echo "Architecture: $(uname -m)"
    echo "OS: $(uname -s)"
    echo "Kernel: $(uname -r)"
    
    # Memory info
    if [ -f /proc/meminfo ]; then
        total_mem=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        avail_mem=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        used_mem=$((total_mem - avail_mem))
        mem_percent=$((used_mem * 100 / total_mem))
        
        echo "Memory: ${mem_percent}% used ($(($used_mem/1024))MB / $(($total_mem/1024))MB)"
        
        if [ "$mem_percent" -gt 80 ]; then
            echo -e "${RED}⚠️  WARNING: High memory usage${NC}"
        fi
    fi
    
    # Temperature (Pi specific)
    if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
        temp=$(($(cat /sys/class/thermal/thermal_zone0/temp) / 1000))
        echo "CPU Temperature: ${temp}°C"
        
        if [ "$temp" -gt 70 ]; then
            echo -e "${RED}⚠️  WARNING: High temperature${NC}"
        elif [ "$temp" -gt 60 ]; then
            echo -e "${YELLOW}⚠️  CAUTION: Elevated temperature${NC}"
        fi
    fi
}

# Main menu
show_menu() {
    echo -e "\n${BLUE}📋 Available Actions${NC}"
    echo "===================="
    echo "1. Show log statistics"
    echo "2. Rotate logs"
    echo "3. Clean old logs"
    echo "4. Check disk space"
    echo "5. Show system info"
    echo "6. Full maintenance (rotate + clean)"
    echo "7. Exit"
    echo
}

# Main execution
case "${1:-menu}" in
    "stats")
        get_log_stats
        ;;
    "rotate")
        rotate_logs
        ;;
    "clean")
        clean_logs
        ;;
    "disk")
        check_disk_space
        ;;
    "system")
        show_system_info
        ;;
    "maintenance")
        echo -e "${BLUE}🔧 Running Full Maintenance${NC}"
        rotate_logs
        clean_logs
        get_log_stats
        check_disk_space
        ;;
    "menu"|*)
        while true; do
            show_menu
            read -p "Choose an action (1-7): " choice
            
            case $choice in
                1) get_log_stats ;;
                2) rotate_logs ;;
                3) clean_logs ;;
                4) check_disk_space ;;
                5) show_system_info ;;
                6) 
                    echo -e "${BLUE}🔧 Running Full Maintenance${NC}"
                    rotate_logs
                    clean_logs
                    get_log_stats
                    check_disk_space
                    ;;
                7) 
                    echo -e "${GREEN}👋 Goodbye!${NC}"
                    exit 0
                    ;;
                *) 
                    echo -e "${RED}Invalid choice. Please try again.${NC}"
                    ;;
            esac
            
            echo
            read -p "Press Enter to continue..."
        done
        ;;
esac