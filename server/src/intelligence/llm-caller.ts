/**
 * INTELLIGENCE PIPELINE - ÉTAPE 4: APPEL LLM
 * Seule étape qui coûte des tokens
 * Gère tous les providers de manière unifiée
 * 
 * Blueprint: INTELLIGENCE_SCHEMA_OPUS.pdf
 */

import type { ModelConfig } from './model-router'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface LLMResponse {
  content: string
  model: string
  tokensUsed: number
  cost: number
  latencyMs: number
}

/**
 * Appelle un LLM avec le contexte enrichi
 * @param config - Configuration du modèle
 * @param context - Contexte enrichi (de context-builder)
 * @param message - Message original de l'utilisateur
 * @returns Réponse du LLM
 */
export async function callLLM(
  config: ModelConfig,
  context: string,
  message: string
): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    let response: string
    let tokensUsed = 0

    switch (config.provider) {
      case 'ollama':
        response = await callOllama(config, context)
        break
      
      case 'openrouter':
        const orResult = await callOpenRouter(config, context)
        response = orResult.content
        tokensUsed = orResult.tokensUsed
        break
      
      case 'claude-code':
        response = await callClaudeCode(context)
        break
      
      case 'anthropic':
        response = await callAnthropic(config, context)
        break
      
      default:
        throw new Error(`Unknown provider: ${config.provider}`)
    }

    const latencyMs = Date.now() - startTime
    const cost = (tokensUsed / 1000) * config.costPer1K

    return {
      content: response,
      model: config.model,
      tokensUsed,
      cost,
      latencyMs
    }
  } catch (error) {
    console.error(`[LLM] Error calling ${config.name}:`, error)
    throw error
  }
}

/**
 * Appelle Ollama en local (gratuit)
 */
async function callOllama(config: ModelConfig, prompt: string): Promise<string> {
  const { stdout } = await execAsync(
    `ollama run ${config.model} "${prompt.replace(/"/g, '\\"')}"`,
    { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
  )
  
  return stdout.trim()
}

/**
 * Appelle OpenRouter API
 */
async function callOpenRouter(
  config: ModelConfig,
  prompt: string
): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable not set')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://maestro-chi.vercel.app',
      'X-Title': 'Redexes Intelligence Pipeline'
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: config.maxTokens || 4000,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  
  return {
    content: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0
  }
}

/**
 * Appelle Claude Code CLI (Max plan, gratuit mais rate-limited)
 */
async function callClaudeCode(prompt: string): Promise<string> {
  // Sauvegarde prompt dans fichier temporaire
  const { stdout } = await execAsync(
    `cd /root/maestro && claude -p "${prompt.replace(/"/g, '\\"')}" --print`
  )
  
  return stdout.trim()
}

/**
 * Appelle Anthropic API directement (backup)
 */
async function callAnthropic(config: ModelConfig, prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.content[0].text
}

/**
 * Retry avec fallback automatique
 */
export async function callWithRetry(
  config: ModelConfig,
  context: string,
  message: string,
  maxRetries: number = 3
): Promise<LLMResponse> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callLLM(config, context, message)
    } catch (error) {
      lastError = error as Error
      console.log(`[LLM] Retry ${attempt + 1}/${maxRetries} for ${config.name}`)
      
      // Attendre avant de retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  throw lastError || new Error('Max retries exceeded')
}
