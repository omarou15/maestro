"use client"

import { useState, useEffect, useCallback } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type AgentStatus = "done" | "active" | "waiting" | "idle"
type Agent = { name: string; icon: string; status: AgentStatus; task: string }
type Mission = { id: string; name: string; icon: string; color: string; status: string; progress: number; phase: string; startedAt: string; agents: Agent[] }
type Approval = { id: string; mission: string; agent: string; icon: string; action: string; reason: string; priority: "haute" | "moyenne" | "basse"; time: string }
type Activity = { time: string; agent: string; text: string; type: "pending" | "auto" | "alert" | "done" | "info" | "approved" | "rejected" }

const statusColors: Record<string, string> = { done: "#10B981", active: "#3B82F6", waiting: "#D4940A", idle: "#D1D5DB" }
const badges: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#FEF3C7", color: "#D97706", label: "VALIDATION" },
  auto: { bg: "#D1FAE5", color: "#059669", label: "AUTO" },
  alert: { bg: "#FEE2E2", color: "#DC2626", label: "ALERTE" },
  done: { bg: "#DBEAFE", color: "#2563EB", label: "TERMINÉ" },
  info: { bg: "#F3F4F6", color: "#6B7280", label: "INFO" },
  approved: { bg: "#D1FAE5", color: "#059669", label: "APPROUVÉ" },
  rejected: { bg: "#FEE2E2", color: "#DC2626", label: "REFUSÉ" },
}

function getMissionColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes("dev") || n.includes("app") || n.includes("code")) return "#8B5CF6"
  if (n.includes("email") || n.includes("mail")) return "#3B82F6"
  if (n.includes("monday") || n.includes("équipe") || n.includes("equipe") || n.includes("team")) return "#10B981"
  if (n.includes("perso") || n.includes("vie") || n.includes("shop") || n.includes("courses")) return "#EC4899"
  return "#D4940A"
}

function mapAgentStatus(s: string): AgentStatus {
  if (s === "done") return "done"
  if (s === "active" || s === "running" || s === "busy") return "active"
  if (s === "waiting" || s === "pending") return "waiting"
  return "idle"
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `il y a ${minutes}min`
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${days}j`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMission(m: any): Mission {
  return {
    id: String(m.id),
    name: m.name,
    icon: m.icon || "🎯",
    color: getMissionColor(m.name),
    status: m.status || "actif",
    progress: m.progress ?? 0,
    phase: m.phase || "En cours",
    startedAt: m.createdAt ? formatRelativeTime(m.createdAt) : "récemment",
    agents: (m.agents || []).map((a: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      name: a.name || a.role || "Agent",
      icon: a.icon || "🤖",
      status: mapAgentStatus(a.status || "idle"),
      task: a.lastAction || a.task || "—",
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApproval(a: any): Approval {
  return {
    id: String(a.id),
    mission: a.missionId || "Mission",
    agent: a.agentId || "Agent",
    icon: a.icon || "🤖",
    action: a.action || "Action",
    reason: a.reason || "Validation requise",
    priority: (a.priority as Approval["priority"]) || "moyenne",
    time: a.time ? formatRelativeTime(a.time) : "récemment",
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(log: any): Activity {
  return {
    time: log.time
      ? new Date(log.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : "--:--",
    agent: log.agentIcon || "🤖",
    text: log.text || "",
    type: (log.type as Activity["type"]) || "info",
  }
}

export default function Dashboard() {
  const [cmd, setCmd] = useState("")
  const [missions, setMissions] = useState<Mission[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<"missions" | "validations" | "activite">("missions")
  const [processing, setProcessing] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }
  const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })

  const fetchData = useCallback(async () => {
    try {
      const [mRes, aRes, actRes] = await Promise.all([
        fetch("/api/missions"),
        fetch("/api/approvals"),
        fetch("/api/activity"),
      ])
      if (mRes.ok) {
        const data = await mRes.json()
        setMissions((Array.isArray(data) ? data : []).map(mapMission))
      }
      if (aRes.ok) {
        const data = await aRes.json()
        setApprovals((Array.isArray(data) ? data : []).map(mapApproval))
      }
      if (actRes.ok) {
        const data = await actRes.json()
        setActivity((Array.isArray(data) ? data : []).map(mapActivity))
      }
    } catch (err) {
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleCommand = async () => {
    const command = cmd.trim()
    if (!command) return
    setCmd("")
    showToast(`🎯 Ordre envoyé : "${command}"`)
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: command }),
      })
      const data = await res.json()
      if (data.response) showToast(`✅ ${data.response}`)
      setTimeout(fetchData, 2000)
    } catch {
      // toast already shown
    }
  }

  const handleValidation = async (id: string, decision: "approve" | "reject") => {
    const item = approvals.find(a => a.id === id)
    if (!item) return
    setProcessing(id)
    try {
      // Notify backend
      await fetch(`/api/approvals/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      // Get AI confirmation
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: item.action, decision, approvalId: id }),
      })
      const data = await res.json()
      setApprovals(p => p.filter(a => a.id !== id))
      const newLog: Activity = {
        time: now(),
        agent: item.icon,
        text: decision === "approve" ? `✅ ${item.action} — Exécuté` : `❌ ${item.action} — Annulé`,
        type: decision === "approve" ? "approved" : "rejected",
      }
      setActivity(p => [newLog, ...p])
      showToast(data.text || (decision === "approve" ? "✅ Action exécutée" : "❌ Action annulée"))
    } catch {
      showToast("⚠️ Erreur — réessaie")
    }
    setProcessing(null)
  }

  const totalAgents = missions.reduce((s, m) => s + m.agents.length, 0)
  const activeAgents = missions.reduce((s, m) => s + m.agents.filter(a => a.status === "active").length, 0)

  return (
    <div className="min-h-[100dvh] bg-[var(--maestro-cream)]">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-5 py-3 rounded-xl text-[13px] font-medium z-50 shadow-xl max-w-[90vw] animate-slideDown leading-relaxed">
          {toast}
        </div>
      )}

      <Header subtitle="ORCHESTRATEUR IA" rightContent={
        <>
          {approvals.length > 0 && (
            <button onClick={() => setTab("validations")} className="bg-red-500 text-white text-[11px] font-bold font-mono px-2.5 py-1 rounded-full touch-target flex items-center justify-center animate-pulse-dot">
              {approvals.length}
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-green-500/[0.12] px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-green-500 text-[11px] font-semibold font-mono">
              {loading ? "…" : `${activeAgents}/${totalAgents}`}
            </span>
          </div>
        </>
      } />

      <div className="page-content">
        {/* Command Bar */}
        <div className="px-4 pt-4">
          <div className="bg-white rounded-2xl p-1 pl-4 flex items-center gap-2 shadow-sm border-[1.5px] border-[var(--maestro-border)]">
            <span className="text-base opacity-50">💬</span>
            <input type="text" placeholder="Donne un ordre à Maestro..."
              value={cmd} onChange={e => setCmd(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCommand() }}
              className="flex-1 border-none outline-none text-sm bg-transparent text-[var(--maestro-primary)]" />
            <button onClick={handleCommand}
              className="bg-[var(--maestro-primary)] text-white rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap touch-target">
              →
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 flex gap-1">
          {([
            { key: "missions" as const, label: "Missions", count: missions.length },
            { key: "validations" as const, label: "Validations", count: approvals.length },
            { key: "activite" as const, label: "Activité", count: 0 },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap touch-target ${
                tab === t.key ? "bg-[var(--maestro-primary)] text-white" : "bg-[var(--maestro-surface)] text-[var(--maestro-muted)]"
              }`}>
              {t.label}
              {t.count > 0 && <span className={`text-[11px] font-bold font-mono px-1.5 rounded-md ${tab === t.key ? "bg-white/20" : "bg-[var(--maestro-border)]"}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="px-4 pt-3 pb-24">
          {/* MISSIONS */}
          {tab === "missions" && (
            <div className="flex flex-col gap-2.5">
              {loading ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-[var(--maestro-border)]">
                  <div className="w-6 h-6 border-2 border-[var(--maestro-primary)]/20 border-t-[var(--maestro-primary)] rounded-full animate-spin mx-auto mb-3" />
                  <div className="text-sm text-[var(--maestro-muted)]">Connexion au backend…</div>
                </div>
              ) : missions.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-[var(--maestro-border)] animate-fadeIn">
                  <div className="text-4xl mb-3">🎯</div>
                  <div className="font-semibold text-[var(--maestro-primary)] mb-1">Aucune mission active</div>
                  <div className="text-sm text-[var(--maestro-muted)]">Donne un ordre à Maestro pour créer une mission.</div>
                </div>
              ) : missions.map(m => (
                <div key={m.id} className="bg-white rounded-2xl overflow-hidden border border-[var(--maestro-border)] shadow-sm animate-fadeIn">
                  <div className="p-3.5 flex items-center gap-3 cursor-pointer active:bg-[var(--maestro-surface)] transition-colors"
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${m.color}10` }}>{m.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[var(--maestro-primary)] truncate">{m.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--maestro-muted)] font-mono mt-0.5">
                        <span className="truncate">{m.phase}</span><span>·</span><span>{m.agents.length} agents</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.status.includes("24/7") && <span className="bg-green-100 text-green-700 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded">24/7</span>}
                      {m.progress < 100 && (
                        <div className="w-10 h-1.5 bg-[var(--maestro-surface)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.progress}%`, background: m.color }} />
                        </div>
                      )}
                      <span className={`text-[var(--maestro-border)] transition-transform duration-200 ${expanded === m.id ? "rotate-180" : ""}`}>▾</span>
                    </div>
                  </div>
                  {expanded === m.id && (
                    <div className="border-t border-[var(--maestro-surface)] p-3 bg-[var(--maestro-cream)]/50 animate-scaleIn">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {m.agents.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-[var(--maestro-border)]"
                            style={a.status === "active" ? { borderColor: `${m.color}30`, background: `${m.color}05` } : {}}>
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColors[a.status] }} />
                            <span className="text-sm">{a.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-semibold text-[var(--maestro-primary)]">{a.name}</div>
                              <div className="text-[10px] text-[var(--maestro-muted)] truncate">{a.task}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => { setCmd("Crée une nouvelle mission"); document.querySelector("input")?.focus() }}
                className="bg-white rounded-2xl p-5 border-2 border-dashed border-[var(--maestro-border)] text-[var(--maestro-muted)] text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors touch-target">
                + Nouvelle mission
              </button>
            </div>
          )}

          {/* VALIDATIONS */}
          {tab === "validations" && (
            <div className="flex flex-col gap-2.5">
              {approvals.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-[var(--maestro-border)] animate-fadeIn">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="font-semibold text-[var(--maestro-primary)] mb-1">Tout est validé !</div>
                  <div className="text-sm text-[var(--maestro-muted)]">Tes agents tournent en autonomie.</div>
                </div>
              ) : approvals.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 border border-[var(--maestro-border)] shadow-sm animate-fadeIn"
                  style={{ borderLeftWidth: 4, borderLeftColor: item.priority === "haute" ? "#EF4444" : item.priority === "moyenne" ? "#D4940A" : "#D1D5DB" }}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--maestro-primary)] leading-snug mb-1">{item.action}</div>
                      <div className="text-[10px] text-[var(--maestro-muted)] font-mono mb-2">{item.mission} → {item.agent} · {item.time}</div>
                      <div className="text-[11px] text-[var(--maestro-accent)] bg-[var(--maestro-accent-bg)] px-2.5 py-1 rounded-lg inline-block mb-3">💡 {item.reason}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleValidation(item.id, "approve")}
                          disabled={processing === item.id}
                          className="bg-green-500 text-white rounded-xl px-4 py-2 text-[12px] font-semibold touch-target disabled:opacity-50 flex items-center gap-1.5">
                          {processing === item.id ? (
                            <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Exécution...</>
                          ) : "✓ Valider & Exécuter"}
                        </button>
                        <button
                          onClick={() => handleValidation(item.id, "reject")}
                          disabled={processing === item.id}
                          className="bg-[var(--maestro-surface)] text-[var(--maestro-muted)] border border-[var(--maestro-border)] rounded-xl px-4 py-2 text-[12px] font-semibold touch-target disabled:opacity-50">
                          ✗ Refuser
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVITÉ */}
          {tab === "activite" && (
            <div className="bg-white rounded-2xl overflow-hidden border border-[var(--maestro-border)] animate-fadeIn">
              {activity.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-sm text-[var(--maestro-muted)]">Aucune activité pour l'instant.</div>
                </div>
              ) : activity.map((log, i) => {
                const b = badges[log.type] || badges.info
                return (
                  <div key={i} className={`px-3.5 py-3 flex items-center gap-2.5 ${i < activity.length - 1 ? "border-b border-[var(--maestro-surface)]" : ""} ${
                    log.type === "alert" ? "bg-red-50" : log.type === "approved" ? "bg-green-50" : log.type === "rejected" ? "bg-red-50/50" : ""
                  }`}>
                    <span className="text-[10px] text-[var(--maestro-muted)] font-mono min-w-[36px]">{log.time}</span>
                    <span className="text-base">{log.agent}</span>
                    <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: b.bg, color: b.color }}>{b.label}</span>
                    <span className="text-[12px] text-gray-600 flex-1 min-w-0 truncate">{log.text}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <NavBar />
    </div>
  )
}
