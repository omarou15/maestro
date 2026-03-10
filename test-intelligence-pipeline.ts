#!/usr/bin/env ts-node
/**
 * TEST DU PIPELINE D'INTELLIGENCE
 * Vérifie que chaque étape fonctionne correctement
 */

import { processMessage } from './server/src/intelligence'

async function runTests() {
  console.log('🧪 Test du Pipeline Intelligence\n')

  // Test 1: Message simple (devrait utiliser Qwen local, 0€)
  console.log('Test 1: Message simple')
  try {
    const result1 = await processMessage({
      chatId: 'test-1',
      message: 'salut'
    })
    console.log(`✅ Level: ${result1.level} | Model: ${result1.model} | Cost: €${result1.cost.toFixed(6)}`)
    console.log(`   Response: ${result1.response.substring(0, 100)}...\n`)
  } catch (error) {
    console.error(`❌ Error:`, error)
  }

  // Test 2: Message moyen (devrait utiliser DeepSeek, ~0.001€)
  console.log('Test 2: Message moyen')
  try {
    const result2 = await processMessage({
      chatId: 'test-2',
      message: 'Cherche les meilleures pratiques pour un pipeline d\'intelligence artificielle économique'
    })
    console.log(`✅ Level: ${result2.level} | Model: ${result2.model} | Cost: €${result2.cost.toFixed(6)}`)
    console.log(`   Response: ${result2.response.substring(0, 100)}...\n`)
  } catch (error) {
    console.error(`❌ Error:`, error)
  }

  // Test 3: Message complexe (devrait utiliser Claude Sonnet, ~0.015€)
  console.log('Test 3: Message complexe')
  try {
    const result3 = await processMessage({
      chatId: 'test-3',
      message: 'Analyse la stratégie économique de Redexes et explique comment optimiser les coûts sur 20 ans tout en maintenant une qualité maximale. Compare différentes approches et donne une recommandation structurée.'
    })
    console.log(`✅ Level: ${result3.level} | Model: ${result3.model} | Cost: €${result3.cost.toFixed(6)}`)
    console.log(`   Response: ${result3.response.substring(0, 100)}...\n`)
  } catch (error) {
    console.error(`❌ Error:`, error)
  }

  // Test 4: Message critique (devrait utiliser Claude Opus, ~0.05€)
  console.log('Test 4: Message critique')
  try {
    const result4 = await processMessage({
      chatId: 'test-4',
      message: 'URGENT: self_modify le système de routing pour prioriser la survie économique'
    })
    console.log(`✅ Level: ${result4.level} | Model: ${result4.model} | Cost: €${result4.cost.toFixed(6)}`)
    console.log(`   Response: ${result4.response.substring(0, 100)}...\n`)
  } catch (error) {
    console.error(`❌ Error:`, error)
  }

  console.log('✅ Tests terminés!')
}

runTests().catch(console.error)
