/**
 * INTELLIGENCE PIPELINE - ÉTAPE 3: ROUTING
 * Route vers le modèle optimal selon le niveau (code pur, 0€)
 * 
 * Blueprint: INTELLIGENCE_SCHEMA_OPUS.pdf
 */

import type { MessageLevel } from './classifier'

export interface ModelConfig {
  name: string
  provider: 'ollama' | 'openrouter' | 'anthropic' | 'claude-code'
  model: string
  costPer1K: number
  endpoint?: string
  maxTokens?: number
}

/**
 * Configuration des modèles par niveau
 */
const MODEL_CONFIGS: Record<MessageLevel, ModelConfig> = {
  simple: {
    name: 'Qwen Local',
    provider: 'ollama',
    model: 'qwen2.5:14b',
    costPer1K: 0,
    endpoint: 'http://localhost:11434',
    maxTokens: 2000
  },
  
  medium: {
    name: 'DeepSeek V3.2',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    costPer1K: 0.001,
    endpoint: 'https://openrouter.ai/api/v1',
    maxTokens: 4000
  },
  
  complex: {
    name: 'Claude Sonnet 4',
    provider: 'openrouter',
    model: 'anthropic/claude-3.5-sonnet',
    costPer1K: 0.015,
    endpoint: 'https://openrouter.ai/api/v1',
    maxTokens: 8000
  },
  
  critical: {
    name: 'Claude Opus 4',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4',
    costPer1K: 0.05,
    endpoint: 'https://openrouter.ai/api/v1',
    maxTokens: 8000
  }
}

/**
 * Cascade de fallback si un modèle échoue
 */
const FALLBACK_CASCADE: MessageLevel[] = ['simple', 'medium', 'complex', 'critical']

/**
 * Route vers le modèle optimal
 * @param level - Niveau de complexité du message
 * @param attempt - Numéro de tentative (pour fallback)
 * @returns Configuration du modèle à utiliser
 */
export function routeToModel(
  level: MessageLevel,
  attempt: number = 0
): ModelConfig {
  // Si tentative de fallback
  if (attempt > 0) {
    const currentIndex = FALLBACK_CASCADE.indexOf(level)
    const fallbackIndex = Math.min(currentIndex + attempt, FALLBACK_CASCADE.length - 1)
    const fallbackLevel = FALLBACK_CASCADE[fallbackIndex]
    
    console.log(`[ROUTER] Fallback attempt ${attempt}: ${level} -> ${fallbackLevel}`)
    return MODEL_CONFIGS[fallbackLevel]
  }

  return MODEL_CONFIGS[level]
}

/**
 * Obtient le modèle suivant dans la cascade de fallback
 */
export function getNextFallback(currentLevel: MessageLevel): ModelConfig | null {
  const currentIndex = FALLBACK_CASCADE.indexOf(currentLevel)
  
  if (currentIndex >= FALLBACK_CASCADE.length - 1) {
    return null // Plus de fallback disponible
  }

  const nextLevel = FALLBACK_CASCADE[currentIndex + 1]
  return MODEL_CONFIGS[nextLevel]
}

/**
 * Coûts estimés pour statistiques
 */
export const MODEL_COSTS: Record<string, number> = {
  'qwen2.5:14b': 0,
  'deepseek/deepseek-chat': 0.001,
  'google/gemini-flash-1.5': 0.002,
  'anthropic/claude-3.5-sonnet': 0.015,
  'anthropic/claude-opus-4': 0.05
}

/**
 * Estime le coût d'un appel
 */
export function estimateCost(modelConfig: ModelConfig, estimatedTokens: number = 2000): number {
  return (estimatedTokens / 1000) * modelConfig.costPer1K
}

/**
 * Stats de distribution des modèles (pour monitoring)
 */
export function getRoutingStats() {
  // TODO: Implement from logs
  return {
    simple: { count: 0, cost: 0 },
    medium: { count: 0, cost: 0 },
    complex: { count: 0, cost: 0 },
    critical: { count: 0, cost: 0 }
  }
}
