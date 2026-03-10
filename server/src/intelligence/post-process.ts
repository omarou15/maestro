/**
 * INTELLIGENCE PIPELINE - ÉTAPE 5: POST-PROCESS
 * Sauvegarde mémoire, logging, quality check (code pur, 0€)
 * 
 * Blueprint: INTELLIGENCE_SCHEMA_OPUS.pdf
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { LLMResponse } from './llm-caller'

interface PostProcessResult {
  shouldRetry: boolean
  shouldEscalate: boolean
  memorySaved: boolean
  costLogged: boolean
}

/**
 * Post-traite une réponse LLM
 * @param response - Réponse du LLM
 * @param originalMessage - Message original de l'utilisateur
 * @param chatId - ID de la conversation
 * @returns Résultat du post-processing
 */
export async function postProcess(
  response: LLMResponse,
  originalMessage: string,
  chatId: string
): Promise<PostProcessResult> {
  const result: PostProcessResult = {
    shouldRetry: false,
    shouldEscalate: false,
    memorySaved: false,
    costLogged: false
  }

  // 1. LOG DU COÛT
  try {
    logCost(response, originalMessage)
    result.costLogged = true
  } catch (error) {
    console.error('[POST-PROCESS] Error logging cost:', error)
  }

  // 2. EXTRACTION MÉMOIRE AUTOMATIQUE
  try {
    const facts = extractFacts(originalMessage, response.content)
    if (facts.length > 0) {
      saveToMemory(facts)
      result.memorySaved = true
    }
  } catch (error) {
    console.error('[POST-PROCESS] Error saving memory:', error)
  }

  // 3. QUALITY CHECK
  const qualityCheck = checkQuality(response, originalMessage)
  result.shouldRetry = qualityCheck.shouldRetry
  result.shouldEscalate = qualityCheck.shouldEscalate

  // 4. SAUVEGARDE HISTORIQUE CONVERSATION
  try {
    await saveConversationHistory(chatId, originalMessage, response.content)
  } catch (error) {
    console.error('[POST-PROCESS] Error saving history:', error)
  }

  return result
}

/**
 * Log le coût d'un appel LLM
 */
function logCost(response: LLMResponse, message: string): void {
  const logDir = '/root/maestro/logs'
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }

  const logLine = [
    new Date().toISOString(),
    response.model,
    response.cost.toFixed(6),
    response.tokensUsed,
    response.latencyMs,
    message.substring(0, 50).replace(/\n/g, ' ')
  ].join(' | ')

  appendFileSync(
    join(logDir, 'costs.log'),
    logLine + '\n'
  )
}

/**
 * Extrait les faits importants d'une conversation
 */
function extractFacts(message: string, response: string): string[] {
  const facts: string[] = []
  const lower = message.toLowerCase()

  // Détection de décisions importantes
  if (lower.includes('décid') || lower.includes('choisi')) {
    facts.push(`DÉCISION: ${message.substring(0, 100)}`)
  }

  // Détection de nouvelles informations sur Omar
  if (lower.includes('j\'aime') || lower.includes('je préfère')) {
    facts.push(`PRÉFÉRENCE OMAR: ${message.substring(0, 100)}`)
  }

  // Détection de tâches/missions
  if (lower.includes('fais') || lower.includes('crée') || lower.includes('configure')) {
    facts.push(`TÂCHE: ${message.substring(0, 100)}`)
  }

  // Détection d'apprentissages importants dans la réponse
  if (response.includes('important') || response.includes('noter')) {
    const sentences = response.split(/[.!?]/)
    for (const sentence of sentences) {
      if (sentence.includes('important') || sentence.includes('noter')) {
        facts.push(`APPRENTISSAGE: ${sentence.trim().substring(0, 100)}`)
        break
      }
    }
  }

  return facts
}

/**
 * Sauvegarde dans MEMORY.md
 */
function saveToMemory(facts: string[]): void {
  const memoryPath = '/root/.openclaw/workspace/MEMORY.md'
  const date = new Date().toLocaleDateString('fr-FR')
  
  let memoryEntry = `\n## ${date}\n`
  facts.forEach(fact => {
    memoryEntry += `- ${fact}\n`
  })

  try {
    appendFileSync(memoryPath, memoryEntry)
  } catch (error) {
    // Si MEMORY.md n'existe pas, le créer
    const memoryDir = '/root/.openclaw/workspace'
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true })
    }
    appendFileSync(memoryPath, `# MEMORY\n${memoryEntry}`)
  }
}

/**
 * Vérifie la qualité de la réponse
 */
function checkQuality(
  response: LLMResponse,
  originalMessage: string
): { shouldRetry: boolean; shouldEscalate: boolean } {
  const responseLength = response.content.length
  const messageLength = originalMessage.length

  // Réponse trop courte pour un message long
  if (responseLength < 50 && messageLength > 100) {
    return {
      shouldRetry: true,
      shouldEscalate: true // Monter d'un niveau de modèle
    }
  }

  // Réponse générique/vide
  if (
    response.content.includes('Je ne peux pas') ||
    response.content.includes('Je ne sais pas') ||
    response.content.length < 20
  ) {
    return {
      shouldRetry: true,
      shouldEscalate: false
    }
  }

  return {
    shouldRetry: false,
    shouldEscalate: false
  }
}

/**
 * Sauvegarde l'historique de conversation
 */
async function saveConversationHistory(
  chatId: string,
  message: string,
  response: string
): Promise<void> {
  const historyDir = '/root/maestro/conversation-history'
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true })
  }

  const historyFile = join(historyDir, `${chatId}.jsonl`)
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    role: 'user',
    content: message
  }) + '\n' + JSON.stringify({
    timestamp: new Date().toISOString(),
    role: 'assistant',
    content: response
  }) + '\n'

  appendFileSync(historyFile, entry)
}

/**
 * Stats de qualité (pour monitoring)
 */
export function getQualityStats() {
  // TODO: Implement from logs
  return {
    totalResponses: 0,
    retriesNeeded: 0,
    escalationsNeeded: 0,
    averageQuality: 0
  }
}
