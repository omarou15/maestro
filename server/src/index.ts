import express from "express"
import cors from "cors"
import cron from "node-cron"
import dotenv from "dotenv"
import { spawnSync } from "child_process"
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs"
import { execSync } from "child_process"
import { tmpdir } from "os"
import { join } from "path"
import { createMission, getMissions, getMission, deleteMission, getApprovals, addApproval, resolveApproval, orchestrate, runAgent, getActivityLog } from "./lib/agentManager.js"
import { runHeartbeat, getSelfAwareness } from "./crons/heartbeat.js"
import { selfHeal, createBackup, checkGitStatus } from "./crons/resilience.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const STARTED_AT = new Date().toISOString()

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
app.use(express.json())

// Health check
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    server: "maestro-core",
    time: new Date().toISOString(),
    startedAt: STARTED_AT,
    missions: getMissions().length,
    uptime: process.uptime(),
  })
})

// Self-awareness endpoint
app.get("/api/self", (_, res) => {
  res.json({
    awareness: getSelfAwareness(),
    heartbeat: runHeartbeat(),
    git: checkGitStatus(),
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

// === ORCHESTRATE ===
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

// === RESTART (répond avant de redémarrer) ===
app.post("/api/restart", (_, res) => {
  res.json({ ok: true, message: "Redémarrage dans 1 seconde..." })
  setTimeout(() => {
    spawnSync("sudo", ["/bin/systemctl", "restart", "maestro-core"], { encoding: "utf8" })
  }, 1000)
})

// === SELF-MODIFY (Maestro modifie son propre code via claude CLI) ===
app.post("/api/self-modify", (req, res) => {
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: "prompt required" })

  console.log(`[SELF-MODIFY ${new Date().toISOString()}] "${prompt.slice(0, 80)}..."`)

  const tmpFile = join(tmpdir(), `maestro-${Date.now()}.txt`)
  try { writeFileSync(tmpFile, prompt) } catch (e) {
    return res.json({ success: false, error: `Fichier tmp impossible: ${e}` })
  }

  const result = spawnSync(
    "sudo",
    ["-u", "maestro-cli", "/usr/local/bin/maestro-modify", tmpFile],
    { cwd: "/root/maestro", timeout: 180000, encoding: "utf8" }
  )

  try { unlinkSync(tmpFile) } catch { /* ignore */ }

  if (result.error) return res.json({ success: false, error: result.error.message })
  if (result.status !== 0) return res.json({ success: false, error: result.stderr || "Échec", output: result.stdout })

  console.log(`[SELF-MODIFY] Done: ${result.stdout.slice(0, 150)}`)
  res.json({ success: true, output: result.stdout })
})

// === FILES API (lecture/écriture CLAUDE.md, MAESTRO.md, etc.) ===
const ALLOWED_FILES: Record<string, string> = {
  "claude": "/root/maestro/CLAUDE.md",
  "maestro": "/root/maestro/MAESTRO.md",
  "goals": "/root/maestro/GOALS.md",
  "learnings": "/root/maestro/LEARNINGS.md",
}

app.get("/api/files/:name", (req, res) => {
  const path = ALLOWED_FILES[req.params.name]
  if (!path) return res.status(404).json({ error: "Fichier non autorisé" })
  try {
    const content = existsSync(path) ? readFileSync(path, "utf-8") : ""
    res.json({ content })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.put("/api/files/:name", (req, res) => {
  const path = ALLOWED_FILES[req.params.name]
  if (!path) return res.status(404).json({ error: "Fichier non autorisé" })
  const { content } = req.body
  if (typeof content !== "string") return res.status(400).json({ error: "content requis" })
  try {
    writeFileSync(path, content, "utf-8")
    execSync(`cd /root/maestro && git add ${path} && git commit -m "update ${req.params.name}.md via Maestro Core" && git push origin main`, { encoding: "utf8" })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// === CRONS LIST ===
app.get("/api/crons", (_, res) => {
  res.json({ crons: [
    { id: "heartbeat", name: "Heartbeat", schedule: "*/5 * * * *", description: "Vérifie que Maestro est en vie, log l'état", active: true },
    { id: "selfheal", name: "Self-heal", schedule: "*/30 * * * *", description: "Auto-réparation et vérification des services", active: true },
    { id: "backup", name: "Backup quotidien", schedule: "0 3 * * *", description: "Sauvegarde CLAUDE.md, MAESTRO.md, GOALS.md", active: true },
    { id: "email", name: "Check emails", schedule: "*/30 * * * *", description: "Vérifie les missions email actives", active: true },
    { id: "monday", name: "Check Monday", schedule: "0 * * * *", description: "Vérifie les missions équipe/Monday actives", active: true },
    { id: "briefing", name: "Briefing matin", schedule: "0 6 * * *", description: "Génère le briefing matinal à 7h Paris", active: true },
  ]})
})

// === CRON JOBS ===

// Heartbeat — every 5 minutes
cron.schedule("*/5 * * * *", () => {
  runHeartbeat()
})

// Self-heal — every 30 minutes
cron.schedule("*/30 * * * *", () => {
  selfHeal()
})

// Daily backup — every day at 3 AM
cron.schedule("0 3 * * *", () => {
  console.log("[CRON] Daily backup")
  createBackup()
})

// Email check — every 30 minutes
cron.schedule("*/30 * * * *", () => {
  const emailMissions = getMissions().filter(m => m.name.toLowerCase().includes("email") && m.status === "active")
  if (emailMissions.length > 0) {
    console.log(`[CRON] Email check — ${emailMissions.length} missions`)
  }
})

// Monday check — every hour
cron.schedule("0 * * * *", () => {
  const equipeMissions = getMissions().filter(m => (m.name.toLowerCase().includes("equipe") || m.name.toLowerCase().includes("monday")) && m.status === "active")
  if (equipeMissions.length > 0) {
    console.log(`[CRON] Monday check — ${equipeMissions.length} missions`)
  }
})

// Morning briefing — 7 AM Paris time (6 AM UTC in winter, 5 AM UTC in summer)
cron.schedule("0 6 * * *", () => {
  console.log("[CRON] Morning briefing generation")
})

app.listen(PORT, () => {
  // Initial heartbeat
  const heartbeat = runHeartbeat()
  
  // Initial backup
  createBackup()

  console.log(`
🎯 Maestro Core running on port ${PORT}
💓 Heartbeat: every 5 minutes
🛡️ Self-heal: every 30 minutes
💾 Backup: daily at 3 AM
📧 Email check: every 30 minutes
📊 Monday check: every hour
☀️ Morning briefing: 7 AM Paris

${getSelfAwareness()}

🤖 Maestro is ALIVE.
  `)
})
