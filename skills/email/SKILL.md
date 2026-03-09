---
name: email
description: "Gestion emails via Gmail API : lecture, tri, rédaction, relances"
emoji: "📧"
version: "1.0.0"
tags: [business, communication]
requires:
  env: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET]
os: [linux]
---

# Email Skill

Gestion des emails professionnels d'Omar via Gmail API.

## Opérations
- Lire les emails non lus (inbox)
- Trier par priorité (clients > fournisseurs > newsletters)
- Rédiger des réponses (ton chaleureux, "Belle journée")
- Programmer des relances (clients silencieux > 3 jours)
- Archiver les emails traités

## Règles de rédaction
- JAMAIS "Cordialement" → utiliser "Belle journée" ou "À très vite"
- Ton professionnel mais chaleureux
- Tutoyer les collègues, vouvoyer les clients
- Signer "Omar" ou "L'équipe [Nom cabinet]"

## Clients prioritaires
- Nexity : devis détaillés ligne par ligne
- SCI Les Terrasses : urgent 240m²
- Mme Leroy : lente, relancer régulièrement
