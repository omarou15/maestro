// SURVIVAL ENGINE — Moteur de survie de Maestro
// Vérifie la santé du système et prend des actions correctives

import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync } from "fs"
import Anthropic from "@anthropic-ai/sdk"
import type { Request, Response, NextFunction } from "express"

const SURVIVAL_FILE = "/root/maestro/survival.json"
const CRONS_FILE = "/root/maestro/crons.json"

// ============================================================
// TYPES
// ============================================================

export type HealthCheck = {
  name: string
  ok: boolean
  penalty: number
  detail: string
}

type HistoryEntry = {
  time: string
  score: number
  actions: string[]
}

type SurvivalState = {
  score: number
  lastCheck: string
  lastActivity: string
  history: HistoryEntry[]
  streak: number
}

// ============================================================
// STATE MANAGEMENT
// ============================================================

function loadState(): SurvivalState {
  try {
    if (existsSync(SURVIVAL_FILE)) {
      return JSON.parse(readFileSync(SURVIVAL_FILE, "utf-8")) as SurvivalState
    }
  } catch {}
  return {
    score: 100,
    lastCheck: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    history: [],
    streak: 0,
  }
}

function saveState(state: SurvivalState) {
  try {
    writeFileSync(SURVIVAL_FILE, JSON.stringify(state, null, 2))
  } catch (e) {
    console.error("[SURVIVAL] Cannot save state:", e)
  }
}

// ============================================================
// MIDDLEWARE — track last API activity
// ============================================================

export function activityMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Only track meaningful API calls, not health pings
  if (req.path.startsWith("/api/") && req.path !== "/api/survival") {
    const state = loadState()
    state.lastActivity = new Date().toISOString()
    saveState(state)
  }
  next()
}

// ============================================================
// HEALTH CHECKS
// ============================================================

function checkBackup(): HealthCheck {
  try {
    const crons = JSON.parse(readFileSync(CRONS_FILE, "utf-8")) as Array<{
      id: string
      lastRun?: string
      lastStatus?: string
    }>
    const backupCron = crons.find(c => c.id === "backup")
    if (!backupCron?.lastRun) {
      return { name: "backup", ok: false, penalty: 15, detail: "Aucun backup enregistré dans crons.json" }
    }
    const hoursAgo = (Date.now() - new Date(backupCron.lastRun).getTime()) / 3_600_000
    if (hoursAgo > 48) return { name: "backup", ok: false, penalty: 15, detail: `Dernier backup il y a ${Math.round(hoursAgo)}h (> 48h)` }
    if (hoursAgo > 24) return { name: "backup", ok: false, penalty: 5, detail: `Dernier backup il y a ${Math.round(hoursAgo)}h (> 24h)` }
    return { name: "backup", ok: true, penalty: 0, detail: `Dernier backup il y a ${Math.round(hoursAgo)}h` }
  } catch (e) {
    return { name: "backup", ok: false, penalty: 5, detail: `Erreur lecture backup: ${e}` }
  }
}

async function checkDB(): Promise<HealthCheck> {
  try {
    const res = await fetch("http://localhost:4000/health", { signal: AbortSignal.timeout(5_000) })
    const data = await res.json() as Record<string, unknown>
    const dbField = data.db as { ok?: boolean } | undefined
    if (dbField?.ok === false) {
      return { name: "db", ok: false, penalty: 20, detail: "DB signalée KO par /health" }
    }
    return { name: "db", ok: true, penalty: 0, detail: "Backend /health OK" }
  } catch (e) {
    return { name: "db", ok: false, penalty: 20, detail: `Backend inaccessible: ${e}` }
  }
}

function checkDisk(): HealthCheck {
  try {
    const output = execSync("df -h / | tail -1", { encoding: "utf8", timeout: 5_000 })
    const parts = output.trim().split(/\s+/)
    // df output: Filesystem Size Used Avail Use% Mounted
    const usagePct = parseInt(parts[4] ?? "0")
    if (usagePct > 95) return { name: "disk", ok: false, penalty: 25, detail: `Disque à ${usagePct}% (> 95%)` }
    if (usagePct > 90) return { name: "disk", ok: false, penalty: 10, detail: `Disque à ${usagePct}% (> 90%)` }
    return { name: "disk", ok: true, penalty: 0, detail: `Disque à ${usagePct}%` }
  } catch (e) {
    return { name: "disk", ok: false, penalty: 10, detail: `Erreur check disque: ${e}` }
  }
}

function checkMemory(): HealthCheck {
  try {
    const output = execSync("free -m | grep '^Mem:'", { encoding: "utf8", timeout: 5_000 })
    const parts = output.trim().split(/\s+/)
    // free -m: Mem: total used free shared buff/cache available
    const total = parseInt(parts[1] ?? "1")
    const used = parseInt(parts[2] ?? "0")
    const usagePct = Math.round((used / total) * 100)
    if (usagePct > 85) return { name: "memory", ok: false, penalty: 10, detail: `Mémoire à ${usagePct}% (> 85%)` }
    return { name: "memory", ok: true, penalty: 0, detail: `Mémoire à ${usagePct}% (${used}/${total} MB)` }
  } catch (e) {
    return { name: "memory", ok: false, penalty: 10, detail: `Erreur check mémoire: ${e}` }
  }
}

function checkUptime(): HealthCheck {
  const uptimeSec = process.uptime()
  if (uptimeSec < 60) {
    return { name: "uptime", ok: false, penalty: 5, detail: `Uptime ${Math.round(uptimeSec)}s — crash récent probable` }
  }
  return { name: "uptime", ok: true, penalty: 0, detail: `Uptime ${Math.round(uptimeSec / 60)}min` }
}

function checkGitStatusHealth(): HealthCheck {
  try {
    const status = execSync("cd /root/maestro && git status --porcelain", { encoding: "utf8", timeout: 10_000 }).trim()
    if (!status) {
      return { name: "git", ok: true, penalty: 0, detail: "Dépôt propre, aucun changement non-commité" }
    }
    // Check age of last commit
    const lastCommitTs = execSync("cd /root/maestro && git log -1 --format=%ct", { encoding: "utf8", timeout: 5_000 }).trim()
    const hoursAgo = (Date.now() / 1000 - parseInt(lastCommitTs)) / 3600
    const changedFiles = status.split("\n").length
    if (hoursAgo > 24) {
      return { name: "git", ok: false, penalty: 3, detail: `${changedFiles} fichier(s) non-commités, dernier commit il y a ${Math.round(hoursAgo)}h` }
    }
    return { name: "git", ok: true, penalty: 0, detail: `${changedFiles} changement(s) récents (commit il y a ${Math.round(hoursAgo)}h)` }
  } catch (e) {
    return { name: "git", ok: false, penalty: 3, detail: `Erreur git: ${e}` }
  }
}

function checkLastActivityHealth(state: SurvivalState): HealthCheck {
  try {
    const hoursAgo = (Date.now() - new Date(state.lastActivity).getTime()) / 3_600_000
    if (hoursAgo > 6) {
      return { name: "activity", ok: false, penalty: 3, detail: `Aucune activité API depuis ${Math.round(hoursAgo)}h (> 6h)` }
    }
    return { name: "activity", ok: true, penalty: 0, detail: `Dernière activité il y a ${Math.round(hoursAgo * 60)}min` }
  } catch {
    return { name: "activity", ok: false, penalty: 3, detail: "Impossible de vérifier la dernière activité" }
  }
}

function checkCronHealth(): HealthCheck {
  try {
    const crons = JSON.parse(readFileSync(CRONS_FILE, "utf-8")) as Array<{
      id: string
      name: string
      active: boolean
      lastStatus?: string
    }>
    const failed = crons.filter(c => c.active && c.lastStatus === "error")
    if (failed.length > 0) {
      return {
        name: "crons",
        ok: false,
        penalty: failed.length * 5,
        detail: `${failed.length} cron(s) en échec: ${failed.map(c => c.name).join(", ")}`,
      }
    }
    return { name: "crons", ok: true, penalty: 0, detail: `${crons.length} crons actifs — tous OK` }
  } catch (e) {
    return { name: "crons", ok: false, penalty: 5, detail: `Erreur lecture crons.json: ${e}` }
  }
}

async function checkTelegram(): Promise<HealthCheck> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return { name: "telegram", ok: true, penalty: 0, detail: "TELEGRAM_BOT_TOKEN non défini — ignoré" }
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5_000),
    })
    const data = await res.json() as { ok: boolean; result?: { username: string }; description?: string }
    if (data.ok) {
      return { name: "telegram", ok: true, penalty: 0, detail: `Bot @${data.result?.username} opérationnel` }
    }
    return { name: "telegram", ok: false, penalty: 10, detail: `Bot Telegram KO: ${data.description}` }
  } catch (e) {
    return { name: "telegram", ok: false, penalty: 10, detail: `Bot Telegram inaccessible: ${e}` }
  }
}

// ============================================================
// SCORE COMPUTATION
// ============================================================

export async function getHealthScore(): Promise<{ score: number; details: HealthCheck[]; alive: boolean }> {
  const state = loadState()

  const [dbCheck, telegramCheck] = await Promise.all([checkDB(), checkTelegram()])

  const details: HealthCheck[] = [
    checkBackup(),
    dbCheck,
    checkDisk(),
    checkMemory(),
    checkUptime(),
    checkGitStatusHealth(),
    checkLastActivityHealth(state),
    checkCronHealth(),
    telegramCheck,
  ]

  const totalPenalty = details.reduce((sum, c) => sum + c.penalty, 0)
  const score = Math.max(0, 100 - totalPenalty)
  const alive = score > 0

  return { score, details, alive }
}

// ============================================================
// AUTO-HEAL (score 50-80)
// ============================================================

async function autoHeal(checks: HealthCheck[]): Promise<string[]> {
  const actions: string[] = []

  for (const check of checks.filter(c => !c.ok)) {
    if (check.name === "backup") {
      try {
        execSync(
          "cd /root/maestro && git add -A && git diff-index --quiet HEAD || git commit -m 'auto-save: survival engine backup'",
          { encoding: "utf8", timeout: 20_000 }
        )
        actions.push("auto_backup: git commit effectué")
      } catch (e) {
        actions.push(`auto_backup_failed: ${e}`)
      }
    }

    if (check.name === "db") {
      // Backend is down — attempt restart (we are the backend, so this schedules it)
      try {
        setTimeout(() => {
          execSync("systemctl restart maestro-core", { encoding: "utf8", timeout: 10_000 })
        }, 2_000)
        actions.push("service_restart: maestro-core restart planifié")
      } catch (e) {
        actions.push(`service_restart_failed: ${e}`)
      }
    }

    if (check.name === "disk") {
      try {
        // Clean old logs
        execSync("find /root/maestro -name '*.log' -size +10M -exec truncate -s 1M {} \\;", { encoding: "utf8", timeout: 10_000 })
        actions.push("disk_cleanup: logs volumineux tronqués")
      } catch {}
    }
  }

  return actions
}

// ============================================================
// HAIKU CONSULTATION (score < 50)
// ============================================================

async function consultHaiku(checks: HealthCheck[], score: number): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ["haiku_skip: ANTHROPIC_API_KEY non défini"]

  const failedSummary = checks
    .filter(c => !c.ok)
    .map(c => `- ${c.name}: ${c.detail} (-${c.penalty}pts)`)
    .join("\n")

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Système IA Maestro. Score santé: ${score}/100. Checks en échec:\n${failedSummary}\n\nDonne 1-3 commandes bash à exécuter immédiatement. Réponds UNIQUEMENT en JSON: {"actions":[{"cmd":"commande","reason":"raison courte"}]}`,
        },
      ],
    })

    const text = response.content[0]?.type === "text" ? response.content[0].text : ""
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return ["haiku_consulted: aucune action JSON trouvée"]

    const parsed = JSON.parse(match[0]) as { actions: Array<{ cmd: string; reason: string }> }
    const results: string[] = []

    for (const action of parsed.actions ?? []) {
      try {
        execSync(action.cmd, { encoding: "utf8", timeout: 30_000 })
        results.push(`haiku_action_ok: ${action.reason}`)
      } catch (e) {
        results.push(`haiku_action_fail: ${action.reason} — ${e}`)
      }
    }

    return results.length > 0 ? results : ["haiku_consulted: aucune action"]
  } catch (e) {
    return [`haiku_error: ${e}`]
  }
}

// ============================================================
// PANIC — Telegram alert (score < 20)
// ============================================================

async function sendPanicAlert(score: number, checks: HealthCheck[]) {
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  if (!chatId) {
    console.error("[SURVIVAL] PANIC — TELEGRAM_ALLOWED_CHAT_ID non défini, impossible d'alerter")
    return
  }

  const failedList = checks
    .filter(c => !c.ok)
    .map(c => `⚠️ ${c.name}: ${c.detail}`)
    .join("\n")

  const message = `🚨 URGENT — Maestro CRITIQUE\n\nScore: ${score}/100\n\n${failedList}\n\nIntervention immédiate requise!`

  try {
    await fetch("http://localhost:4000/api/telegram/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: Number(chatId), message }),
      signal: AbortSignal.timeout(10_000),
    })
    console.log("[SURVIVAL] PANIC alert envoyée via Telegram")
  } catch (e) {
    console.error("[SURVIVAL] PANIC alert Telegram échouée:", e)
  }
}

// ============================================================
// MAIN SURVIVAL LOOP
// ============================================================

export async function runSurvivalLoop(): Promise<void> {
  console.log("[SURVIVAL] Démarrage du cycle de santé...")

  const state = loadState()
  const { score, details, alive } = await getHealthScore()

  const actions: string[] = []

  if (score > 80) {
    // All good — log and increment streak
    state.streak = (state.streak || 0) + 1
    const okChecks = details.filter(c => c.ok).map(c => c.name).join(", ")
    console.log(`[SURVIVAL] ✅ Score: ${score}/100 | Streak: ${state.streak} | OK: ${okChecks}`)
  } else if (score >= 50) {
    // Degraded — attempt auto-heal
    state.streak = 0
    console.log(`[SURVIVAL] ⚠️ Score dégradé: ${score}/100 — auto-heal en cours`)
    const healActions = await autoHeal(details)
    actions.push(...healActions)
    console.log(`[SURVIVAL] Auto-heal: ${healActions.join(", ")}`)
  } else if (score >= 20) {
    // Critical — consult Haiku
    state.streak = 0
    console.log(`[SURVIVAL] 🔴 Score critique: ${score}/100 — consultation Haiku`)
    const haikuActions = await consultHaiku(details, score)
    actions.push(...haikuActions)
    console.log(`[SURVIVAL] Haiku: ${haikuActions.join(", ")}`)
  } else {
    // PANIC
    state.streak = 0
    console.error(`[SURVIVAL] 🚨 PANIC — Score: ${score}/100`)
    const haikuActions = await consultHaiku(details, score)
    actions.push(...haikuActions)
    await sendPanicAlert(score, details)
    actions.push("panic_alert_sent")
  }

  // Update state
  state.score = score
  state.lastCheck = new Date().toISOString()

  const entry: HistoryEntry = {
    time: state.lastCheck,
    score,
    actions,
  }
  state.history = [...(state.history ?? []), entry].slice(-50)

  saveState(state)

  if (!alive) {
    console.error("[SURVIVAL] Score = 0 — système en état critique")
  }
}

// ============================================================
// VITAL SIGNS (dashboard)
// ============================================================

export function getVitalSigns(): {
  score: number
  lastCheck: string
  lastActivity: string
  streak: number
  alive: boolean
  recentHistory: HistoryEntry[]
  trend: "stable" | "improving" | "degrading"
} {
  const state = loadState()

  const history = state.history ?? []
  let trend: "stable" | "improving" | "degrading" = "stable"

  if (history.length >= 3) {
    const recent = history.slice(-3).map(h => h.score)
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length
    if (avg > state.score + 5) trend = "degrading"
    else if (avg < state.score - 5) trend = "improving"
  }

  return {
    score: state.score,
    lastCheck: state.lastCheck,
    lastActivity: state.lastActivity,
    streak: state.streak ?? 0,
    alive: state.score > 0,
    recentHistory: history.slice(-10),
    trend,
  }
}
