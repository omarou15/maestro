/**
 * INTELLIGENCE PIPELINE - ORCHESTRATION COMPLÈTE
 * 
 * Le système parfait d'Opus 4.6:
 * - 4 étapes gratuites (0€)
 * - 1 étape payante (LLM call)
 * - Coût mensuel: ~6.54€ au lieu de 22.5€
 * - Économie: 73%
 * 
 * Blueprint: INTELLIGENCE_SCHEMA_OPUS.pdf
 * Date: 2026-03-10
 */

import { classify, type MessageLevel } from './classifier'
import { buildContext } from './context-builder'
import { routeToModel, getNextFallback, type ModelConfig } from './model-router'
import { callLLM, callWithRetry, type LLMResponse } from './llm-caller'
import { postProcess } from './post-process'

export interface ProcessMessageOptions {
  chatId: string
  message: string
  hasImage?: boolean
  hasFile?: boolean
  forceLevel?: MessageLevel
}

export interface ProcessMessageResult {
  response: string
  level: MessageLevel
  model: string
  cost: number
  latencyMs: number
  retries: number
}

/**
 * PIPELINE COMPLET - Point d'entrée principal
 * 
 * Traite un message en 5 étapes:
 * 1. Triage (gratuit)
 * 2. Enrichment (gratuit)
 * 3. Routing (gratuit)
 * 4. LLM Call (payant)
 * 5. Post-process (gratuit)
 * 
 * @param options - Configuration du message à traiter
 * @returns Résultat complet du traitement
 */
export async function processMessage(
  options: ProcessMessageOptions
): Promise<ProcessMessageResult> {
  const startTime = Date.now()
  let retries = 0

  console.log(`[PIPELINE] Processing message for chat ${options.chatId}`)

  // ==========================================
  // ÉTAPE 1: TRIAGE (0€, 0 tokens)
  // ==========================================
  const classification = classify(
    options.message,
    options.hasImage || false,
    options.hasFile || false
  )
  
  const level = options.forceLevel || classification.level
  
  console.log(`[PIPELINE] Classification: ${level} (${classification.reason})`)

  // ==========================================
  // ÉTAPE 2: ENRICHMENT (0€, 0 tokens)
  // ==========================================
  console.log(`[PIPELINE] Building context...`)
  const enrichedContext = await buildContext(options.message, options.chatId)
  
  console.log(`[PIPELINE] Context built (${enrichedContext.length} chars)`)

  // ==========================================
  // ÉTAPE 3: ROUTING (0€, 0 tokens)
  // ==========================================
  let modelConfig = routeToModel(level)
  
  console.log(`[PIPELINE] Routed to: ${modelConfig.name} (${modelConfig.costPer1K}€/1k tokens)`)

  // ==========================================
  // ÉTAPE 4: LLM CALL (SEULE ÉTAPE PAYANTE)
  // ==========================================
  let llmResponse: LLMResponse
  
  try {
    llmResponse = await callWithRetry(modelConfig, enrichedContext, options.message)
    console.log(`[PIPELINE] LLM response received (${llmResponse.content.length} chars, ${llmResponse.cost.toFixed(6)}€)`)
  } catch (error) {
    console.error(`[PIPELINE] Error with ${modelConfig.name}, trying fallback...`)
    
    // Tenter fallback
    const fallbackConfig = getNextFallback(level)
    if (fallbackConfig) {
      retries++
      console.log(`[PIPELINE] Fallback to: ${fallbackConfig.name}`)
      llmResponse = await callWithRetry(fallbackConfig, enrichedContext, options.message)
      modelConfig = fallbackConfig
    } else {
      throw new Error('All models failed, no fallback available')
    }
  }

  // ==========================================
  // ÉTAPE 5: POST-PROCESS (0€, 0 tokens)
  // ==========================================
  console.log(`[PIPELINE] Post-processing...`)
  const postProcessResult = await postProcess(
    llmResponse,
    options.message,
    options.chatId
  )

  // Si quality check demande retry avec escalation
  if (postProcessResult.shouldEscalate && !options.forceLevel) {
    console.log(`[PIPELINE] Quality check failed, escalating...`)
    const fallbackConfig = getNextFallback(level)
    
    if (fallbackConfig) {
      retries++
      return processMessage({
        ...options,
        forceLevel: level === 'simple' ? 'medium' : 
                   level === 'medium' ? 'complex' : 'critical'
      })
    }
  }

  const totalLatency = Date.now() - startTime

  console.log(`[PIPELINE] Complete in ${totalLatency}ms (${retries} retries)`)
  console.log(`[PIPELINE] Memory saved: ${postProcessResult.memorySaved}`)
  console.log(`[PIPELINE] Cost logged: ${postProcessResult.costLogged}`)

  return {
    response: llmResponse.content,
    level,
    model: modelConfig.name,
    cost: llmResponse.cost,
    latencyMs: totalLatency,
    retries
  }
}

/**
 * Version simplifiée pour messages rapides
 */
export async function processSimpleMessage(
  message: string,
  chatId: string
): Promise<string> {
  const result = await processMessage({ message, chatId })
  return result.response
}

/**
 * Stats globales du pipeline
 */
export async function getPipelineStats() {
  // TODO: Aggregate from all modules
  return {
    classification: {
      simple: 0,
      medium: 0,
      complex: 0,
      critical: 0
    },
    costs: {
      total: 0,
      today: 0,
      thisMonth: 0
    },
    performance: {
      averageLatency: 0,
      totalRequests: 0,
      failureRate: 0
    }
  }
}

/**
 * Export tous les modules pour usage avancé
 */
export {
  classify,
  buildContext,
  routeToModel,
  callLLM,
  postProcess
}

export type {
  MessageLevel,
  ModelConfig,
  LLMResponse
}
