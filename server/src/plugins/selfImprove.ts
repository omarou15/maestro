import type { Plugin } from "./types.js"
import cron from 'node-cron'
import { runWeeklyReview } from "../crons/weeklyReview.js"
import { runDailyOptimization } from "../crons/dailyOptimization.js"

export const selfImprovePlugin: Plugin = {
  id: "self-improve",
  name: "Self-Improvement Loop",
  version: "1.0.0",
  register(ctx) {
    console.log("[SELF-IMPROVE] Self-improvement loops enabled")
    
    // Weekly code review - Every Sunday at 02:00 UTC
    cron.schedule('0 2 * * 0', async () => {
      console.log('[SELF-IMPROVE] Running weekly code review...')
      const result = await runWeeklyReview()
      
      if (result.issues > 0) {
        // Fire event for notification
        ctx.fire("self-improve:issues", {
          type: 'weekly_review',
          issues: result.issues,
          results: result.results
        })
      }
    })
    
    // Daily memory optimization - Every day at 03:00 UTC
    cron.schedule('0 3 * * *', async () => {
      console.log('[SELF-IMPROVE] Running daily optimization...')
      const result = await runDailyOptimization()
      
      ctx.fire("self-improve:completed", {
        type: 'daily_optimization',
        results: result.results
      })
    })
    
    // Manual trigger endpoints
    ctx.app.post("/api/self-improve/weekly-review", async (_, res) => {
      console.log('[SELF-IMPROVE] Manual weekly review triggered')
      const result = await runWeeklyReview()
      res.json(result)
    })
    
    ctx.app.post("/api/self-improve/daily-optimization", async (_, res) => {
      console.log('[SELF-IMPROVE] Manual daily optimization triggered')
      const result = await runDailyOptimization()
      res.json(result)
    })
    
    // Status endpoint
    ctx.app.get("/api/self-improve/status", (_, res) => {
      res.json({
        enabled: true,
        crons: [
          { name: 'Weekly Code Review', schedule: 'Sunday 02:00 UTC', status: 'active' },
          { name: 'Daily Memory Optimization', schedule: 'Every day 03:00 UTC', status: 'active' }
        ],
        lastRun: {
          weeklyReview: 'Not yet run',
          dailyOptimization: 'Not yet run'
        }
      })
    })
    
    console.log('[SELF-IMPROVE] Crons registered: Weekly review (Sun 02:00), Daily optimization (03:00)')
  },
}
