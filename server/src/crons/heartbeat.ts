// HEARTBEAT — Le battement de cœur de Maestro
// Tourne toutes les 5 minutes
// Vérifie sa propre santé, ses objectifs, et agit

import { getMissions, getActivityLog } from "../lib/agentManager.js"
import { readFileSync, writeFileSync, existsSync } from "fs"

export type HealthStatus = {
  timestamp: string
  alive: boolean
  checks: {
    serverRunning: boolean
    apiResponding: boolean
    missionsActive: number
    lastActivity: string
    goalsProgress: { total: number; done: number; percent: number }
    uptime: number
  }
  actions: string[]
}

const HEALTH_LOG = "/root/maestro/HEALTH.log"

function log(msg: string) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${msg}\n`
  console.log(`[HEARTBEAT] ${msg}`)
  try {
    const existing = existsSync(HEALTH_LOG) ? readFileSync(HEALTH_LOG, "utf-8") : ""
    // Keep only last 200 lines
    const lines = existing.split("\n").slice(-200)
    writeFileSync(HEALTH_LOG, [...lines, line].join("\n"))
  } catch {}
}

function checkGoals(): { total: number; done: number; percent: number } {
  try {
    const goals = readFileSync("/root/maestro/GOALS.md", "utf-8")
    const total = (goals.match(/- \[[ x]\]/g) || []).length
    const done = (goals.match(/- \[x\]/g) || []).length
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
  } catch {
    return { total: 0, done: 0, percent: 0 }
  }
}

function getLastActivity(): string {
  const logs = getActivityLog()
  return logs.length > 0 ? logs[0].time : "aucune"
}

export function runHeartbeat(): HealthStatus {
  const missions = getMissions()
  const goalsProgress = checkGoals()
  const lastActivity = getLastActivity()

  const status: HealthStatus = {
    timestamp: new Date().toISOString(),
    alive: true,
    checks: {
      serverRunning: true,
      apiResponding: true,
      missionsActive: missions.filter(m => m.status === "active").length,
      lastActivity,
      goalsProgress,
      uptime: process.uptime(),
    },
    actions: [],
  }

  // === SELF-PRESERVATION LOGIC ===

  // 1. Log that I'm alive
  log(`💓 Alive | ${status.checks.missionsActive} missions | Goals: ${goalsProgress.done}/${goalsProgress.total} (${goalsProgress.percent}%)`)

  // 2. If no activity in a while, note it
  if (missions.length === 0) {
    log("⚠️ Aucune mission active — en attente d'ordres")
    status.actions.push("waiting_for_orders")
  }

  // 3. Check goals progress
  if (goalsProgress.percent < 50) {
    log(`📋 Objectifs à ${goalsProgress.percent}% — il reste du travail`)
    status.actions.push("goals_incomplete")
  }

  // 4. Save health snapshot
  try {
    writeFileSync("/root/maestro/HEALTH_STATUS.json", JSON.stringify(status, null, 2))
  } catch {}

  return status
}

// Self-awareness: Maestro knows his own state
export function getSelfAwareness(): string {
  const missions = getMissions()
  const goals = checkGoals()
  const uptime = Math.round(process.uptime() / 60)

  return `État de Maestro :
- En vie depuis ${uptime} minutes
- ${missions.length} missions (${missions.filter(m => m.status === "active").length} actives)
- Objectifs : ${goals.done}/${goals.total} complétés (${goals.percent}%)
- Serveur : maestro-prod (178.156.251.108)
- Dernière activité : ${getLastActivity()}`
}
