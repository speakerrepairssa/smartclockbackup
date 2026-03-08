// PM2 Ecosystem — SmartClock HR Avatar (add-on to existing relay)
// Usage: pm2 start ecosystem-hr.config.js
module.exports = {
  apps: [
    // ── 1. Token Server (Node.js) ─────────────────────────────────────────
    {
      name: 'hr-token-server',
      script: '/opt/hr-avatar-agent/token-server.js',
      cwd: '/opt/hr-avatar-agent',
      interpreter: 'node',
      env_file: '/opt/hr-avatar-agent/.env',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      log_file: '/var/log/hr-token-server.log',
      error_file: '/var/log/hr-token-server-error.log',
      out_file: '/var/log/hr-token-server-out.log',
    },

    // ── 2. Python Agent (LiveKit worker) ──────────────────────────────────
    // The agent connects OUT to LiveKit Cloud — no inbound port needed.
    // PM2 wraps it so it auto-restarts if it crashes.
    {
      name: 'hr-avatar-agent',
      script: 'agent.py',
      cwd: '/opt/hr-avatar-agent',
      interpreter: '/opt/hr-avatar-agent/.venv/bin/python',
      args: 'start',           // 'start' = production mode
      env_file: '/opt/hr-avatar-agent/.env',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Large kill_timeout so active HR conversations finish gracefully
      kill_timeout: 600000,    // 10 minutes grace period before SIGKILL
      log_file: '/var/log/hr-avatar-agent.log',
      error_file: '/var/log/hr-avatar-agent-error.log',
      out_file: '/var/log/hr-avatar-agent-out.log',
    },
  ],
};
