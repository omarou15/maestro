---
name: web-search
description: "Recherche web et scraping : Google, actualités, prix, informations"
emoji: "🔍"
version: "1.0.0"
tags: [research, web]
requires:
  bins: [curl, jq]
install:
  - { kind: apt, package: jq }
---

# Web Search Skill

Recherche d'informations sur le web.

## Capacités
- Recherche Google via SerpAPI ou scraping
- Extraction de contenu web (curl + parsing)
- Veille prix/concurrence
- Actualités secteur énergie/audit

## Commandes utiles
- `curl -s "URL" | jq '.'` — Fetch JSON API
- `curl -s "URL" -o output.html` — Download page

## Contexte métier
- Veille sur les normes RE2020, DPE, audit énergétique
- Prix moyens DPE : 150-300€ selon surface
- Concurrents à surveiller dans la région Rhône-Alpes
