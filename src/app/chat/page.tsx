"use client"

import { useState, useRef, useEffect } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"

type ModelId = "claude-opus" | "claude-sonnet" | "claude-haiku" | "gpt4o" | "gemini" | "dalle" | "flux" | "whisper"

type Model = {
  id: ModelId
  name: string
  icon: string
  color: string
  specialty: string
}

const MODELS: Model[] = [
  { id: "claude-opus", name: "Claude Opus", icon: "🧠", color: "#8B5CF6", specialty: "Raisonnement complexe" },
  { id: "claude-sonnet", name: "Claude Sonnet", icon: "⚡", color: "#6366F1", specialty: "Code & dev rapide" },
  { id: "claude-haiku", name: "Claude Haiku", icon: "🐇", color: "#A78BFA", specialty: "Tâches rapides" },
  { id: "gpt4o", name: "GPT-4o", icon: "🤖", color: "#10B981", specialty: "Rédaction naturelle" },
  { id: "gemini", name: "Gemini 2.5", icon: "💎", color: "#3B82F6", specialty: "Vision & multimodal" },
  { id: "dalle", name: "DALL-E 3", icon: "🎨", color: "#EC4899", specialty: "Génération d'images" },
  { id: "flux", name: "Flux Pro", icon: "🖼️", color: "#F59E0B", specialty: "Images HD réalistes" },
  { id: "whisper", name: "Whisper", icon: "🎤", color: "#6B7280", specialty: "Transcription audio" },
]

type MsgBase = {
  id: number
  time: string
}

type SystemMsg = MsgBase & {
  role: "system"
  text: string
}

type UserMsg = MsgBase & {
  role: "user"
  text: string
}

type AssistantMsg = MsgBase & {
  role: "assistant"
  model: ModelId
  text: string
  email?: { to: string; subject: string; body: string }
  details?: { icon: string; text: string }[]
  artifact?: { code: string; title: string }
  missionUpdate?: {
    name: string; phase: string; progress: number
    agents: { name: string; status: string; task: string }[]
  }
  actions?: string[]
}

type Message = SystemMsg | UserMsg | AssistantMsg

const DEMO_MESSAGES: Message[] = [
  {
    id: 1, role: "system", time: "08:45",
    text: "☀️ Briefing matin — 8 emails reçus cette nuit (2 urgents), 3 tâches Monday en retard, ta journée est organisée avec 2 RDV clients.",
  },
  { id: 2, role: "user", time: "09:01", text: "Montre-moi les emails urgents" },
  {
    id: 3, role: "assistant", time: "09:01", model: "claude-haiku",
    text: "Voici les 2 emails urgents triés ce matin :",
    details: [
      { icon: "🔴", text: "Nexity — Demande de partenariat annuel DPE (reçu à 23h42)" },
      { icon: "🟠", text: "SCI Les Terrasses — Relance devis audit 240m² (reçu à 07h15)" },
    ],
    actions: ["Répondre à Nexity", "Voir le devis SCI"],
  },
  { id: 4, role: "user", time: "09:03", text: "Rédige une réponse à Nexity, dis-leur qu'on est intéressés et propose un RDV la semaine prochaine" },
  {
    id: 5, role: "assistant", time: "09:04", model: "gpt4o",
    text: "Brouillon prêt, routé via GPT-4o pour la rédaction :",
    email: {
      to: "m.durand@nexity.fr",
      subject: "Re: Proposition de partenariat DPE — Suite favorable",
      body: "Bonjour M. Durand,\n\nNous avons bien reçu votre proposition de partenariat pour la réalisation des DPE sur vos programmes neufs.\n\nNotre cabinet dispose de 4 ingénieurs thermiciens certifiés, avec une capacité de 15 à 20 DPE par mois.\n\nJe vous propose un rendez-vous la semaine prochaine. Seriez-vous disponible mardi 18 ou jeudi 20 mars ?\n\nCordialement,\nO. Barry",
    },
    actions: ["✅ Envoyer", "✏️ Modifier", "⏳ Mettre en validation"],
  },
  { id: 6, role: "user", time: "09:10", text: "Envoie-le. Et crée-moi un composant React pour afficher les stats de mes audits ce mois-ci" },
  {
    id: 7, role: "assistant", time: "09:11", model: "claude-sonnet",
    text: "Email envoyé ✅ à m.durand@nexity.fr\n\nVoici le composant stats audits, généré via Claude Sonnet :",
    artifact: {
      title: "Stats Audits — Mars 2026",
      code: `<div style="font-family:'DM Sans',sans-serif;background:#FAF8F5;padding:24px;border-radius:16px;border:1.5px solid #E2DDD5;max-width:400px">
  <h2 style="color:#1A2F2A;font-size:18px;font-weight:700;margin:0 0 16px">📊 Audits — Mars 2026</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #E2DDD5;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#1A2F2A">12</div>
      <div style="font-size:12px;color:#7A8580">DPE réalisés</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #E2DDD5;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#D4940A">4</div>
      <div style="font-size:12px;color:#7A8580">Audits RE2020</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #E2DDD5;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#10B981">94%</div>
      <div style="font-size:12px;color:#7A8580">Taux livraison</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:14px;border:1px solid #E2DDD5;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#3B82F6">18.4k€</div>
      <div style="font-size:12px;color:#7A8580">CA ce mois</div>
    </div>
  </div>
  <div style="background:#1A2F2A;border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center">
    <div><div style="color:#D4940A;font-size:14px;font-weight:700">+23%</div><div style="color:rgba(255,255,255,0.5);font-size:11px">vs février</div></div>
    <div style="color:rgba(255,255,255,0.6);font-size:12px">3 devis en attente</div>
  </div>
</div>`,
    },
    actions: ["Modifier les données", "Exporter en PDF", "Ajouter au dashboard"],
  },
  { id: 8, role: "user", time: "09:15", text: "Où en est le dev de l'app audits ?" },
  {
    id: 9, role: "assistant", time: "09:15", model: "claude-opus",
    text: "Point orchestrateur sur la mission Dev App :",
    missionUpdate: {
      name: "Dev App — Gestion Audits Énergétiques",
      phase: "Phase 2 — Maquettes UX", progress: 35,
      agents: [
        { name: "PO", status: "✅", task: "Cadrage terminé" },
        { name: "UX", status: "🔄", task: "Maquette dashboard — livraison dans 2h" },
        { name: "Archi", status: "⏳", task: "Attend validation maquettes" },
        { name: "Front", status: "💤", task: "Pas encore actif" },
        { name: "Back", status: "💤", task: "Pas encore actif" },
      ],
    },
    actions: ["Voir la maquette UX", "Changer la priorité", "Parler à l'agent UX"],
  },
]

function ArtifactRenderer({ code, title }: { code: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:transparent;display:flex;justify-content:center;padding:8px}</style></head><body>${code}</body></html>`)
        doc.close()
      }
    }
  }, [code])

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-[var(--maestro-border)] bg-white">
      <div className="px-3 py-2 bg-[var(--maestro-surface)] border-b border-[var(--maestro-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-[11px] font-semibold text-[var(--maestro-muted)] font-mono">{title}</span>
        </div>
        <span className="text-[10px] text-[var(--maestro-accent)] font-mono font-semibold">ARTIFACT LIVE</span>
      </div>
      <iframe ref={iframeRef} className="w-full border-none" style={{ height: 260 }} sandbox="allow-scripts" />
    </div>
  )
}

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES)
  const [showModels, setShowModels] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const send = () => {
    if (!input.trim()) return
    const userMsg: UserMsg = {
      id: Date.now(), role: "user",
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      text: input,
    }
    setMessages(p => [...p, userMsg])
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const response: AssistantMsg = {
        id: Date.now() + 1, role: "assistant",
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        model: "claude-opus", text: `J'ai bien reçu ton ordre. Je dispatche aux agents concernés.\n\nMission en cours de création — tu verras les agents apparaître dans l'onglet Missions.`,
        actions: ["Voir les missions", "Donner plus de détails"],
      }
      setMessages(p => [...p, response])
      setIsTyping(false)
    }, 2000)
  }

  const getModel = (id: ModelId) => MODELS.find(m => m.id === id)

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--maestro-cream)]">
      {/* Header */}
      <header className="bg-[var(--maestro-primary)] px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <a href="/dashboard"><MaestroLogo size={30} /></a>
          <div>
            <div className="text-white text-[15px] font-bold tracking-tight">Chat Maestro</div>
            <div className="text-white/40 text-[9px] font-mono tracking-[0.08em]">{MODELS.length} MODÈLES CONNECTÉS</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowModels(!showModels)}
            className="bg-white/10 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg">
            🧠 IA {showModels ? "▴" : "▾"}
          </button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Models panel */}
      {showModels && (
        <div className="bg-white border-b border-[var(--maestro-border)] px-4 py-3 flex flex-wrap gap-1.5 shrink-0">
          {MODELS.map(m => (
            <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border"
              style={{ background: `${m.color}08`, borderColor: `${m.color}20` }}>
              <span>{m.icon}</span>
              <span className="font-semibold" style={{ color: m.color }}>{m.name}</span>
              <span className="text-[var(--maestro-muted)] text-[10px]">· {m.specialty}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-4 flex flex-col gap-4">
        {messages.map(msg => (
          <div key={msg.id}>
            {/* System */}
            {msg.role === "system" && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] font-bold text-blue-600 font-mono">BRIEFING · {msg.time}</span>
                </div>
                <div className="text-[13px] text-blue-800 leading-relaxed">{msg.text}</div>
              </div>
            )}

            {/* User */}
            {msg.role === "user" && (
              <div className="flex justify-end">
                <div className="bg-[var(--maestro-primary)] text-white rounded-[16px_16px_4px_16px] px-4 py-3 max-w-[80%]">
                  <div className="text-[14px] leading-relaxed">{msg.text}</div>
                  <div className="text-[10px] text-white/30 mt-1 text-right font-mono">{msg.time}</div>
                </div>
              </div>
            )}

            {/* Assistant */}
            {msg.role === "assistant" && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0 mt-0.5">
                  <MaestroLogo size={18} />
                </div>
                <div className="flex-1 max-w-[calc(100%-46px)]">
                  {/* Model badge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {(() => {
                      const m = getModel(msg.model)
                      if (!m) return null
                      return (
                        <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md"
                          style={{ background: `${m.color}12`, color: m.color }}>
                          {m.icon} {m.name}
                        </span>
                      )
                    })()}
                    <span className="text-[10px] text-[var(--maestro-muted)] font-mono">{msg.time}</span>
                  </div>

                  <div className="bg-white rounded-[4px_16px_16px_16px] p-4 border border-[var(--maestro-border)] shadow-sm">
                    <div className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line">{msg.text}</div>

                    {/* Email */}
                    {msg.email && (
                      <div className="mt-3 bg-[var(--maestro-cream)] rounded-xl p-3.5 border border-[var(--maestro-border)]">
                        <div className="text-[11px] text-[var(--maestro-muted)] font-mono mb-1">À : {msg.email.to}</div>
                        <div className="text-[13px] font-semibold text-[var(--maestro-primary)] mb-2">{msg.email.subject}</div>
                        <div className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line border-l-[3px] border-[var(--maestro-border)] pl-3">
                          {msg.email.body}
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    {msg.details && (
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {msg.details.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[var(--maestro-cream)] rounded-lg border border-[var(--maestro-border)]">
                            <span className="text-sm">{d.icon}</span>
                            <span className="text-[13px] text-gray-600">{d.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Artifact */}
                    {msg.artifact && (
                      <ArtifactRenderer code={msg.artifact.code} title={msg.artifact.title} />
                    )}

                    {/* Mission Update */}
                    {msg.missionUpdate && (
                      <div className="mt-3 bg-[var(--maestro-cream)] rounded-xl p-3.5 border border-[var(--maestro-border)]">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="text-[13px] font-bold text-[var(--maestro-primary)]">{msg.missionUpdate.name}</div>
                          <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">
                            {msg.missionUpdate.phase}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--maestro-border)] rounded-full mb-2.5 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${msg.missionUpdate.progress}%` }} />
                        </div>
                        <div className="flex flex-col gap-1">
                          {msg.missionUpdate.agents.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-[12px]">
                              <span className="w-5 text-center">{a.status}</span>
                              <span className="font-semibold text-gray-700 min-w-[45px]">{a.name}</span>
                              <span className="text-[var(--maestro-muted)]">{a.task}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {msg.actions && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {msg.actions.map((a, i) => (
                          <button key={i} className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                            i === 0
                              ? "bg-[var(--maestro-primary)] text-white hover:bg-[var(--maestro-primary-light)]"
                              : "bg-[var(--maestro-surface)] text-gray-600 border border-[var(--maestro-border)] hover:border-[var(--maestro-accent)]"
                          }`}>
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0">
              <MaestroLogo size={18} />
            </div>
            <div className="bg-white rounded-2xl px-4 py-3 border border-[var(--maestro-border)]">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-[var(--maestro-border)] shrink-0">
        <div className="flex gap-2 mb-2">
          {["📎 Fichier", "🎤 Audio", "📷 Photo"].map((btn, i) => (
            <button key={i} className="bg-[var(--maestro-surface)] border border-[var(--maestro-border)] rounded-lg px-2.5 py-1 text-[11px] font-medium text-[var(--maestro-muted)]">
              {btn}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="Parle à Maestro..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-4 py-3 text-[14px] outline-none bg-[var(--maestro-cream)] text-[var(--maestro-primary)] placeholder:text-[var(--maestro-muted)] focus:border-[var(--maestro-accent)] transition-colors" />
          <button onClick={send}
            className="bg-[var(--maestro-primary)] text-white w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 hover:bg-[var(--maestro-primary-light)] transition-colors">
            →
          </button>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="bg-white border-t border-[var(--maestro-border)] px-5 py-2 flex justify-around shrink-0">
        {[
          { icon: "🎯", label: "Dashboard", href: "/dashboard", active: false },
          { icon: "📋", label: "Missions", href: "/dashboard", active: false },
          { icon: "💬", label: "Chat", href: "/chat", active: true },
          { icon: "🔐", label: "Coffre-fort", href: "/vault", active: false },
        ].map((n, i) => (
          <a key={i} href={n.href} className={`text-center ${n.active ? "opacity-100" : "opacity-40"}`}>
            <div className="text-lg">{n.icon}</div>
            <div className={`text-[10px] font-semibold mt-0.5 ${n.active ? "text-[var(--maestro-accent)]" : "text-[var(--maestro-muted)]"}`}>{n.label}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
