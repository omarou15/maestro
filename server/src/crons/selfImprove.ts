// Self-improvement cron
// Runs periodically to check GOALS.md and work on the next objective
// This is what makes Maestro autonomous — it reads its own goals and acts on them

import { execSync } from "child_process"
import { readFileSync, writeFileSync } from "fs"

export async function runSelfImprovement() {
  const timestamp = new Date().toISOString()
  console.log(`[SELF-IMPROVE ${timestamp}] Starting self-improvement cycle`)

  try {
    // Read current goals
    const goals = readFileSync("/root/maestro/GOALS.md", "utf-8")
    const learnings = readFileSync("/root/maestro/LEARNINGS.md", "utf-8")

    // Find the first unchecked P0 goal
    const lines = goals.split("\n")
    const nextGoal = lines.find(l => l.includes("- [ ]") && lines.indexOf(l) > lines.indexOf("### P0"))

    if (nextGoal) {
      console.log(`[SELF-IMPROVE] Next goal: ${nextGoal.trim()}`)
      
      // Log the improvement attempt
      const logEntry = `\n## ${new Date().toLocaleDateString("fr-FR")} — Auto-amélioration\n- Objectif ciblé : ${nextGoal.trim()}\n- Status : En cours d'analyse\n`
      writeFileSync("/root/maestro/LEARNINGS.md", learnings + logEntry)
    } else {
      console.log("[SELF-IMPROVE] All P0 goals completed! Moving to P1.")
    }

  } catch (error) {
    console.error(`[SELF-IMPROVE] Error: ${error}`)
  }
}
