---
name: pdf
description: "Génération de PDF : devis, rapports d'audit, factures"
emoji: "📄"
version: "1.0.0"
tags: [business, documents]
requires:
  bins: [node]
  node: [puppeteer]
install:
  - { kind: npm, package: puppeteer }
---

# PDF Skill

Génération de documents PDF professionnels.

## Types de documents
- **Devis** : ligne par ligne, TVA, conditions
- **Rapports d'audit** : DPE, RE2020, diagnostics
- **Factures** : suivi paiements, relances

## Template devis
- En-tête : logo + coordonnées cabinet
- Tableau : description, quantité, prix unitaire, total HT
- Pied : total HT, TVA 20%, total TTC
- Conditions : paiement 30 jours, validité 30 jours

## Règles
- Nexity veut des devis détaillés ligne par ligne
- Toujours inclure les normes applicables (RE2020, DPE)
- Format A4, marges 2cm, police professionnelle
