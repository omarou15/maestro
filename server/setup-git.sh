#!/bin/bash
# Run this on the Hetzner server to enable git push
# Usage: bash setup-git.sh YOUR_GITHUB_TOKEN
cd /root/maestro
git config user.email "maestro@maestro-chi.vercel.app"
git config user.name "Maestro Bot"
if [ -z "$1" ]; then
  echo "Usage: bash setup-git.sh YOUR_GITHUB_TOKEN"
  exit 1
fi
git remote set-url origin "https://${1}@github.com/omarou15/maestro.git"
echo "Git configured for auto-push"
