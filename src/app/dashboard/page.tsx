"use client"

import { useState } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type Agent = { name: string; icon: string; status: "done" | "active" | "waiting" | "idle"; task: string }
type Mission = { id: number; name: string; icon: string; color: string; status: string; progress: number; phase: string; startedAt: string; agents: Agent[] }
type Approval = { id: number; mission: string; agent: string; icon: string; action: string; reason: string; priority: "haute" | "moyenne" | "basse"; time: string }
type Activity = { time: string; agent: string; mission: string; text: string; type: "pending" | "auto" | "alert" | "done" | "info" }

const MISSIONS: Mission[] = [
  { id: 1, name: "Dev App — Gestion Audits", icon: "💻", color: "#8B5CF6", status: "en cours", progress: 35, phase: "Phase 2 — Maquettes", startedAt: "il y a 2j",
    agents: [
      { name: "PO", icon: "📋", status: "done", task: "Cadrage terminé" },
      { name: "UX", icon: "🎨", status: "active", task: "Maquette en cours..." },
      { name: "Archi", icon: "🏗️", status: "waiting", task: "Attend maquettes" },
      { name: "Front", icon: "⚛️", status: "idle", task: "—" },
      { name: "Back", icon: "⚙️", status: "idle", task: "—" },
      { name: "DevOps", icon: "🚀", status: "idle", task: "—" },
      { name: "QA", icon: "🧪", status: "idle", task: "—" },
    ] },
  { id: 2, name: "Gestion Emails", icon: "📧", color: "#3B82F6", status: "24/7", progress: 100, phase: "Opérationnel", startedAt: "il y a 5j",
    agents: [
      { name: "Trieur", icon: "📥", status: "active", task: "14 emails triés" },
      { name: "Rédacteur", icon: "✍️", status: "active", task: "Brouillon Nexity prêt" },
      { name: "Relanceur", icon: "🔔", status: "active", task: "Relance Mme Leroy" },
    ] },
  { id: 3, name: "Suivi Équipe Monday", icon: "👥", color: "#10B981", status: "24/7", progress: 100, phase: "Opérationnel", startedAt: "il y a 5j",
    agents: [
      { name: "Tracker", icon: "📊", status: "active", task: "12 tâches sync" },
      { name: "Alerteur", icon: "⚠️", status: "active", task: "Karim — retard 2j" },
    ] },
  { id: 4, name: "Vie Perso", icon: "🏠", color: "#EC4899", status: "actif", progress: 100, phase: "Opérationnel", startedAt: "il y a 3j",
    agents: [
      { name: "Shopper", icon: "🛒", status: "active", task: "Courses livrées" },
      { name: "Planificateur", icon: "📅", status: "active", task: "RDV dentiste ajouté" },
    ] },
]

const APPROVALS: Approval[] = [
  { id: 1, mission: "Emails", agent: "Rédacteur", icon: "✍️", action: "Répondre à Nexity — partenariat DPE", reason: "Email stratégique", priority: "haute", time: "12 min" },
  { id: 2, mission: "Dev App", agent: "UX", icon: "🎨", action: "Maquette prête — valider pour coder", reason: "Gate Phase 2→3", priority: "moyenne", time: "35 min" },
  { id: 3, mission: "Vie Perso", agent: "Shopper", icon: "🛒", action: "Billet train Lyon→Paris — 67€", reason: "> 50€", priority: "basse", time: "1h" },
]

const ACTIVITY: Activity[] = [
  { time: "10:12", agent: "✍️", mission: "Emails", text: "Brouillon Nexity prêt → validation", type: "pending" },
  { time: "10:08", agent: "📥", mission: "Emails", text: "3 emails triés — 1 urgent", type: "auto" },
  { time: "09:55", agent: "⚠️", mission: "Équipe", text: "Karim — DPE Iris en retard 2j", type: "alert" },
  { time: "09:42", agent: "🎨", mission: "Dev", text: "Maquette dashboard générée", type: "done" },
  { time: "09:30", agent: "📊", mission: "Équipe", text: "Monday sync — 3 en retard", type: "auto" },
  { time: "09:15", agent: "🛒", mission: "Perso", text: "Courses Carrefour — 38,50€ auto", type: "auto" },
  { time: "08:45", agent: "📥", mission: "Emails", text: "Briefing : 8 emails, 2 urgents", type: "info" },
  { time: "03:22", agent: "🔔", mission: "Emails", text: "Relance auto Mme Leroy", type: "auto" },
]

const statusColors: Record<string, string> = { done: "#10B981", active: "#3B82F6", waiting: "#D4940A", idle: "#D1D5DB" }
const badges: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#FEF3C7", color: "#D97706", label: "VALIDATION" },
  auto: { bg: "#D1FAE5", color: "#059669", label: "AUTO" },
  alert: { bg: "#FEE2E2", color: "#DC2626", label: "ALERTE" },
  done: { bg: "#DBEAFE", color: "#2563EB", label: "TERMINÉ" },
  info: { bg: "#F3F4F6", color: "#6B7280", label: "INFO" },
}

export default function Dashboard() {
  const [cmd, setCmd] = useState("")
  const [approvals, setApprovals] = useState(APPROVALS)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<"missions" | "validations" | "activite">("missions")

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const totalAgents = MISSIONS.reduce((s, m) => s + m.agents.length, 0)
  const activeAgents = MISSIONS.reduce((s, m) => s + m.agents.filter(a => a.status === "active").length, 0)

  return (
    <div className="min-h-[100dvh] bg-[var(--maestro-cream)]">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-6 py-3 rounded-xl text-sm font-medium z-50 shadow-xl max-w-[90vw] animate-slideDown">
          {toast}
        </div>
      )}

      <Header subtitle="ORCHESTRATEUR IA" rightContent={
        <>
          {approvals.length > 0 && (
            <button onClick={() => setTab("validations")} className="bg-red-500 text-white text-[11px] font-bold font-mono px-2.5 py-1 rounded-full touch-target flex items-center justify-center">
              {approvals.length}
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-green-500/[0.12] px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-green-500 text-[11px] font-semibold font-mono">{activeAgents}/{totalAgents}</span>
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
              onKeyDown={e => { if (e.key === "Enter") { showToast(`🎯 "${cmd}"`); setCmd("") }}}
              className="flex-1 border-none outline-none text-sm bg-transparent text-[var(--maestro-primary)]" />
            <button onClick={() => { if (cmd.trim()) { showToast(`🎯 "${cmd}"`); setCmd("") }}}
              className="bg-[var(--maestro-primary)] text-white rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap touch-target">
              →
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 flex gap-1 overflow-x-auto no-scrollbar">
          {([
            { key: "missions" as const, label: "Missions", count: MISSIONS.length },
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

        {/* Content */}
        <div className="px-4 pt-3 pb-24">
          {tab === "missions" && (
            <div className="flex flex-col gap-2.5">
              {MISSIONS.map(m => (
                <div key={m.id} className="bg-white rounded-2xl overflow-hidden border border-[var(--maestro-border)] shadow-sm animate-fadeIn">
                  <div className="p-3.5 flex items-center gap-3 cursor-pointer active:bg-[var(--maestro-surface)] transition-colors"
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${m.color}10` }}>{m.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[var(--maestro-primary)] truncate">{m.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--maestro-muted)] font-mono mt-0.5">
                        <span className="truncate">{m.phase}</span>
                        <span>·</span>
                        <span>{m.agents.length} agents</span>
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
              <button className="bg-white rounded-2xl p-5 border-2 border-dashed border-[var(--maestro-border)] text-[var(--maestro-muted)] text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors touch-target">
                + Nouvelle mission
              </button>
            </div>
          )}

          {tab === "validations" && (
            <div className="flex flex-col gap-2.5">
              {approvals.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-[var(--maestro-border)] animate-fadeIn">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="font-semibold text-[var(--maestro-primary)]">Tout est validé !</div>
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
                        <button onClick={() => { setApprovals(p => p.filter(a => a.id !== item.id)); showToast("✅ Approuvé") }}
                          className="bg-green-500 text-white rounded-xl px-4 py-2 text-[12px] font-semibold touch-target">✓ Valider</button>
                        <button onClick={() => { setApprovals(p => p.filter(a => a.id !== item.id)); showToast("❌ Refusé") }}
                          className="bg-[var(--maestro-surface)] text-[var(--maestro-muted)] border border-[var(--maestro-border)] rounded-xl px-4 py-2 text-[12px] font-semibold touch-target">✗ Refuser</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "activite" && (
            <div className="bg-white rounded-2xl overflow-hidden border border-[var(--maestro-border)] animate-fadeIn">
              {ACTIVITY.map((log, i) => {
                const b = badges[log.type] || badges.info
                return (
                  <div key={i} className={`px-3.5 py-3 flex items-center gap-2.5 ${i < ACTIVITY.length - 1 ? "border-b border-[var(--maestro-surface)]" : ""} ${log.type === "alert" ? "bg-red-50" : ""}`}>
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
