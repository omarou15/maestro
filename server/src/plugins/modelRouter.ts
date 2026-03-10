import type { Plugin } from "./types.js"
import { smartRoute, logModelUsage, MODELS, ModelTier } from "../lib/modelRouter.js"
import { Client } from "pg"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_7LqDjOY8brfU@ep-lucky-wave-a4071yjp-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

async function trackModelUsage(
  model: ModelTier,
  tokensUsed: number,
  taskDescription: string,
  sessionId?: string
) {
  const client = new Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    
    const config = MODELS[model]
    const actualCost = (tokensUsed / 1_000_000) * config.costPer1M
    
    await client.query(
      `INSERT INTO model_usage (model, tokens_used, actual_cost, task_description, session_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        model,
        tokensUsed,
        actualCost,
        taskDescription.slice(0, 200),
        sessionId || 'unknown',
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    )
    
    console.log(`[MODEL] Tracked ${model}: ${tokensUsed} tokens, €${actualCost.toFixed(6)}`)
  } catch (err) {
    console.error("[MODEL] Failed to track usage:", err)
  } finally {
    await client.end()
  }
}

async function getModelStats() {
  const client = new Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    
    const result = await client.query(`
      SELECT 
        model,
        COUNT(*) as uses,
        SUM(tokens_used) as total_tokens,
        SUM(actual_cost) as total_cost,
        AVG(tokens_used) as avg_tokens,
        MAX(timestamp) as last_used
      FROM model_usage
      GROUP BY model
      ORDER BY total_cost DESC
    `)
    
    return result.rows
  } catch (err) {
    console.error("[MODEL] Failed to get stats:", err)
    return []
  } finally {
    await client.end()
  }
}

export const modelRouterPlugin: Plugin = {
  id: "model-router",
  name: "Model Router",
  version: "1.0.0",
  register(ctx) {
    console.log("[MODEL ROUTER] Intelligent routing enabled")
    
    // API: Route a prompt to appropriate model
    ctx.app.post("/api/model/route", (req, res) => {
      const { prompt, context } = req.body
      if (!prompt) {
        return res.status(400).json({ error: "prompt required" })
      }
      
      const routing = smartRoute(prompt, context)
      res.json(routing)
    })
    
    // API: Get model usage statistics
    ctx.app.get("/api/model/stats", async (_, res) => {
      const stats = await getModelStats()
      
      const totalCost = stats.reduce((sum, s) => sum + parseFloat(s.total_cost || "0"), 0)
      const totalTokens = stats.reduce((sum, s) => sum + parseInt(s.total_tokens || "0"), 0)
      
      res.json({
        stats,
        summary: {
          totalCost: totalCost.toFixed(6),
          totalTokens,
          modelsUsed: stats.length,
        }
      })
    })
    
    // API: Track model usage (called by clients)
    ctx.app.post("/api/model/track", async (req, res) => {
      const { model, tokens, task, sessionId } = req.body
      if (!model || !tokens) {
        return res.status(400).json({ error: "model and tokens required" })
      }
      
      await trackModelUsage(model as ModelTier, tokens, task || "Unknown task", sessionId)
      res.json({ ok: true })
    })
    
    // Hook into chat events to suggest routing
    ctx.on("chat:message", (data) => {
      const d = data as { text?: string }
      if (d.text) {
        const routing = smartRoute(d.text)
        console.log(`[MODEL ROUTER] Suggestion: ${routing.reason}`)
      }
    })
  },
}
