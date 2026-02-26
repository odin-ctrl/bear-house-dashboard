/**
 * PM2 Ecosystem Config for Bear House Dashboard
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart bear-house
 *   pm2 logs bear-house
 *   pm2 monit
 */

module.exports = {
  apps: [{
    name: 'bear-house',
    script: 'server.js',
    cwd: '/Users/odingaze/.openclaw/workspace/bear-house-dashboard',
    
    // Auto-restart settings
    watch: true,
    ignore_watch: ['node_modules', 'data', '*.log', '.git'],
    watch_delay: 1000,
    
    // Restart policies
    max_memory_restart: '200M',
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Logging
    error_file: '/Users/odingaze/.openclaw/workspace/bear-house-dashboard/logs/error.log',
    out_file: '/Users/odingaze/.openclaw/workspace/bear-house-dashboard/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // Health check
    listen_timeout: 8000,
    kill_timeout: 3000,
    
    // Cron restart (optional - daily at 4am)
    // cron_restart: '0 4 * * *',
  }]
};
