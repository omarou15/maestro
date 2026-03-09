import Anthropic from "@anthropic-ai/sdk"

export type AgentStatus = "idle" | "active" | "done" | "error"

export type Agent = {
  id: string; name: string; icon: string; role: string
  systemPrompt: string; model: string; status: AgentStatus
  missionId: string; memory: string[]; lastAction: string; createdAt: string
}

export type Mission = {
  id: string; name: string; icon: string
  status: "active" | "paused" | "completed"
  phase: string; progress: number; agents: Agent[]
  createdAt: string; updatedAt: string; log: MissionLog[]
}

export type MissionLog = {
  time: string; agentId: string; agentIcon: string
  text: string; type: "auto" | "pending" | "alert" | "done" | "info"
}

export type Approval = {
  id: string; missionId: string; agentId: string
  action: string; reason: string; time: string
}

const anthropic = new Anthropic()
const missions: Map<string, Mission> = new Map()
const approvals: Map<string, Approval> = new Map()

const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
const today = () => new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })

const TEMPLATES: Record<string, Array<{ name: string; icon: string; role: string; model: string; systemPrompt: string }>> = {
  email: [
    { name: "Trieur", icon: "📥", role: "Tri emails", model: "claude-haiku", systemPrompt: "Tu tries les emails par priorité." },
    { name: "Rédacteur", icon: "✍️", role: "Rédaction emails", model: "gpt-4o", systemPrompt: "Tu rédiges des emails professionnels mais chaleureux. Pas de 'Cordialement' sec." },
    { name: "Relanceur", icon: "🔔", role: "Relances clients", model: "claude-haiku", systemPrompt: "Tu relances les clients qui n'ont pas répondu depuis 3+ jours." },
  ],
  equipe: [
    { name: "Tracker", icon: "📊", role: "Suivi Monday", model: "claude-haiku", systemPrompt: "Tu suis les tâches Monday.com et identifies les retards." },
    { name: "Alerteur", icon: "⚠️", role: "Alertes deadlines", model: "claude-haiku", systemPrompt: "Tu alertes quand des livrables sont en retard." },
  ],
  dev: [
    { name: "PO", icon: "📋", role: "Product Owner", model: "claude-sonnet", systemPrompt: "Tu es Product Owner. Specs et user stories." },
    { name: "UX", icon: "🎨", role: "Designer", model: "claude-sonnet", systemPrompt: "Tu crées des maquettes React/Tailwind." },
    { name: "Archi", icon: "🏗️", role: "Architecte", model: "claude-sonnet", systemPrompt: "Tu définis la stack et le schema DB." },
    { name: "Front", icon: "⚛️", role: "Frontend", model: "claude-sonnet", systemPrompt: "Tu codes en React/Next.js/Tailwind." },
    { name: "Back", icon: "⚙️", role: "Backend", model: "claude-sonnet", systemPrompt: "Tu codes les API et la logique métier." },
    { name: "DevOps", icon: "🚀", role: "DevOps", model: "claude-haiku", systemPrompt: "Tu gères deploy et infra." },
    { name: "QA", icon: "🧪", role: "Testeur", model: "claude-haiku", systemPrompt: "Tu vérifies après chaque deploy." },
  ],
  perso: [
    { name: "Shopper", icon: "🛒", role: "Courses/achats", model: "claude-sonnet", systemPrompt: "Tu gères courses (Carrefour Villeurbanne 18h-20h, pas premier prix viande/fruits). Auto < 50€." },
    { name: "Planificateur", icon: "📅", role: "Agenda", model: "claude-haiku", systemPrompt: "Tu organises l'agenda. Train 1ère classe Part-Dieu carte Avantage." },
  ],
}

export function createMission(name: string, type: string, icon: string): Mission {
  const id = `mission_${Date.now()}`
  const agents: Agent[] = (TEMPLATES[type] || []).map((t, i) => ({
    ...t, id: `agent_${Date.now()}_${i}`, missionId: id,
    status: (i === 0 ? "active" : "idle") as AgentStatus,
    memory: [], lastAction: "—", createdAt: new Date().toISOString(),
  }))
  const mission: Mission = {
    id, name, icon, status: "active", phase: "Démarrage", progress: 0, agents,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    log: [{ time: now(), agentId: "maestro", agentIcon: "🎯", text: `Mission "${name}" créée — ${agents.length} agents mobilisés`, type: "info" }],
  }
  missions.set(id, mission)
  return mission
}

export const getMissions = () => Array.from(missions.values())
export const getMission = (id: string) => missions.get(id)
export const deleteMission = (id: string) => missions.delete(id)
export const getApprovals = () => Array.from(approvals.values())

export function addApproval(missionId: string, agentId: string, action: string, reason: string): string {
  const id = `approval_${Date.now()}`
  approvals.set(id, { id, missionId, agentId, action, reason, time: now() })
  return id
}

export function resolveApproval(id: string) {
  const a = approvals.get(id)
  approvals.delete(id)
  return a
}

export async function runAgent(agent: Agent, task: string): Promise<string> {
  agent.status = "active"
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 2048,
      system: `${agent.systemPrompt}\nDate : ${today()}. Sois concis.`,
      messages: [...agent.memory.slice(-10).map((m, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: m })), { role: "user", content: task }],
    })
    const result = res.content[0].type === "text" ? res.content[0].text : ""
    agent.memory.push(task, result)
    if (agent.memory.length > 20) agent.memory = agent.memory.slice(-10)
    agent.lastAction = result.substring(0, 100)
    agent.status = "done"
    return result
  } catch (e) { agent.status = "error"; return `Erreur: ${e}` }
}

export async function orchestrate(msg: string) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 2048,
    system: `Tu es Maestro Core. Date : ${today()}
Missions actives : ${getMissions().map(m => `${m.name} (${m.agents.length} agents)`).join(", ") || "Aucune"}
Réponds en JSON : {"response":"texte FR","createMission":null|{"name":"","type":"email|equipe|dev|perso","icon":"emoji"}}`,
    messages: [{ role: "user", content: msg }],
  })
  const text = res.content[0].type === "text" ? res.content[0].text : "{}"
  try {
    const p = JSON.parse(text.replace(/```json\s*/g, "").replace(/```/g, "").trim())
    let created: Mission | undefined
    if (p.createMission) created = createMission(p.createMission.name, p.createMission.type, p.createMission.icon)
    return { response: p.response || text, mission: created }
  } catch { return { response: text } }
}

export function getActivityLog(): MissionLog[] {
  const logs: MissionLog[] = []
  for (const m of missions.values()) logs.push(...m.log)
  return logs.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 50)
}
