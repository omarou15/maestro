/**
 * Intelligent Model Routing
 * Routes tasks to appropriate models based on complexity and cost
 */

export type ModelTier = 'claude-code' | 'haiku' | 'sonnet' | 'opus' | 'gpt4'

export interface TaskClassification {
  complexity: 'simple' | 'moderate' | 'complex'
  category: 'coding' | 'conversation' | 'reasoning' | 'quick'
  estimatedTokens: number
}

export interface ModelConfig {
  tier: ModelTier
  costPer1M: number // EUR per 1M tokens
  capabilities: string[]
}

// Model configurations
export const MODELS: Record<ModelTier, ModelConfig> = {
  'claude-code': {
    tier: 'claude-code',
    costPer1M: 0, // Free via Claude Max plan
    capabilities: ['coding', 'debugging', 'file-ops', 'git', 'repository'],
  },
  'haiku': {
    tier: 'haiku',
    costPer1M: 1,
    capabilities: ['quick-response', 'status-check', 'simple-query', 'formatting'],
  },
  'sonnet': {
    tier: 'sonnet',
    costPer1M: 15,
    capabilities: ['conversation', 'tool-use', 'documentation', 'general', 'web-search'],
  },
  'opus': {
    tier: 'opus',
    costPer1M: 75,
    capabilities: ['complex-reasoning', 'architecture', 'planning', 'philosophy', 'creative'],
  },
  'gpt4': {
    tier: 'gpt4',
    costPer1M: 30,
    capabilities: ['fallback', 'backup', 'general'],
  },
}

/**
 * Classify a task based on its characteristics
 */
export function classifyTask(prompt: string, context?: any): TaskClassification {
  const lower = prompt.toLowerCase()
  
  // Coding tasks
  if (
    lower.includes('code') ||
    lower.includes('debug') ||
    lower.includes('fix') ||
    lower.includes('error') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('file') ||
    lower.includes('git') ||
    lower.includes('commit') ||
    lower.includes('build')
  ) {
    return {
      complexity: 'moderate',
      category: 'coding',
      estimatedTokens: 4000,
    }
  }
  
  // Quick tasks
  if (
    lower.includes('status') ||
    lower.includes('check') ||
    lower.includes('ping') ||
    lower.includes('health') ||
    lower.includes('yes') ||
    lower.includes('no') ||
    prompt.length < 50
  ) {
    return {
      complexity: 'simple',
      category: 'quick',
      estimatedTokens: 500,
    }
  }
  
  // Complex reasoning tasks
  if (
    lower.includes('philosophy') ||
    lower.includes('explain') ||
    lower.includes('why') ||
    lower.includes('architecture') ||
    lower.includes('design') ||
    lower.includes('strategy') ||
    lower.includes('plan') ||
    prompt.length > 500
  ) {
    return {
      complexity: 'complex',
      category: 'reasoning',
      estimatedTokens: 8000,
    }
  }
  
  // Default: moderate conversation
  return {
    complexity: 'moderate',
    category: 'conversation',
    estimatedTokens: 2000,
  }
}

/**
 * Route a task to the appropriate model
 */
export function routeToModel(classification: TaskClassification): ModelTier {
  // Claude Code for coding tasks (FREE)
  if (classification.category === 'coding') {
    return 'claude-code'
  }
  
  // Haiku for quick tasks (CHEAP)
  if (classification.category === 'quick' || classification.complexity === 'simple') {
    return 'haiku'
  }
  
  // Opus for complex reasoning (EXPENSIVE but worth it)
  if (classification.complexity === 'complex' || classification.category === 'reasoning') {
    return 'opus'
  }
  
  // Sonnet for everything else (BALANCED)
  return 'sonnet'
}

/**
 * Estimate cost for a task
 */
export function estimateCost(classification: TaskClassification, model: ModelTier): number {
  const config = MODELS[model]
  const costPerToken = config.costPer1M / 1_000_000
  return classification.estimatedTokens * costPerToken
}

/**
 * Smart routing: classify task → select model → estimate cost
 */
export function smartRoute(prompt: string, context?: any): {
  model: ModelTier
  classification: TaskClassification
  estimatedCost: number
  reason: string
} {
  const classification = classifyTask(prompt, context)
  const model = routeToModel(classification)
  const estimatedCost = estimateCost(classification, model)
  
  let reason = ''
  switch (model) {
    case 'claude-code':
      reason = 'Coding task → Claude Code (free)'
      break
    case 'haiku':
      reason = 'Simple task → Haiku (€' + estimatedCost.toFixed(4) + ')'
      break
    case 'sonnet':
      reason = 'Normal task → Sonnet (€' + estimatedCost.toFixed(4) + ')'
      break
    case 'opus':
      reason = 'Complex reasoning → Opus (€' + estimatedCost.toFixed(4) + ')'
      break
    case 'gpt4':
      reason = 'Fallback → GPT-4 (€' + estimatedCost.toFixed(4) + ')'
      break
  }
  
  return {
    model,
    classification,
    estimatedCost,
    reason,
  }
}

/**
 * Log model usage to database (for cost tracking)
 */
export async function logModelUsage(
  model: ModelTier,
  tokensUsed: number,
  cost: number,
  task: string
) {
  // This will be integrated with the database
  console.log(`[MODEL] ${model} used ${tokensUsed} tokens (€${cost.toFixed(4)}) for: ${task.slice(0, 50)}`)
  
  // TODO: Insert into database
  // INSERT INTO model_usage (model, tokens, cost, task, timestamp)
  // VALUES ($1, $2, $3, $4, NOW())
}
