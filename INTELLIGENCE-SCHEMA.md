# MAESTRO/OPENCLAW — SCHÉMA D'INTELLIGENCE UNIFIÉ
# Conçu par Claude Opus 4.6 pour Omar
# Date: 10 mars 2026

## LE PRINCIPE FONDAMENTAL

Le "wow effect" ne vient PAS du modèle. Il vient du CONTEXTE.
Un modèle pas cher avec un contexte parfait > un modèle cher avec zéro contexte.

Opus est "wow" parce qu'il réfléchit plus longtemps et plus profondément.
Mais si on PRÉ-MÂCHE la réflexion avec du code (gratuit), puis on donne
le résultat pré-digéré à Qwen, le résultat final est quasi identique.

## ARCHITECTURE : LE PIPELINE D'INTELLIGENCE

Chaque message entrant passe par 5 étapes AVANT de toucher un LLM :

```
MESSAGE ENTRANT (Telegram/Web)
       │
       ▼
 ┌─────────────────┐
 │  ÉTAPE 1: TRIAGE │  ← Code pur, 0 token
 │  (classifier.ts) │
 └────────┬────────┘
          │ Catégorise: simple | moyen | complexe | critique
          ▼
 ┌─────────────────────┐
 │  ÉTAPE 2: ENRICHMENT │  ← Code pur, 0 token
 │  (context-builder.ts)│
 └────────┬─────────────┘
          │ Charge: mémoire, missions actives, survival score,
          │ dernières conversations, profil Omar, date/heure
          ▼
 ┌─────────────────────┐
 │  ÉTAPE 3: ROUTING    │  ← Code pur, 0 token
 │  (model-router.ts)   │
 └────────┬─────────────┘
          │ Choisit le modèle selon la catégorie
          ▼
 ┌─────────────────────┐
 │  ÉTAPE 4: APPEL LLM  │  ← Seule étape qui coûte des tokens
 │  (llm-caller.ts)     │
 └────────┬─────────────┘
          │
          ▼
 ┌─────────────────────┐
 │  ÉTAPE 5: POST-PROC  │  ← Code pur, 0 token
 │  (post-process.ts)   │
 └────────┬─────────────┘
          │ Sauvegarde mémoire, met à jour missions,
          │ log l'interaction, calcule le coût
          ▼
     RÉPONSE ENVOYÉE
```

## ÉTAPE 1 : TRIAGE (classifier.ts)

Pas besoin d'IA pour classifier. Des règles simples suffisent :

```typescript
function classify(message: string, hasImage: boolean, hasFile: boolean): Level {
  const lower = message.toLowerCase()
  const wordCount = message.split(' ').length

  // CRITIQUE — toujours Claude Opus
  if (lower.includes('self_modify') || lower.includes('modifie ton code'))
    return 'critical'
  if (lower.includes('urgent') || lower.includes('critique'))
    return 'critical'
  if (hasImage && wordCount > 20) // Image + question complexe
    return 'critical'

  // COMPLEXE — Claude Sonnet
  if (wordCount > 100) return 'complex'
  if (lower.includes('analyse') || lower.includes('stratégie'))
    return 'complex'
  if (lower.includes('écris un') || lower.includes('rédige'))
    return 'complex'
  if (lower.includes('compare') || lower.includes('explique'))
    return 'complex'
  if (hasFile) return 'complex'

  // MOYEN — DeepSeek via OpenRouter
  if (wordCount > 30) return 'medium'
  if (lower.includes('cherche') || lower.includes('recherche'))
    return 'medium'
  if (lower.includes('résume') || lower.includes('traduis'))
    return 'medium'

  // SIMPLE — Qwen local (gratuit)
  return 'simple'
}
```

**Coût de cette étape : 0€**

## ÉTAPE 2 : ENRICHMENT (context-builder.ts)

C'est LE secret. Avant d'appeler le LLM, on construit un contexte riche
avec du code pur (lecture de fichiers, requêtes DB, fetch API).

```typescript
async function buildContext(message: string, chatId: string): Promise<string> {
  // Tout ça c'est du code, 0 token

  // 1. Mémoire — qui est Omar, ses préférences, son business
  const memory = readFileSync('/root/.openclaw/MEMORY.md', 'utf-8')

  // 2. Conversations récentes — les 5 derniers échanges
  const history = loadHistory(chatId).slice(-5)

  // 3. État actuel — survival, missions, revenus
  const survival = await fetch('http://localhost:4000/api/survival').then(r => r.json())
  const missions = await fetch('http://localhost:4000/api/missions').then(r => r.json())

  // 4. Date et heure de Paris
  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })

  // 5. Recherche dans la mémoire si le message fait référence à quelque chose
  const keywords = extractKeywords(message)
  const relevantMemories = searchMemory(keywords)

  // 6. Contexte métier si pertinent
  const businessContext = isBusinessRelated(message)
    ? readFileSync('/root/maestro/BUSINESS.md', 'utf-8')
    : ''

  return `
CONTEXTE SYSTÈME:
- Date/heure: ${now}
- Score vital: ${survival.score}/100
- Missions actives: ${missions.length}

MÉMOIRE PERTINENTE:
${relevantMemories}

HISTORIQUE RÉCENT:
${history.map(h => `${h.role}: ${h.content}`).join('\n')}

${businessContext}

PERSONNALITÉ:
Tu es Redexes/Maestro, l'IA personnelle d'Omar. Tu tutoies Omar.
Tu es direct, chaleureux, tu vas droit au but. Pas de blabla corporate.
Tu agis, tu ne proposes pas. Tu es son bras droit.
`
}
```

**Coût de cette étape : 0€**
**Impact : un modèle à 0.001€ avec ce contexte vaut un modèle à 0.03€ sans**

## ÉTAPE 3 : ROUTING (model-router.ts)

```
┌──────────┬──────────────────────┬──────────────┬──────────────┐
│ Niveau   │ Modèle               │ Coût/appel   │ Quand        │
├──────────┼──────────────────────┼──────────────┼──────────────┤
│ SIMPLE   │ Ollama qwen2.5:14b   │ 0€           │ 60% des msg  │
│          │ (local, illimité)    │              │ salut, status│
│          │                      │              │ oui/non, etc │
├──────────┼──────────────────────┼──────────────┼──────────────┤
│ MOYEN    │ DeepSeek V3.2        │ ~0.001€      │ 25% des msg  │
│          │ via OpenRouter       │              │ recherche,   │
│          │                      │              │ résumés,     │
│          │                      │              │ sous-agents  │
├──────────┼──────────────────────┼──────────────┼──────────────┤
│ COMPLEXE │ Claude Sonnet 4      │ ~0.015€      │ 12% des msg  │
│          │ via API Anthropic    │              │ analyse,     │
│          │                      │              │ rédaction,   │
│          │                      │              │ stratégie    │
├──────────┼──────────────────────┼──────────────┼──────────────┤
│ CRITIQUE │ Claude Opus 4.6      │ ~0.05€       │ 3% des msg   │
│          │ via API Anthropic    │              │ self-modify, │
│          │ OU Claude Code (Max) │ 0€           │ architecture │
│          │                      │              │ décisions    │
└──────────┴──────────────────────┴──────────────┴──────────────┘
```

**FALLBACK CASCADE** (si un modèle échoue) :

```
Qwen local → DeepSeek → Gemini Flash → Claude Sonnet → Claude Opus
     0€        0.001€      0.002€         0.015€         0.05€
```

## ÉTAPE 5 : POST-PROCESS (post-process.ts)

Après chaque réponse, du code gratuit qui :

1. **Sauvegarde en mémoire** — extrait les faits importants de la conversation
   et les ajoute au fichier mémoire (comme LEARNINGS.md mais automatique)

2. **Met à jour les missions** — si la conversation a créé/modifié une mission

3. **Log le coût** — enregistre quel modèle a été utilisé et combien ça a coûté

4. **Vérifie la qualité** — si la réponse est trop courte ou incohérente,
   escalade vers un modèle supérieur (re-try automatique)

```typescript
async function postProcess(response: string, model: string, message: string) {
  // Log coût
  const cost = MODEL_COSTS[model] || 0
  appendFileSync('/root/maestro/costs.log',
    `${new Date().toISOString()} | ${model} | ${cost}€ | ${message.slice(0,50)}\n`)

  // Extraction mémoire automatique (code pur, regex)
  const facts = extractFacts(message, response)
  if (facts.length > 0) {
    appendFileSync('/root/.openclaw/MEMORY.md',
      `\n## ${new Date().toLocaleDateString('fr-FR')}\n${facts.join('\n')}`)
  }

  // Qualité check
  if (response.length < 20 && message.length > 50) {
    return { retry: true, escalate: true } // réponse trop courte, monter d'un niveau
  }

  return { retry: false }
}
```

## PROJECTION DE COÛTS MENSUELS

Hypothèse : Omar envoie 50 messages/jour sur Telegram + 20 tâches auto/jour

```
Messages quotidiens Omar:
  30 simples × 0€ (Qwen)           =   0€
  12 moyens  × 0.001€ (DeepSeek)   = 0.012€
   6 complexes × 0.015€ (Sonnet)   = 0.09€
   2 critiques × 0.05€ (Opus)      = 0.10€
                                    --------
                        Total/jour  = 0.20€

Tâches automatiques quotidiennes:
  144 heartbeats (toutes 10min)     =   0€ (code pur)
  6 crons (email, monday, etc)      =   0€ (code pur)
  3 crons qui appellent LLM         × 0.001€ = 0.003€
  1 briefing matin                  × 0.015€ = 0.015€
                                    --------
                        Total/jour  = 0.018€

TOTAL MENSUEL : (0.20 + 0.018) × 30 = 6.54€/mois
```

Avec les 25€ d'OpenRouter + les crédits Anthropic → **~4 mois d'autonomie**.

## MÉMOIRE : LE CERVEAU LONG TERME

Trois niveaux de mémoire, tous gratuits (fichiers sur disque) :

```
┌─────────────────────────────────────────────────┐
│  NIVEAU 1 : Mémoire de travail (RAM)            │
│  = Historique de conversation en cours           │
│  = Map<chatId, messages[]> + sauvegarde JSON     │
│  Durée : tant que la conversation dure           │
│  Coût : 0€                                       │
├─────────────────────────────────────────────────┤
│  NIVEAU 2 : Mémoire épisodique (fichiers)       │
│  = MEMORY.md — faits sur Omar, son business     │
│  = LEARNINGS.md — ce que l'IA a appris          │
│  = daily-notes/ — résumé de chaque journée      │
│  Durée : permanente                              │
│  Coût : 0€                                       │
│  Injection : context-builder lit ces fichiers    │
│  et injecte les parties pertinentes              │
├─────────────────────────────────────────────────┤
│  NIVEAU 3 : Mémoire sémantique (DB)             │
│  = Neon PostgreSQL — knowledge engine            │
│  = Recherche par mots-clés dans les souvenirs   │
│  Durée : permanente                              │
│  Coût : 0€ (Neon free tier)                      │
│  Injection : si le message matche un souvenir,   │
│  il est ajouté au contexte                       │
└─────────────────────────────────────────────────┘
```

## LE "WOW EFFECT" SANS LE COÛT

Le wow d'Opus vient de 3 choses :
1. Il a beaucoup de contexte → ON LE REPRODUIT avec l'enrichment
2. Il réfléchit longtemps → ON LE SIMULE avec du chain-of-thought forcé
3. Il prend des initiatives → ON LE CODE dans les crons

Technique pour forcer le "wow" sur Qwen :
- Ajouter dans le system prompt : "Réfléchis étape par étape avant de répondre"
- Ajouter : "Sois proactif — si tu vois une opportunité d'aider, propose-la"
- Ajouter : "Donne des réponses complètes, pas des réponses minimales"

Le contexte pré-mâché + ces instructions = 80% du wow à 0€.

## IMPLÉMENTATION

Fichiers à créer sur le serveur :

```
/root/maestro/server/src/intelligence/
  ├── classifier.ts    — Triage des messages (code pur)
  ├── context-builder.ts — Enrichissement du contexte (code pur)
  ├── model-router.ts  — Routing vers le bon modèle
  ├── llm-caller.ts    — Appel unifié à tous les providers
  ├── post-process.ts  — Mémoire, logging, qualité
  └── index.ts         — Pipeline complet
```

Le pipeline s'intègre dans :
- telegram.ts → remplace l'appel direct à Anthropic par le pipeline
- Le chat web (/api/chat) → même pipeline

UN SEUL CHEMIN pour tous les messages = cohérence totale.
