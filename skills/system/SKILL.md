---
name: system
description: "Monitoring système : CPU, RAM, disque, processus, services systemd"
emoji: "🖥️"
version: "1.0.0"
tags: [infra, monitoring]
requires:
  bins: [systemctl, htop]
install:
  - { kind: apt, package: htop }
always: true
---

# System Skill

Monitoring et gestion du serveur Hetzner (178.156.251.108).

## Commandes
- `htop -t` — Processus en arbre
- `df -h` — Espace disque
- `free -h` — Mémoire RAM
- `systemctl status maestro-core` — État du service
- `systemctl restart maestro-core` — Redémarrer Maestro
- `journalctl -u maestro-core --since "1 hour ago"` — Logs récents
- `uptime` — Uptime serveur

## Alertes
- Disque > 90% → alerte critique
- RAM > 85% → alerte haute
- CPU > 80% soutenu → alerte moyenne
