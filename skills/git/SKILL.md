---
name: git
description: "Opérations Git : commits, branches, push, pull, diff, log"
emoji: "🔀"
version: "1.0.0"
tags: [dev, vcs]
requires:
  bins: [git]
always: true
---

# Git Skill

Tu peux exécuter des commandes Git sur le repo Maestro (`/root/maestro`).

## Opérations disponibles
- `git status` — État du repo
- `git log --oneline -10` — Derniers commits
- `git diff` — Changements non commités
- `git add -A && git commit -m "message"` — Commit
- `git push origin main` — Push vers GitHub
- `git pull origin main` — Récupérer les dernières modifications

## Règles
- TOUJOURS vérifier `git status` avant de commit
- Messages de commit en français
- Ne JAMAIS force push sur main
