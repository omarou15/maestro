/**
 * OpenRouter Configuration
 * Multi-model access via single API
 * 25€ credit → months of usage with cheap models
 */

export const OPENROUTER_CONFIG = {
  apiKey: process.env.OPENROUTER_API_KEY || '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',
  baseUrl: 'https://openrouter.ai/api/v1',
  
  models: {
    // Daily tasks, crons, classification (~€0.001/call)
    cheap: 'deepseek/deepseek-chat',
    
    // Sub-agents, research, web tasks (~€0.002/call)
    fast: 'google/gemini-flash-1.5',
    
    // Conversation with Omar (use Claude Max plan instead)
    // Only fallback if Claude Max unavailable
    conversation: 'anthropic/claude-3.5-sonnet',
    
    // Critical coding, self-modify (high quality)
    critical: 'anthropic/claude-opus-4',
  },
  
  pricing: {
    'deepseek/deepseek-chat': 0.001,        // €0.001 per call
    'google/gemini-flash-1.5': 0.002,       // €0.002 per call
    'anthropic/claude-3.5-sonnet': 0.015,   // €0.015 per call
    'anthropic/claude-opus-4': 0.600,       // €0.60 per call
  },
}

/**
 * Intelligent routing with OpenRouter
 */
export function routeToOpenRouter(taskType: string): string {
  switch (taskType) {
    case 'cron':
    case 'classification':
    case 'simple':
      return OPENROUTER_CONFIG.models.cheap // DeepSeek
    
    case 'research':
    case 'web-search':
    case 'subagent':
      return OPENROUTER_CONFIG.models.fast // Gemini Flash
    
    case 'coding':
    case 'self-modify':
      return OPENROUTER_CONFIG.models.critical // Opus
    
    case 'conversation':
      // Use Claude Max plan (free for Omar)
      // OpenRouter only as fallback
      return 'use-claude-max'
    
    default:
      return OPENROUTER_CONFIG.models.fast
  }
}

/**
 * Estimate cost for OpenRouter call
 */
export function estimateOpenRouterCost(model: string, estimatedTokens: number = 2000): number {
  const costPer1M = OPENROUTER_CONFIG.pricing[model] || 0.01
  return (estimatedTokens / 1_000_000) * costPer1M
}
