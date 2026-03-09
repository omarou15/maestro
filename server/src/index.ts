import express from "express"
import cors from "cors"
import cron from "node-cron"
import dotenv from "dotenv"
import { spawnSync } from "child_process"
import { writeFileSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { createMission, getMissions, getMission, deleteMission, getApprovals, addApproval, resolveApproval, orchestrate, runAgent, getActivityLog } from "./lib/agentManager.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
app.use(express.json())

// Health check
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    server: "maestro-core",
    time: new Date().toISOString(),
    missions: getMissions().length,
    uptime: process.uptime(),
  })
})

// === MISSIONS ===
app.get("/api/missions", (_, res) => {
  res.json({ missions: getMissions() })
})

app.get("/api/missions/:id", (req, res) => {
  const mission = getMission(req.params.id)
  if (!mission) return res.status(404).json({ error: "Mission not found" })
  res.json({ mission })
})

app.post("/api/missions", async (req, res) => {
  const { name, type, icon } = req.body
  if (!name || !type) return res.status(400).json({ error: "name and type required" })
  const mission = createMission(name, type, icon || "🎯")
  res.json({ mission })
})

app.delete("/api/missions/:id", (req, res) => {
  deleteMission(req.params.id)
  res.json({ ok: true })
})

// === ORCHESTRATE (main endpoint) ===
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { message } = req.body
    if (!message) return res.status(400).json({ error: "message required" })
    const result = await orchestrate(message)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: `Orchestration failed: ${e}` })
  }
})

// === AGENTS ===
app.post("/api/agents/:agentId/run", async (req, res) => {
  try {
    const { task, missionId } = req.body
    const mission = getMission(missionId)
    if (!mission) return res.status(404).json({ error: "Mission not found" })
    const agent = mission.agents.find(a => a.id === req.params.agentId)
    if (!agent) return res.status(404).json({ error: "Agent not found" })
    const result = await runAgent(agent, task)
    res.json({ result, agent: { id: agent.id, name: agent.name, status: agent.status, lastAction: agent.lastAction } })
  } catch (e) {
    res.status(500).json({ error: `Agent failed: ${e}` })
  }
})

// === APPROVALS ===
app.get("/api/approvals", (_, res) => {
  res.json({ approvals: getApprovals() })
})

app.post("/api/approvals", (req, res) => {
  const { missionId, agentId, action, reason } = req.body
  const id = addApproval(missionId || "", agentId || "", action, reason)
  res.json({ id })
})

app.post("/api/approvals/:id/resolve", (req, res) => {
  const { decision } = req.body
  const approval = resolveApproval(req.params.id)
  res.json({ resolved: true, decision, approval })
})

// === ACTIVITY LOG ===
app.get("/api/activity", (_, res) => {
  res.json({ log: getActivityLog() })
})

// === SELF-MODIFY (Maestro modifie son propre code) ===
app.post("/api/self-modify", (req, res) => {
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: "prompt required" })

  console.log(`[SELF-MODIFY ${new Date().toISOString()}] "${prompt.slice(0, 80)}..."`)

  // Écrire le prompt dans un fichier temporaire (évite l'injection shell)
  const tmpFile = join(tmpdir(), `maestro-${Date.now()}.txt`)
  try {
    writeFileSync(tmpFile, prompt)
  } catch (e) {
    return res.json({ success: false, error: `Impossible de créer le fichier temporaire: ${e}` })
  }

  // Lancer claude CLI sous l'user maestro-cli (non-root) via sudo + wrapper
  const result = spawnSync(
    "sudo",
    ["-u", "maestro-cli", "/usr/local/bin/maestro-modify", tmpFile],
    { cwd: "/root/maestro", timeout: 180000, encoding: "utf8" }
  )

  try { unlinkSync(tmpFile) } catch { /* ignore */ }

  if (result.error) {
    console.error("[SELF-MODIFY] Error:", result.error.message)
    return res.json({ success: false, error: result.error.message })
  }

  if (result.status !== 0) {
    console.error("[SELF-MODIFY] Failed:", result.stderr)
    return res.json({ success: false, error: result.stderr || "Modification échouée", output: result.stdout })
  }

  console.log(`[SELF-MODIFY] Done. Output: ${result.stdout.slice(0, 200)}`)
  res.json({ success: true, output: result.stdout })
})

// === CRON JOBS (24/7) ===

// Every 30 minutes: check email missions
cron.schedule("*/30 * * * *", async () => {
  console.log(`[CRON ${new Date().toISOString()}] Email check`)
  const emailMissions = getMissions().filter(m => m.name.toLowerCase().includes("email") && m.status === "active")
  for (const mission of emailMissions) {
    const trieur = mission.agents.find(a => a.name === "Trieur")
    if (trieur) {
      mission.log.push({ time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), agentId: trieur.id, agentIcon: trieur.icon, text: "Check emails automatique (cron 30min)", type: "auto" })
    }
  }
})

// Every hour: check Monday tasks
cron.schedule("0 * * * *", async () => {
  console.log(`[CRON ${new Date().toISOString()}] Monday check`)
  const equipeMissions = getMissions().filter(m => m.name.toLowerCase().includes("equipe") || m.name.toLowerCase().includes("monday"))
  for (const mission of equipeMissions) {
    const tracker = mission.agents.find(a => a.name === "Tracker")
    if (tracker) {
      mission.log.push({ time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), agentId: tracker.id, agentIcon: tracker.icon, text: "Synchro Monday automatique (cron 1h)", type: "auto" })
    }
  }
})

// Every morning at 7:00 AM Paris time: briefing
cron.schedule("0 7 * * *", async () => {
  console.log(`[CRON ${new Date().toISOString()}] Morning briefing`)
  // Will generate briefing when Gmail/Monday APIs are connected
})

app.listen(PORT, () => {
  console.log(`
🎯 Maestro Core running on port ${PORT}
📡 API: http://localhost:${PORT}/api
⏰ Crons: emails/30min, Monday/1h, briefing/7h
🤖 Ready to orchestrate agents
  `)
})
