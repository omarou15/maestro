/**
 * INTELLIGENCE PIPELINE - ÉTAPE 1: TRIAGE
 * Classifie les messages sans utiliser d'IA (code pur, 0€)
 * 
 * Blueprint: INTELLIGENCE_SCHEMA_OPUS.pdf
 * Created: 2026-03-10
 */

export type MessageLevel = 'simple' | 'medium' | 'complex' | 'critical'

export interface ClassificationResult {
  level: MessageLevel
  reason: string
  confidence: number
}

/**
 * Classifie un message entrant selon sa complexité
 * @param message - Le texte du message
 * @param hasImage - Si le message contient une image
 * @param hasFile - Si le message contient un fichier
 * @returns Le niveau de classification et la raison
 */
export function classify(
  message: string,
  hasImage: boolean = false,
  hasFile: boolean = false
): ClassificationResult {
  const lower = message.toLowerCase()
  const wordCount = message.split(/\s+/).length

  // NIVEAU CRITIQUE - Toujours Claude Opus ou Claude Code
  if (lower.includes('self_modify') || lower.includes('modifie ton code')) {
    return {
      level: 'critical',
      reason: 'Self-modification requested',
      confidence: 1.0
    }
  }

  if (lower.includes('urgent') || lower.includes('critique')) {
    return {
      level: 'critical',
      reason: 'Urgent/critical keywords detected',
      confidence: 0.95
    }
  }

  if (hasImage && wordCount > 20) {
    return {
      level: 'critical',
      reason: 'Image with complex question',
      confidence: 0.9
    }
  }

  // NIVEAU COMPLEXE - Claude Sonnet
  if (wordCount > 100) {
    return {
      level: 'complex',
      reason: 'Long message (>100 words)',
      confidence: 0.85
    }
  }

  const complexKeywords = [
    'analyse', 'analyser', 'strategy', 'stratégie',
    'écris un', 'rédige', 'write a', 'draft',
    'compare', 'comparer', 'explain', 'explique',
    'plan', 'planifie', 'design', 'conçois',
    'architecture', 'implement', 'implémente'
  ]

  if (complexKeywords.some(kw => lower.includes(kw))) {
    return {
      level: 'complex',
      reason: 'Complex reasoning keywords detected',
      confidence: 0.8
    }
  }

  if (hasFile) {
    return {
      level: 'complex',
      reason: 'File attachment requires analysis',
      confidence: 0.85
    }
  }

  // NIVEAU MOYEN - DeepSeek via OpenRouter
  if (wordCount > 30) {
    return {
      level: 'medium',
      reason: 'Medium-length message',
      confidence: 0.7
    }
  }

  const mediumKeywords = [
    'cherche', 'recherche', 'search', 'find',
    'résume', 'summarize', 'traduis', 'translate',
    'liste', 'list', 'montre', 'show'
  ]

  if (mediumKeywords.some(kw => lower.includes(kw))) {
    return {
      level: 'medium',
      reason: 'Medium complexity task',
      confidence: 0.75
    }
  }

  // NIVEAU SIMPLE - Qwen local (gratuit)
  return {
    level: 'simple',
    reason: 'Simple/short message',
    confidence: 0.6
  }
}

/**
 * Stats pour monitoring
 */
export function getClassificationStats() {
  // TODO: Implement stats from logs
  return {
    simple: 0,
    medium: 0,
    complex: 0,
    critical: 0
  }
}
