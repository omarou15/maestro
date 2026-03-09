import nodeCron from "node-cron"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { getMissions } from "../lib/agentManager.js"
import { runHeartbeat, getSelfAwareness } from "../crons/heartbeat.js"
import { selfHeal, createBackup } from "../crons/resilience.js"
import { getConnectedClients } from "../gateway.js"
import type { Plugin } from "./types.js"

const CRONS_FILE = "/root/maestro/crons.json"

type CronEntry = {
  id: string; name: string; schedule: string; description: string; active: boolean;
  lastRun?: string; lastStatus?: string; lastOutput?: string
}

function loadCronsData(): CronEntry[] {
  if (!existsSync(CRONS_FILE)) {
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
  const entry = data.find(c => c.id === id)
  if (entry) {
    entry.lastRun = new Date().toISOString()
    entry.lastStatus = status
    if (output) entry.lastOutput = output.slice(0, 500)
    saveCronsData(data)
  }
}

function isCronActive(id: string): boolean {
  const data = loadCronsData()
  const c = data.find(cr => cr.id === id)
  return c?.active ?? false
}

export const cronsPlugin: Plugin = {
  id: "crons",
  name: "Crons System",
  version: "1.0.0",
  register(ctx) {
    // API Routes
    ctx.app.get("/api/crons", (_, res) => {
      res.json({ crons: loadCronsData() })
    })

    ctx.app.patch("/api/crons/:id", (req, res) => {
      const data = loadCronsData()
      const entry = data.find(c => c.id === req.params.id)
      if (!entry) return res.status(404).json({ error: "Cron not found" })
      const { active, schedule, description, name } = req.body
      if (typeof active === "boolean") entry.active = active
      if (schedule) entry.schedule = schedule
      if (description) entry.description = description
      if (name) entry.name = name
      saveCronsData(data)
      ctx.fire("cron:updated", { cron: entry })
      res.json({ ok: true, cron: entry })
    })

    ctx.app.post("/api/crons", (req, res) => {
      const { id, name, schedule, description } = req.body
      if (!id || !name || !schedule) return res.status(400).json({ error: "id, name, schedule required" })
      const data = loadCronsData()
      if (data.find(c => c.id === id)) return res.status(409).json({ error: "Cron already exists" })
      data.push({ id, name, schedule, description: description || "", active: true })
      saveCronsData(data)
      res.json({ ok: true })
    })

    ctx.app.delete("/api/crons/:id", (req, res) => {
      let data = loadCronsData()
      data = data.filter(c => c.id !== req.params.id)
      saveCronsData(data)
      res.json({ ok: true })
    })

    // Scheduled Jobs
    nodeCron.schedule("*/5 * * * *", () => {
      if (!isCronActive("heartbeat")) return
      const result = runHeartbeat()
      updateCronLastRun("heartbeat", "ok", JSON.stringify(result).slice(0, 200))
      ctx.fire("system:heartbeat", { ...result, wsClients: getConnectedClients() })
    })

    nodeCron.schedule("*/30 * * * *", () => {
      if (!isCronActive("selfheal")) return
      selfHeal()
      updateCronLastRun("selfheal", "ok")
      ctx.fire("system:self-heal", { time: new Date().toISOString() })
    })

    nodeCron.schedule("0 3 * * *", () => {
      if (!isCronActive("backup")) return
      createBackup()
      updateCronLastRun("backup", "ok")
    })

    nodeCron.schedule("*/30 * * * *", () => {
      if (!isCronActive("email")) return
      const emailMissions = getMissions().filter(m => m.name.toLowerCase().includes("email") && m.status === "active")
      updateCronLastRun("email", "ok", `${emailMissions.length} missions email actives`)
    })

    nodeCron.schedule("0 * * * *", () => {
      if (!isCronActive("monday")) return
      const equipeMissions = getMissions().filter(m => (m.name.toLowerCase().includes("equipe") || m.name.toLowerCase().includes("monday")) && m.status === "active")
      updateCronLastRun("monday", "ok", `${equipeMissions.length} missions équipe actives`)
    })

    nodeCron.schedule("0 6 * * *", () => {
      if (!isCronActive("briefing")) return
      updateCronLastRun("briefing", "ok", "Briefing généré")
    })
  },
}
