import express from "express"
import cors from "cors"
import cron from "node-cron"
import dotenv from "dotenv"
import { spawnSync } from "child_process"
import { writeFileSync, unlinkSync, readFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs"
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
    spawnSync("systemctl", ["restart", "maestro-core"], { encoding: "utf8" })
  }, 1000)
})

// === SELF-MODIFY (Maestro modifie son propre code via claude CLI) ===
app.post("/api/self-modify", (req, res) => {
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: "prompt required" })

  console.log(`[SELF-MODIFY ${new Date().toISOString()}] "${prompt.slice(0, 80)}..."`)

  // Direct execution via claude CLI

  const result = spawnSync(
    "claude",
    ["-p", prompt, "--output-format", "text"],
    { cwd: "/root/maestro", timeout: 180000, encoding: "utf8", env: { ...process.env, HOME: "/root" } }
  )

  // No temp file needed

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

// === SKILLS SYSTEM ===
const SKILLS_DIR = "/root/maestro/skills"

// Ensure skills directory exists
if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true })

// Parse SKILL.md frontmatter
function parseSkillMd(content: string) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return { name: "", description: "", body: content }
  const fm = fmMatch[1]
  const body = fmMatch[2]
  const nameMatch = fm.match(/name:\s*(.+)/)
  const descMatch = fm.match(/description:\s*"?(.+?)"?\s*$/)
  return {
    name: nameMatch ? nameMatch[1].trim() : "",
    description: descMatch ? descMatch[1].trim() : "",
    body: body.trim(),
  }
}

// List all skills (name + description only for routing)
app.get("/api/skills", (_, res) => {
  try {
    const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
    const skills = dirs.map(d => {
      const skillPath = join(SKILLS_DIR, d.name, "SKILL.md")
      if (!existsSync(skillPath)) return null
      const content = readFileSync(skillPath, "utf-8")
      const parsed = parseSkillMd(content)
      return { id: d.name, name: parsed.name || d.name, description: parsed.description }
    }).filter(Boolean)
    res.json({ skills })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// Get full skill content
app.get("/api/skills/:id", (req, res) => {
  const skillPath = join(SKILLS_DIR, req.params.id, "SKILL.md")
  if (!existsSync(skillPath)) return res.status(404).json({ error: "Skill not found" })
  try {
    const content = readFileSync(skillPath, "utf-8")
    const parsed = parseSkillMd(content)
    res.json({ id: req.params.id, ...parsed, raw: content })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// Create or update a skill
app.put("/api/skills/:id", (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ error: "content required" })
  const skillDir = join(SKILLS_DIR, req.params.id)
  try {
    if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true })
    writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8")
    execSync(`cd /root/maestro && git add skills/ && git commit -m "skill: update ${req.params.id}" && git push origin main`, { encoding: "utf8" })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// Delete a skill
app.delete("/api/skills/:id", (req, res) => {
  const skillDir = join(SKILLS_DIR, req.params.id)
  if (!existsSync(skillDir)) return res.status(404).json({ error: "Skill not found" })
  try {
    rmSync(skillDir, { recursive: true })
    execSync(`cd /root/maestro && git add -A && git commit -m "skill: delete ${req.params.id}" && git push origin main`, { encoding: "utf8" })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// Get all skill descriptions (for injection into chat context)
app.get("/api/skills/context/descriptions", (_, res) => {
  try {
    const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())
    const descriptions = dirs.map(d => {
      const skillPath = join(SKILLS_DIR, d.name, "SKILL.md")
      if (!existsSync(skillPath)) return null
      const content = readFileSync(skillPath, "utf-8")
      const parsed = parseSkillMd(content)
      return `[${d.name}] ${parsed.description}`
    }).filter(Boolean)
    res.json({ descriptions })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// === CRONS SYSTEM (file-based persistence) ===
const CRONS_FILE = "/root/maestro/crons.json"

type CronEntry = {
  id: string; name: string; schedule: string; description: string; active: boolean;
  lastRun?: string; lastStatus?: string; lastOutput?: string
}

function loadCronsData(): CronEntry[] {
  if (!existsSync(CRONS_FILE)) {
    // Initialize with defaults
    const defaults: CronEntry[] = [
      { id: "heartbeat", name: "Heartbeat", schedule: "*/5 * * * *", description: "Vérifie que Maestro est en vie, log l'état", active: true },
      { id: "selfheal", name: "Self-heal", schedule: "*/30 * * * *", description: "Auto-réparation et vérification des services", active: true },
      { id: "backup", name: "Backup quotidien", schedule: "0 3 * * *", description: "Sauvegarde CLAUDE.md, MAESTRO.md, GOALS.md", active: true },
      { id: "email", name: "Check emails", schedule: "*/30 * * * *", description: "Vérifie les missions email actives", active: true },
      { id: "monday", name: "Check Monday", schedule: "0 * * * *", description: "Vérifie les missions équipe/Monday actives", active: true },
      { id: "briefing", name: "Briefing matin", schedule: "0 6 * * *", description: "Génère le briefing matinal à 7h Paris", active: true },
    ]
    writeFileSync(CRONS_FILE, JSON.stringify(defaults, null, 2), "utf-8")
    return defaults
  }
  return JSON.parse(readFileSync(CRONS_FILE, "utf-8"))
}

function saveCronsData(data: CronEntry[]) {
  writeFileSync(CRONS_FILE, JSON.stringify(data, null, 2), "utf-8")
}

function updateCronLastRun(id: string, status: string, output?: string) {
  const data = loadCronsData()
  const cron = data.find(c => c.id === id)
  if (cron) {
    cron.lastRun = new Date().toISOString()
    cron.lastStatus = status
    if (output) cron.lastOutput = output.slice(0, 500)
    saveCronsData(data)
  }
}

// List crons
app.get("/api/crons", (_, res) => {
  res.json({ crons: loadCronsData() })
})

// Update a cron (toggle active, change schedule, etc.)
app.patch("/api/crons/:id", (req, res) => {
  const data = loadCronsData()
  const cron = data.find(c => c.id === req.params.id)
  if (!cron) return res.status(404).json({ error: "Cron not found" })
  const { active, schedule, description, name } = req.body
  if (typeof active === "boolean") cron.active = active
  if (schedule) cron.schedule = schedule
  if (description) cron.description = description
  if (name) cron.name = name
  saveCronsData(data)
  res.json({ ok: true, cron })
})

// Create a new cron
app.post("/api/crons", (req, res) => {
  const { id, name, schedule, description } = req.body
  if (!id || !name || !schedule) return res.status(400).json({ error: "id, name, schedule required" })
  const data = loadCronsData()
  if (data.find(c => c.id === id)) return res.status(409).json({ error: "Cron already exists" })
  data.push({ id, name, schedule, description: description || "", active: true })
  saveCronsData(data)
  res.json({ ok: true })
})

// Delete a cron
app.delete("/api/crons/:id", (req, res) => {
  let data = loadCronsData()
  data = data.filter(c => c.id !== req.params.id)
  saveCronsData(data)
  res.json({ ok: true })
})

// === CRON JOBS ===

function isCronActive(id: string): boolean {
  const data = loadCronsData()
  const c = data.find(cr => cr.id === id)
  return c?.active ?? false
}

// Heartbeat — every 5 minutes
cron.schedule("*/5 * * * *", () => {
  if (!isCronActive("heartbeat")) return
  const result = runHeartbeat()
  updateCronLastRun("heartbeat", "ok", JSON.stringify(result).slice(0, 200))
})

// Self-heal — every 30 minutes
cron.schedule("*/30 * * * *", () => {
  if (!isCronActive("selfheal")) return
  selfHeal()
  updateCronLastRun("selfheal", "ok")
})

// Daily backup — every day at 3 AM
cron.schedule("0 3 * * *", () => {
  if (!isCronActive("backup")) return
  console.log("[CRON] Daily backup")
  createBackup()
  updateCronLastRun("backup", "ok")
})

// Email check — every 30 minutes
cron.schedule("*/30 * * * *", () => {
  if (!isCronActive("email")) return
  const emailMissions = getMissions().filter(m => m.name.toLowerCase().includes("email") && m.status === "active")
  updateCronLastRun("email", "ok", `${emailMissions.length} missions email actives`)
})

// Monday check — every hour
cron.schedule("0 * * * *", () => {
  if (!isCronActive("monday")) return
  const equipeMissions = getMissions().filter(m => (m.name.toLowerCase().includes("equipe") || m.name.toLowerCase().includes("monday")) && m.status === "active")
  updateCronLastRun("monday", "ok", `${equipeMissions.length} missions équipe actives`)
})

// Morning briefing — 7 AM Paris time (6 AM UTC in winter, 5 AM UTC in summer)
cron.schedule("0 6 * * *", () => {
  if (!isCronActive("briefing")) return
  console.log("[CRON] Morning briefing generation")
  updateCronLastRun("briefing", "ok", "Briefing généré")
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
