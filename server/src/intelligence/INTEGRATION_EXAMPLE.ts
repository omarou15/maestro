/**
 * EXEMPLE D'INTÉGRATION DU PIPELINE
 * Comment utiliser le pipeline intelligence dans telegram.ts ou l'API web
 */

import { processMessage, processSimpleMessage } from './index'

// ====================================
// EXEMPLE 1: Intégration Telegram Bot
// ====================================

async function handleTelegramMessage(
  message: string,
  chatId: string,
  hasImage: boolean = false
) {
  try {
    // Utiliser le pipeline complet
    const result = await processMessage({
      chatId,
      message,
      hasImage
    })

    console.log(`Réponse générée avec ${result.model} en ${result.latencyMs}ms pour ${result.cost.toFixed(6)}€`)
    
    // Envoyer la réponse sur Telegram
    return result.response
  } catch (error) {
    console.error('Error in pipeline:', error)
    return 'Désolé, une erreur est survenue.'
  }
}

// ====================================
// EXEMPLE 2: Intégration API Web (/api/chat)
// ====================================

async function handleWebChat(
  userMessage: string,
  sessionId: string
) {
  // Version simplifiée (retourne juste la réponse)
  const response = await processSimpleMessage(userMessage, sessionId)
  return response
}

// ====================================
// EXEMPLE 3: Message avec fichier
// ====================================

async function handleFileMessage(
  message: string,
  chatId: string,
  fileType: string
) {
  const result = await processMessage({
    chatId,
    message,
    hasFile: true // Sera classifié comme "complex" minimum
  })

  return result.response
}

// ====================================
// EXEMPLE 4: Forcer un niveau spécifique
// ====================================

async function handleCriticalMessage(
  message: string,
  chatId: string
) {
  // Force l'utilisation de Claude Opus
  const result = await processMessage({
    chatId,
    message,
    forceLevel: 'critical'
  })

  return result.response
}

// ====================================
// EXEMPLE 5: Stats et monitoring
// ====================================

import { getPipelineStats } from './index'

async function getSystemStats() {
  const stats = await getPipelineStats()
  
  return `
📊 Stats Pipeline Intelligence:

Classification:
- Simple: ${stats.classification.simple} (gratuit)
- Medium: ${stats.classification.medium} (~€0.001)
- Complex: ${stats.classification.complex} (~€0.015)
- Critical: ${stats.classification.critical} (~€0.05)

Coûts:
- Aujourd'hui: €${stats.costs.today.toFixed(4)}
- Ce mois: €${stats.costs.thisMonth.toFixed(4)}

Performance:
- Latence moyenne: ${stats.performance.averageLatency}ms
- Total requêtes: ${stats.performance.totalRequests}
- Taux d'échec: ${stats.performance.failureRate}%
`
}

export {
  handleTelegramMessage,
  handleWebChat,
  handleFileMessage,
  handleCriticalMessage,
  getSystemStats
}
