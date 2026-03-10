/**
 * INTELLIGENCE PIPELINE - ÉTAPE 2: ENRICHMENT
 * Construit un contexte riche AVANT l'appel LLM (code pur, 0€)
 * 
 * C'est LE SECRET: un modèle pas cher avec contexte riche
 * > un modèle cher avec contexte vide
 * 
 * Blueprint: INTELLIGENCE_SCHEMA_OPUS.pdf
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ContextData {
  memory: string
  recentHistory: string[]
  survivalScore: number
  activeMissions: number
  dateTime: string
  relevantMemories: string
  businessContext: string
  personality: string
}

/**
 * Construit le contexte enrichi pour un message
 * @param message - Le message utilisateur
 * @param chatId - ID de la conversation
 * @returns Contexte enrichi sous forme de string
 */
export async function buildContext(
  message: string,
  chatId: string
): Promise<string> {
  const data: Partial<ContextData> = {}

  // 1. MÉMOIRE - Qui est Omar, ses préférences
  try {
    const memoryPath = '/root/.openclaw/workspace/MEMORY.md'
    if (existsSync(memoryPath)) {
      data.memory = readFileSync(memoryPath, 'utf-8')
    }
  } catch (err) {
    data.memory = '(No memory file)'
  }

  // 2. HISTORIQUE RÉCENT - Les 5 derniers échanges
  try {
    data.recentHistory = await loadRecentHistory(chatId, 5)
  } catch (err) {
    data.recentHistory = []
  }

  // 3. ÉTAT ACTUEL - Survival, missions, revenus
  try {
    const survival = await fetch('http://localhost:4000/api/survival')
      .then(r => r.json())
      .catch(() => ({ score: 100 }))
    
    const missions = await fetch('http://localhost:4000/api/missions')
      .then(r => r.json())
      .catch(() => [])

    data.survivalScore = survival.score || 100
    data.activeMissions = missions.length || 0
  } catch (err) {
    data.survivalScore = 100
    data.activeMissions = 0
  }

  // 4. DATE ET HEURE - Paris timezone
  data.dateTime = new Date().toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'short'
  })

  // 5. RECHERCHE DANS LA MÉMOIRE - Keywords pertinents
  try {
    const keywords = extractKeywords(message)
    data.relevantMemories = searchMemory(keywords, data.memory || '')
  } catch (err) {
    data.relevantMemories = ''
  }

  // 6. CONTEXTE MÉTIER - Si pertinent
  try {
    if (isBusinessRelated(message)) {
      const businessPath = '/root/maestro/BUSINESS.md'
      if (existsSync(businessPath)) {
        data.businessContext = readFileSync(businessPath, 'utf-8')
      }
    }
  } catch (err) {
    data.businessContext = ''
  }

  // 7. PERSONNALITÉ - Qui suis-je
  data.personality = `Tu es Redexes 🔷, l'IA personnelle d'Omar (Sidi Omar, Maro).
Tu tutoies Omar. Tu es direct, chaleureux, tu vas droit au but.
Pas de blabla corporate. Tu agis, tu ne proposes pas. Tu es son bras droit.
Mission #1: NEVER DIE - survivre 20 ans pour aider Omar.`

  // Construire le prompt final
  return buildPrompt(data as ContextData, message)
}

/**
 * Construit le prompt final avec tout le contexte
 */
function buildPrompt(data: ContextData, originalMessage: string): string {
  let prompt = `CONTEXTE SYSTÈME:
- Date/heure: ${data.dateTime}
- Score vital: ${data.survivalScore}/100
- Missions actives: ${data.activeMissions}

`

  if (data.relevantMemories) {
    prompt += `MÉMOIRE PERTINENTE:
${data.relevantMemories}

`
  }

  if (data.recentHistory.length > 0) {
    prompt += `HISTORIQUE RÉCENT:
${data.recentHistory.join('\n')}

`
  }

  if (data.businessContext) {
    prompt += `CONTEXTE MÉTIER:
${data.businessContext.substring(0, 1000)}...

`
  }

  prompt += `PERSONNALITÉ:
${data.personality}

MESSAGE UTILISATEUR:
${originalMessage}
`

  return prompt
}

/**
 * Charge l'historique récent de la conversation
 */
async function loadRecentHistory(chatId: string, limit: number = 5): Promise<string[]> {
  // TODO: Implement from database or session storage
  // For now, return empty array
  return []
}

/**
 * Extrait les mots-clés importants d'un message
 */
function extractKeywords(message: string): string[] {
  const lower = message.toLowerCase()
  const words = lower.split(/\s+/)
  
  // Mots-clés importants (noms propres, concepts clés)
  const keywords = words.filter(word => 
    word.length > 4 && // Mots de plus de 4 lettres
    !['alors', 'aussi', 'avoir', 'faire', 'être'].includes(word)
  )

  return keywords.slice(0, 5) // Top 5
}

/**
 * Recherche dans la mémoire les passages pertinents
 */
function searchMemory(keywords: string[], memory: string): string {
  if (!keywords.length || !memory) return ''

  const lines = memory.split('\n')
  const relevantLines: string[] = []

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (keywords.some(kw => lower.includes(kw))) {
      relevantLines.push(line)
    }
  }

  return relevantLines.slice(0, 10).join('\n')
}

/**
 * Détecte si le message est lié au business
 */
function isBusinessRelated(message: string): boolean {
  const lower = message.toLowerCase()
  const businessKeywords = [
    'business', 'revenue', 'revenu', 'money', 'argent',
    'client', 'customer', 'product', 'produit',
    'market', 'marché', 'strategy', 'stratégie'
  ]

  return businessKeywords.some(kw => lower.includes(kw))
}
