import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { spawnSync } from "child_process"
import { writeFileSync, readFileSync, existsSync } from "fs"
import { execSync } from "child_process"
import { createMission, getMissions, getMission, deleteMission, getApprovals, addApproval, resolveApproval, orchestrate, runAgent, runMissionParallel, runAgentsParallel, getActivityLog } from "./lib/agentManager.js"
import { runHeartbeat, getSelfAwareness } from "./crons/heartbeat.js"
import { checkGitStatus } from "./crons/resilience.js"
import { initGateway, getConnectedClients } from "./gateway.js"
import { fire, EVENTS } from "./hooks.js"
import { registerPlugin, getPlugins } from "./plugins/registry.js"
import { telegramPlugin } from "./plugins/telegram.js"
import { skillsPlugin } from "./plugins/skills.js"
import { cronsPlugin } from "./plugins/crons.js"

dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 4000
const STARTED_AT = new Date().toISOString()

// Initialize WebSocket gateway
initGateway(server)

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }))
app.use(express.json())

// === CORE ROUTES ===

// Health check
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    server: "maestro-core",
    time: new Date().toISOString(),
    startedAt: STARTED_AT,
    missions: getMissions().length,
    uptime: process.uptime(),
    wsClients: getConnectedClients(),
    plugins: getPlugins().map(p => ({ id: p.id, name: p.name, version: p.version })),
  })
})

// Self-awareness endpoint
app.get("/api/self", (_, res) => {
  res.json({
    awareness: getSelfAwareness(),
    heartbeat: runHeartbeat(),
    git: checkGitStatus(),
    plugins: getPlugins().map(p => ({ id: p.id, name: p.name, version: p.version })),
  })
})

// Plugins list
app.get("/api/plugins", (_, res) => {
  res.json({ plugins: getPlugins().map(p => ({ id: p.id, name: p.name, version: p.version })) })
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
  fire(EVENTS.MISSION_CREATED, { mission })
  res.json({ mission })
})

app.delete("/api/missions/:id", (req, res) => {
  deleteMission(req.params.id)
  fire(EVENTS.MISSION_DELETED, { id: req.params.id })
  res.json({ ok: true })
})

// === ORCHESTRATE ===
app.post("/api/orchestrate", async (req, res) => {
  try {
    const { message } = req.body
    if (!message) return res.status(400).json({ error: "message required" })
    const result = await orchestrate(message)
    fire(EVENTS.ACTIVITY, { text: `Orchestration: "${message.slice(0, 80)}"`, type: "auto" })
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
    fire(EVENTS.AGENT_STARTED, { agentId: agent.id, name: agent.name, task })
    const result = await runAgent(agent, task)
    fire(EVENTS.AGENT_COMPLETED, { agentId: agent.id, name: agent.name, result: result.slice(0, 200) })
    res.json({ result, agent: { id: agent.id, name: agent.name, status: agent.status, lastAction: agent.lastAction } })
  } catch (e) {
    res.status(500).json({ error: `Agent failed: ${e}` })
  }
})

// === PARALLEL EXECUTION ===
app.post("/api/missions/:id/run", async (req, res) => {
  try {
    const { task } = req.body
    if (!task) return res.status(400).json({ error: "task required" })
    fire(EVENTS.ACTIVITY, { text: `Lancement parallèle mission ${req.params.id}`, type: "auto" })
    const results = await runMissionParallel(req.params.id, task)
    fire(EVENTS.MISSION_UPDATED, { id: req.params.id, results: results.length })
    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

app.post("/api/missions/:id/run-agents", async (req, res) => {
  try {
    const { agentIds, task } = req.body
    if (!task || !agentIds?.length) return res.status(400).json({ error: "task and agentIds required" })
    const results = await runAgentsParallel(req.params.id, agentIds, task)
    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// === APPROVALS ===
app.get("/api/approvals", (_, res) => {
  res.json({ approvals: getApprovals() })
})

app.post("/api/approvals", (req, res) => {
  const { missionId, agentId, action, reason } = req.body
  const id = addApproval(missionId || "", agentId || "", action, reason)
  fire(EVENTS.APPROVAL_NEEDED, { id, action, reason })
  res.json({ id })
})

app.post("/api/approvals/:id/resolve", (req, res) => {
  const { decision } = req.body
  const approval = resolveApproval(req.params.id)
  fire(EVENTS.APPROVAL_RESOLVED, { id: req.params.id, decision, approval })
  res.json({ resolved: true, decision, approval })
})

// === ACTIVITY LOG ===
app.get("/api/activity", (_, res) => {
  res.json({ log: getActivityLog() })
})

// === RESTART ===
app.post("/api/restart", (_, res) => {
  res.json({ ok: true, message: "Redémarrage dans 1 seconde..." })
  setTimeout(() => {
    spawnSync("systemctl", ["restart", "maestro-core"], { encoding: "utf8" })
  }, 1000)
})

// === SELF-UPDATE ===
app.post("/api/update", (_, res) => {
  try {
    const pull = execSync("cd /root/maestro && git pull origin main 2>&1", { encoding: "utf8", timeout: 30000 })
    const install = execSync("cd /root/maestro/server && npm install 2>&1", { encoding: "utf8", timeout: 60000 })
    res.json({ ok: true, pull: pull.trim(), install: install.slice(-200) })
    setTimeout(() => {
      spawnSync("systemctl", ["restart", "maestro-core"], { encoding: "utf8" })
    }, 1000)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})

// === SELF-MODIFY ===
app.post("/api/self-modify", (req, res) => {
  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: "prompt required" })
  console.log(`[SELF-MODIFY ${new Date().toISOString()}] "${prompt.slice(0, 80)}..."`)
  const result = spawnSync(
    "claude", ["-p", prompt, "--output-format", "text"],
    { cwd: "/root/maestro", timeout: 180000, encoding: "utf8", env: { ...process.env, HOME: "/root" } }
  )
  if (result.error) return res.json({ success: false, error: result.error.message })
  if (result.status !== 0) return res.json({ success: false, error: result.stderr || "Échec", output: result.stdout })
  console.log(`[SELF-MODIFY] Done: ${result.stdout.slice(0, 150)}`)
  res.json({ success: true, output: result.stdout })
})

// === FILES API ===
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

// === BOOT ===
async function boot() {
  // Register all plugins
  await registerPlugin(cronsPlugin, app)
  await registerPlugin(skillsPlugin, app)
  await registerPlugin(telegramPlugin, app)

  server.listen(PORT, () => {
    const heartbeat = runHeartbeat()
    console.log(`
🎯 Maestro Core v2 — Plugin Architecture
📡 WebSocket Gateway on /ws
🔌 Plugins: ${getPlugins().map(p => p.name).join(", ")}
⏱️  Uptime: ${new Date().toISOString()}

${getSelfAwareness()}

🤖 Maestro is ALIVE.
    `)
  })
}

boot().catch(e => {
  console.error("Boot failed:", e)
  process.exit(1)
})
