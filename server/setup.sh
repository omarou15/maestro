#!/bin/bash
# Maestro Core - Server Setup Script
# Run this on the Hetzner server (178.156.251.108)

echo "🎯 Setting up Maestro Core..."

# Clone the repo
cd /root
if [ -d "maestro" ]; then
  cd maestro && git pull
else
  git clone https://github.com/omarou15/maestro.git
  cd maestro
fi

# Install server dependencies
cd server
npm install

# Create systemd service for auto-start
cat > /etc/systemd/system/maestro-core.service << 'SERVICE'
[Unit]
Description=Maestro Core - AI Orchestrator
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/maestro/server
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

# Enable and start
systemctl daemon-reload
systemctl enable maestro-core
systemctl start maestro-core

echo ""
echo "🎯 Maestro Core installed!"
echo "📡 API: http://178.156.251.108:4000"
echo "🔍 Status: systemctl status maestro-core"
echo "📜 Logs: journalctl -u maestro-core -f"
echo ""
