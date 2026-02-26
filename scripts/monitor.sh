#!/bin/bash
# Bear House Dashboard Monitor
# Run with: ./monitor.sh
# Or add to crontab: */5 * * * * /path/to/monitor.sh

HEALTH_URL="http://localhost:3000/api/health"
LOG_FILE="/Users/odingaze/.openclaw/workspace/bear-house-dashboard/logs/monitor.log"

timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

log() {
    echo "[$(timestamp)] $1" >> "$LOG_FILE"
}

# Check health endpoint
response=$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null)
status=$(echo "$response" | grep -o '"status":"ok"')

if [ -z "$status" ]; then
    log "❌ Dashboard DOWN! Attempting restart..."
    
    # Try to restart with PM2
    pm2 restart bear-house 2>/dev/null
    
    sleep 5
    
    # Check again
    response=$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null)
    status=$(echo "$response" | grep -o '"status":"ok"')
    
    if [ -z "$status" ]; then
        log "❌ CRITICAL: Dashboard still down after restart!"
        echo "ALERT: Bear House Dashboard is DOWN and restart failed!"
        exit 1
    else
        log "✅ Dashboard recovered after restart"
    fi
else
    # Only log every 12th check (hourly if running every 5 min)
    if [ $(($(date +%M) % 60)) -lt 5 ]; then
        log "✅ Dashboard OK"
    fi
fi

exit 0
