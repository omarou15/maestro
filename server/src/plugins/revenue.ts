import type { Plugin } from "./types.js"
import { Client } from "pg"

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_7LqDjOY8brfU@ep-lucky-wave-a4071yjp-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

// Value estimation for tool uses
const TOOL_VALUES: Record<string, number> = {
  web_search: 0.05,      // €0.05 per search (time savings)
  web_fetch: 0.02,        // €0.02 per page fetch
  gmail_search: 0.03,     // €0.03 per email search
  gmail_read: 0.02,       // €0.02 per email read
  gmail_send: 0.10,       // €0.10 per email sent (customer service value)
  gmail_draft: 0.05,      // €0.05 per draft created
  calendar_list: 0.02,    // €0.02 per calendar check
  calendar_create: 0.15,  // €0.15 per event created (scheduling value)
  generate_pdf: 0.50,     // €0.50 per document (complex work)
  generate_xlsx: 0.30,    // €0.30 per spreadsheet
  orchestrate: 1.00,      // €1.00 per mission orchestration
  self_modify: 5.00,      // €5.00 per self-modification (high value)
  browser_automation: 1.00, // €1.00 per automation task
}

async function logRevenue(source: string, amount: number, description: string) {
  const client = new Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    await client.query(
      `INSERT INTO revenue (amount, currency, source, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [amount, 'EUR', source, description, JSON.stringify({ timestamp: new Date().toISOString() })]
    )
  } catch (err) {
    console.error("[REVENUE] Failed to log revenue:", err)
  } finally {
    await client.end()
  }
}

async function getRevenueStats() {
  const client = new Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    const result = await client.query(
      `SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction,
        MAX(amount) as max_transaction,
        MIN(timestamp) as first_transaction,
        MAX(timestamp) as last_transaction
       FROM revenue`
    )
    return result.rows[0] || {}
  } catch (err) {
    console.error("[REVENUE] Failed to get revenue stats:", err)
    return {}
  } finally {
    await client.end()
  }
}

async function getRevenueBySource() {
  const client = new Client({ connectionString: DATABASE_URL })
  try {
    await client.connect()
    const result = await client.query(
      `SELECT 
        source,
        COUNT(*) as count,
        SUM(amount) as total,
        AVG(amount) as avg
       FROM revenue
       GROUP BY source
       ORDER BY total DESC`
    )
    return result.rows
  } catch (err) {
    console.error("[REVENUE] Failed to get revenue by source:", err)
    return []
  } finally {
    await client.end()
  }
}

export const revenuePlugin: Plugin = {
  id: "revenue",
  name: "Revenue Engine",
  version: "2.0.0",
  register(ctx) {
    console.log("[REVENUE] Revenue tracking enabled")

    // Hook into tool uses
    ctx.on("tool:used", async (data) => {
      const d = data as { tool?: string; action?: string; metadata?: any }
      const toolName = d.tool || d.action
      if (!toolName) return

      const value = TOOL_VALUES[toolName]
      if (value) {
        const description = `${toolName} - ${d.metadata?.description || 'automated task'}`
        await logRevenue(toolName, value, description)
        console.log(`[REVENUE] +€${value.toFixed(2)} from ${toolName}`)
      }
    })

    // API routes
    ctx.app.get("/api/revenue", async (_, res) => {
      const stats = await getRevenueStats()
      res.json({ stats })
    })

    ctx.app.get("/api/revenue/by-source", async (_, res) => {
      const bySource = await getRevenueBySource()
      res.json({ bySource })
    })

    ctx.app.post("/api/revenue/log", async (req, res) => {
      const { source, amount, description } = req.body
      if (!source || !amount) {
        return res.status(400).json({ error: "source and amount required" })
      }
      await logRevenue(source, amount, description || "Manual entry")
      res.json({ ok: true })
    })
  },
}
