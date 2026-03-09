"use client"

import { useState } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"

type Agent = {
  name: string
  icon: string
  status: "done" | "active" | "waiting" | "idle"
  task: string
}

type Mission = {
  id: number
  name: string
  icon: string
  color: string
  status: string
  progress: number
  phase: string
  startedAt: string
  agents: Agent[]
}

type Approval = {
  id: number
  mission: string
  agent: string
  icon: string
  action: string
  reason: string
  priority: "haute" | "moyenne" | "basse"
  time: string
}

type ActivityLog = {
  time: string
  agent: string
  mission: string
  text: string
  type: "pending" | "auto" | "alert" | "done" | "info"
}

const MISSIONS: Mission[] = [
  {
    id: 1, name: "Dev App — Gestion Audits Énergétiques", icon: "💻", color: "#8B5CF6",
    status: "en cours", progress: 35, phase: "Phase 2 — Maquettes UX", startedAt: "il y a 2 jours",
    agents: [
      { name: "PO", icon: "📋", status: "done", task: "Cadrage métier terminé" },
      { name: "UX", icon: "🎨", status: "active", task: "Maquette dashboard en cours..." },
      { name: "Archi", icon: "🏗️", status: "waiting", task: "Attend validation maquettes" },
      { name: "Front", icon: "⚛️", status: "idle", task: "—" },
      { name: "Back", icon: "⚙️", status: "idle", task: "—" },
      { name: "DevOps", icon: "🚀", status: "idle", task: "—" },
      { name: "QA", icon: "🧪", status: "idle", task: "—" },
    ],
  },
  {
    id: 2, name: "Gestion Emails & Relances", icon: "📧", color: "#3B82F6",
    status: "actif 24/7", progress: 100, phase: "Opérationnel", startedAt: "il y a 5 jours",
    agents: [
      { name: "Trieur", icon: "📥", status: "active", task: "14 emails triés aujourd'hui" },
      { name: "Rédacteur", icon: "✍️", status: "active", task: "Brouillon réponse Nexity prêt" },
      { name: "Relanceur", icon: "🔔", status: "active", task: "Relance Mme Leroy envoyée" },
    ],
  },
  {
    id: 3, name: "Suivi Équipe — Monday", icon: "👥", color: "#10B981",
    status: "actif 24/7", progress: 100, phase: "Opérationnel", startedAt: "il y a 5 jours",
    agents: [
      { name: "Tracker", icon: "📊", status: "active", task: "12 tâches synchronisées" },
      { name: "Alerteur", icon: "⚠️", status: "active", task: "Karim — DPE Résidence Iris : retard 2j" },
    ],
  },
  {
    id: 4, name: "Vie Perso & Courses", icon: "🏠", color: "#EC4899",
    status: "actif", progress: 100, phase: "Opérationnel", startedAt: "il y a 3 jours",
    agents: [
      { name: "Shopper", icon: "🛒", status: "active", task: "Courses Carrefour livrées (38,50€)" },
      { name: "Planificateur", icon: "📅", status: "active", task: "RDV dentiste mardi 17h ajouté" },
    ],
  },
]

const APPROVALS: Approval[] = [
  {
    id: 1, mission: "Gestion Emails", agent: "Rédacteur", icon: "✍️",
    action: "Répondre au promoteur Nexity — proposition de partenariat annuel DPE",
    reason: "Email stratégique — impact business", priority: "haute", time: "il y a 12 min",
  },
  {
    id: 2, mission: "Dev App", agent: "UX", icon: "🎨",
    action: "Maquette écran principal prête — valider pour passer au code",
    reason: "Gate Phase 2 → Phase 3", priority: "moyenne", time: "il y a 35 min",
  },
  {
    id: 3, mission: "Vie Perso", agent: "Shopper", icon: "🛒",
    action: "Billet train Lyon → Paris — 67€ (seuil 50€ dépassé)",
    reason: "Montant > 50€", priority: "basse", time: "il y a 1h",
  },
]

const ACTIVITY: ActivityLog[] = [
  { time: "10:12", agent: "✍️", mission: "Emails", text: "Brouillon réponse Nexity prêt → en attente validation", type: "pending" },
  { time: "10:08", agent: "📥", mission: "Emails", text: "3 nouveaux emails triés — 1 urgent, 2 archivés", type: "auto" },
  { time: "09:55", agent: "⚠️", mission: "Équipe", text: "Alerte : Karim — livrable DPE Résidence Iris en retard de 2 jours", type: "alert" },
  { time: "09:42", agent: "🎨", mission: "Dev App", text: "Maquette dashboard générée — artifact React prêt", type: "done" },
  { time: "09:30", agent: "📊", mission: "Équipe", text: "Synchro Monday terminée — 12 tâches, 3 en retard", type: "auto" },
  { time: "09:15", agent: "🛒", mission: "Vie Perso", text: "Courses Carrefour commandées — 38,50€ (auto < 50€)", type: "auto" },
  { time: "09:02", agent: "📅", mission: "Vie Perso", text: "RDV dentiste Dr. Benali mardi 17h ajouté", type: "auto" },
  { time: "08:45", agent: "📥", mission: "Emails", text: "Briefing matin : 8 emails reçus cette nuit, 2 nécessitent attention", type: "info" },
  { time: "03:22", agent: "🔔", mission: "Emails", text: "Relance auto Mme Leroy — devis DPE en attente depuis 5j", type: "auto" },
  { time: "02:10", agent: "📊", mission: "Équipe", text: "Check nocturne Monday — aucun nouveau retard", type: "auto" },
]

const statusColors: Record<string, string> = {
  done: "#10B981", active: "#3B82F6", waiting: "#D4940A", idle: "#D1D5DB"
}

const typeBadges: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#FEF3C7", color: "#D97706", label: "VALIDATION" },
  auto: { bg: "#D1FAE5", color: "#059669", label: "AUTO" },
  alert: { bg: "#FEE2E2", color: "#DC2626", label: "ALERTE" },
  done: { bg: "#DBEAFE", color: "#2563EB", label: "TERMINÉ" },
  info: { bg: "#F3F4F6", color: "#6B7280", label: "INFO" },
}

export default function Dashboard() {
  const [cmd, setCmd] = useState("")
  const [approvals, setApprovals] = useState(APPROVALS)
  const [expandedMission, setExpandedMission] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<"missions" | "validations" | "activite">("missions")

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const approve = (id: number) => {
    const item = approvals.find(a => a.id === id)
    setApprovals(p => p.filter(a => a.id !== id))
    showToast(`✅ Approuvé — ${item?.action.substring(0, 45)}...`)
  }

  const reject = (id: number) => {
    setApprovals(p => p.filter(a => a.id !== id))
    showToast("❌ Action refusée")
  }

  const sendCmd = () => {
    if (!cmd.trim()) return
    showToast(`🎯 Ordre envoyé : "${cmd}"`)
    setCmd("")
  }

  const totalAgents = MISSIONS.reduce((s, m) => s + m.agents.length, 0)
  const activeAgents = MISSIONS.reduce((s, m) => s + m.agents.filter(a => a.status === "active").length, 0)

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-6 py-3 rounded-xl text-sm font-medium z-50 shadow-xl max-w-[90vw] animate-[slideDown_0.3s_ease]">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-[var(--maestro-primary)] px-5 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <MaestroLogo size={32} />
          <div>
            <div className="text-white text-[15px] font-bold tracking-tight">MAESTRO</div>
            <div className="text-white/40 text-[9px] font-mono tracking-[0.08em]">ORCHESTRATEUR IA</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {approvals.length > 0 && (
            <button onClick={() => setTab("validations")} className="bg-red-500 text-white text-[11px] font-bold font-mono px-2.5 py-1 rounded-full">
              {approvals.length} EN ATTENTE
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-green-500/[0.12] px-2.5 py-1 rounded-full">
            <div className="w-[6px] h-[6px] rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-green-500 text-[11px] font-semibold font-mono">{activeAgents}/{totalAgents}</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Command Bar */}
      <div className="px-5 pt-4">
        <div className="bg-white rounded-2xl p-1 pl-4 flex items-center gap-2.5 shadow-sm border-[1.5px] border-[var(--maestro-border)]">
          <span className="text-lg opacity-50">💬</span>
          <input type="text" placeholder='Donne un ordre... "Relance Nexity" · "Crée un agent surveillance concurrents"'
            value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={e => e.key === "Enter" && sendCmd()}
            className="flex-1 border-none outline-none text-sm bg-transparent text-[var(--maestro-primary)] placeholder:text-[var(--maestro-muted)]" />
          <button onClick={sendCmd}
            className="bg-[var(--maestro-primary)] text-white rounded-xl px-5 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-[var(--maestro-primary-light)] transition-colors">
            Envoyer →
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-4 flex gap-1">
        {([
          { key: "missions" as const, label: "Missions", count: MISSIONS.length },
          { key: "validations" as const, label: "Validations", count: approvals.length },
          { key: "activite" as const, label: "Activité", count: 0 },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${
              tab === t.key ? "bg-[var(--maestro-primary)] text-white" : "bg-[var(--maestro-surface)] text-[var(--maestro-muted)]"
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[11px] font-bold font-mono px-1.5 rounded-md ${
                tab === t.key ? "bg-white/20" : "bg-[var(--maestro-border)]"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5 pt-4 pb-24">
        {/* MISSIONS */}
        {tab === "missions" && (
          <div className="flex flex-col gap-3">
            {MISSIONS.map(m => (
              <div key={m.id} className="bg-white rounded-2xl overflow-hidden border border-[var(--maestro-border)] shadow-sm">
                <div className="p-4 flex items-center gap-3.5 cursor-pointer" onClick={() => setExpandedMission(expandedMission === m.id ? null : m.id)}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px] shrink-0" style={{ background: `${m.color}12` }}>
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-[var(--maestro-primary)] mb-0.5">{m.name}</div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--maestro-muted)] font-mono">
                      <span>{m.phase}</span><span className="text-[var(--maestro-border)]">·</span>
                      <span>{m.agents.length} agents</span><span className="text-[var(--maestro-border)]">·</span>
                      <span>{m.startedAt}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.status.includes("24/7") && (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-md">24/7</span>
                    )}
                    {m.progress < 100 && (
                      <div className="w-12 h-1.5 bg-[var(--maestro-surface)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.progress}%`, background: m.color }} />
                      </div>
                    )}
                    <span className={`text-[var(--maestro-border)] text-lg transition-transform duration-200 ${expandedMission === m.id ? "rotate-180" : ""}`}>▾</span>
                  </div>
                </div>

                {expandedMission === m.id && (
                  <div className="border-t border-[var(--maestro-surface)] p-4 bg-[var(--maestro-cream)]/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {m.agents.map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-[var(--maestro-border)]"
                          style={a.status === "active" ? { borderColor: `${m.color}30`, background: `${m.color}05` } : {}}>
                          <div className="w-2 h-2 rounded-full shrink-0 animate-pulse-dot" style={{ background: statusColors[a.status], animationPlayState: a.status === "active" ? "running" : "paused" }} />
                          <span className="text-base">{a.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--maestro-primary)]">{a.name}</div>
                            <div className="text-[11px] text-[var(--maestro-muted)] truncate">{a.task}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button className="bg-white rounded-2xl p-5 border-2 border-dashed border-[var(--maestro-border)] text-[var(--maestro-muted)] text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
              <span className="text-xl">+</span> Nouvelle mission
            </button>
          </div>
        )}

        {/* VALIDATIONS */}
        {tab === "validations" && (
          <div className="flex flex-col gap-2.5">
            {approvals.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[var(--maestro-border)]">
                <div className="text-4xl mb-3">✅</div>
                <div className="text-[15px] font-semibold text-[var(--maestro-primary)] mb-1">Tout est validé !</div>
                <div className="text-sm text-[var(--maestro-muted)]">Aucune action en attente.</div>
              </div>
            ) : approvals.map(item => (
              <div key={item.id} className="bg-white rounded-2xl p-4 border border-[var(--maestro-border)] shadow-sm"
                style={{ borderLeftWidth: 4, borderLeftColor: item.priority === "haute" ? "#EF4444" : item.priority === "moyenne" ? "#D4940A" : "#D1D5DB" }}>
                <div className="flex items-start gap-3">
                  <span className="text-[28px] leading-none">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-[var(--maestro-primary)] mb-1 leading-snug">{item.action}</div>
                    <div className="flex items-center gap-2 mb-2.5 text-[11px] text-[var(--maestro-muted)] font-mono">
                      <span>{item.mission} → {item.agent}</span><span className="text-[var(--maestro-border)]">·</span><span>{item.time}</span>
                    </div>
                    <div className="text-xs text-[var(--maestro-accent)] bg-[var(--maestro-accent-bg)] px-2.5 py-1.5 rounded-lg inline-block mb-3">
                      💡 {item.reason}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => approve(item.id)} className="bg-green-500 text-white rounded-xl px-5 py-2 text-[13px] font-semibold hover:bg-green-600 transition-colors">✓ Valider</button>
                      <button onClick={() => reject(item.id)} className="bg-[var(--maestro-surface)] text-[var(--maestro-muted)] border border-[var(--maestro-border)] rounded-xl px-5 py-2 text-[13px] font-semibold hover:bg-[var(--maestro-border)] transition-colors">✗ Refuser</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ACTIVITY */}
        {tab === "activite" && (
          <div className="bg-white rounded-2xl overflow-hidden border border-[var(--maestro-border)]">
            {ACTIVITY.map((log, i) => {
              const badge = typeBadges[log.type] || typeBadges.info
              return (
                <div key={i} className={`px-4 py-3 flex items-center gap-3 ${i < ACTIVITY.length - 1 ? "border-b border-[var(--maestro-surface)]" : ""} ${log.type === "alert" ? "bg-red-50" : ""}`}>
                  <span className="text-[11px] text-[var(--maestro-muted)] font-mono min-w-[42px] font-medium">{log.time}</span>
                  <span className="text-[17px]">{log.agent}</span>
                  <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ background: badge.bg, color: badge.color, letterSpacing: "0.05em" }}>{badge.label}</span>
                  <span className="text-[13px] text-gray-600 flex-1">{log.text}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--maestro-border)] px-5 py-2 flex justify-around shadow-[0_-2px_12px_rgba(0,0,0,0.04)] z-40">
        {[
          { icon: "🎯", label: "Dashboard", active: true },
          { icon: "📋", label: "Missions", active: false },
          { icon: "💬", label: "Chat", active: false, href: "/chat" },
          { icon: "🔐", label: "Coffre-fort", active: false },
        ].map((n, i) => (
          <div key={i} className={`text-center cursor-pointer ${n.active ? "opacity-100" : "opacity-40"}`}>
            <div className="text-lg">{n.icon}</div>
            <div className={`text-[10px] font-semibold mt-0.5 ${n.active ? "text-[var(--maestro-accent)]" : "text-[var(--maestro-muted)]"}`}>{n.label}</div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
