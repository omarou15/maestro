"use client"

import { useState, useRef, useEffect } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"

type ModelId = "claude-opus" | "claude-sonnet" | "claude-haiku" | "gpt4o" | "gemini" | "dalle"

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
]

type Message = {
  id: number
  role: "system" | "user" | "assistant"
  text: string
  time: string
  model?: ModelId
}

const WELCOME: Message = {
  id: 0, role: "system", time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  text: "👋 Bienvenue sur Maestro. Je suis ton orchestrateur IA — dis-moi ce que tu veux accomplir et je m'en occupe.",
}

const SUGGESTIONS = [
  "📧 Résume mes emails importants d'aujourd'hui",
  "👥 Fais le point sur les tâches de mon équipe",
  "💻 Crée un agent pour développer une app",
  "🛒 Commande mes courses de la semaine",
  "📊 Génère un rapport de mes audits ce mois-ci",
  "📅 Organise ma journée de demain",
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
        <span className="text-[10px] text-[var(--maestro-accent)] font-mono font-semibold">ARTIFACT</span>
      </div>
      <iframe ref={iframeRef} className="w-full border-none" style={{ height: 260 }} sandbox="allow-scripts" />
    </div>
  )
}

function parseResponse(text: string) {
  // Detect HTML artifacts in response
  const artifactMatch = text.match(/```html\n([\s\S]*?)```/)
  if (artifactMatch) {
    const cleanText = text.replace(/```html\n[\s\S]*?```/, "").trim()
    return { text: cleanText, artifact: { code: artifactMatch[1], title: "Artifact Maestro" } }
  }
  return { text, artifact: null }
}

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [isTyping, setIsTyping] = useState(false)
  const [showModels, setShowModels] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const send = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim()) return

    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    const userMsg: Message = { id: Date.now(), role: "user", text: msgText, time: now }
    setMessages(p => [...p, userMsg])
    setInput("")
    setIsTyping(true)

    try {
      // Build conversation history for API
      const history = [...messages.filter(m => m.role !== "system"), userMsg].map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages(p => [...p, {
          id: Date.now() + 1, role: "assistant", model: "claude-sonnet" as ModelId,
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: "⚠️ Erreur de connexion avec l'IA. Réessaie dans quelques secondes.",
        }])
      } else {
        setMessages(p => [...p, {
          id: Date.now() + 1, role: "assistant", model: (data.model || "claude-sonnet") as ModelId,
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: data.text,
        }])
      }
    } catch {
      setMessages(p => [...p, {
        id: Date.now() + 1, role: "assistant", model: "claude-sonnet" as ModelId,
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        text: "⚠️ Impossible de contacter le serveur. Vérifie ta connexion.",
      }])
    }

    setIsTyping(false)
  }

  const getModel = (id?: ModelId) => MODELS.find(m => m.id === id)

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
            className="bg-white/10 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors">
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
            {msg.role === "system" && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                <div className="text-[13px] text-blue-800 leading-relaxed">{msg.text}</div>
              </div>
            )}

            {msg.role === "user" && (
              <div className="flex justify-end">
                <div className="bg-[var(--maestro-primary)] text-white rounded-[16px_16px_4px_16px] px-4 py-3 max-w-[85%]">
                  <div className="text-[14px] leading-relaxed">{msg.text}</div>
                  <div className="text-[10px] text-white/30 mt-1 text-right font-mono">{msg.time}</div>
                </div>
              </div>
            )}

            {msg.role === "assistant" && (() => {
              const m = getModel(msg.model)
              const { text, artifact } = parseResponse(msg.text)
              return (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0 mt-0.5">
                    <MaestroLogo size={18} />
                  </div>
                  <div className="flex-1 max-w-[calc(100%-46px)]">
                    <div className="flex items-center gap-2 mb-1.5">
                      {m && (
                        <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md"
                          style={{ background: `${m.color}12`, color: m.color }}>
                          {m.icon} {m.name}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--maestro-muted)] font-mono">{msg.time}</span>
                    </div>
                    <div className="bg-white rounded-[4px_16px_16px_16px] p-4 border border-[var(--maestro-border)] shadow-sm">
                      <div className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line">{text}</div>
                      {artifact && <ArtifactRenderer code={artifact.code} title={artifact.title} />}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}

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

        {/* Suggestions when conversation is short */}
        {messages.length <= 1 && !isTyping && (
          <div className="mt-4">
            <div className="text-[12px] font-semibold text-[var(--maestro-muted)] mb-3">Suggestions :</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="bg-white text-[var(--maestro-primary)] text-[12px] font-medium px-3.5 py-2 rounded-xl border border-[var(--maestro-border)] hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-[var(--maestro-border)] shrink-0">
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="Parle à Maestro..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-4 py-3 text-[14px] outline-none bg-[var(--maestro-cream)] text-[var(--maestro-primary)] placeholder:text-[var(--maestro-muted)] focus:border-[var(--maestro-accent)] transition-colors" />
          <button onClick={() => send()}
            disabled={isTyping}
            className="bg-[var(--maestro-primary)] text-white w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 hover:bg-[var(--maestro-primary-light)] transition-colors disabled:opacity-50">
            →
          </button>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="bg-white border-t border-[var(--maestro-border)] px-5 py-2 flex justify-around shrink-0">
        {[
          { icon: "🎯", label: "Dashboard", href: "/dashboard", active: false },
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
