"use client"

import { useState, useRef, useEffect } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"
import NavBar from "@/components/NavBar"

type ModelId = "claude-opus" | "claude-sonnet" | "claude-haiku" | "gpt4o" | "gemini" | "dalle"

const MODELS = [
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
  id: 0, role: "system",
  time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  text: "👋 Bienvenue sur Maestro. Je suis ton orchestrateur IA — dis-moi ce que tu veux accomplir et je m'en occupe.",
}

const SUGGESTIONS = [
  "📧 Résume mes emails importants",
  "👥 Point sur les tâches de mon équipe",
  "💻 Crée un dashboard de suivi audits",
  "🛒 Commande mes courses",
  "📊 Génère un rapport mensuel",
  "📅 Organise ma journée de demain",
]

const THINKING_STEPS = [
  ["Analyse de la demande", "🔍"],
  ["Sélection du modèle IA", "🧠"],
  ["Mobilisation de l'agent", "🤖"],
  ["Exécution en cours", "⚡"],
]

function ArtifactRenderer({ code, title }: { code: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(300)

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(code)
        doc.close()
        // Auto-resize
        setTimeout(() => {
          if (iframeRef.current?.contentDocument?.body) {
            const h = iframeRef.current.contentDocument.body.scrollHeight
            setHeight(Math.min(Math.max(h + 20, 200), 600))
          }
        }, 500)
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
        <span className="text-[10px] text-[var(--maestro-accent)] font-mono font-bold">ARTIFACT LIVE ⚡</span>
      </div>
      <iframe ref={iframeRef} className="w-full border-none" style={{ height }} sandbox="allow-scripts allow-same-origin" />
    </div>
  )
}

function parseResponse(text: string): { cleanText: string; artifacts: { code: string; title: string }[] } {
  const artifacts: { code: string; title: string }[] = []
  let cleanText = text

  // Parse <artifact title="...">...</artifact>
  const artifactRegex = /<artifact(?:\s+title="([^"]*)")?>([\s\S]*?)<\/artifact>/gi
  let match
  while ((match = artifactRegex.exec(text)) !== null) {
    artifacts.push({ title: match[1] || "Artifact Maestro", code: match[2].trim() })
    cleanText = cleanText.replace(match[0], "")
  }

  // Also catch ```html blocks as fallback
  const codeBlockRegex = /```html\s*\n([\s\S]*?)```/gi
  while ((match = codeBlockRegex.exec(cleanText)) !== null) {
    artifacts.push({ title: "Artifact Maestro", code: match[1].trim() })
    cleanText = cleanText.replace(match[0], "")
  }

  // Clean up any remaining code blocks (don't show to user)
  cleanText = cleanText.replace(/```[\s\S]*?```/g, "").trim()

  // Remove ** markdown bold and replace with clean text
  cleanText = cleanText.replace(/\*\*/g, "")

  return { cleanText, artifacts }
}

function ThinkingIndicator({ step }: { step: number }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0">
        <MaestroLogo size={18} />
      </div>
      <div className="bg-white rounded-2xl px-4 py-3 border border-[var(--maestro-border)] min-w-[200px]">
        <div className="flex flex-col gap-1.5">
          {THINKING_STEPS.map(([label, icon], i) => (
            <div key={i} className={`flex items-center gap-2 text-[12px] transition-all duration-300 ${
              i < step ? "text-green-600" : i === step ? "text-[var(--maestro-accent)]" : "text-[var(--maestro-border)]"
            }`}>
              <span className="text-sm">{i < step ? "✅" : i === step ? icon : "○"}</span>
              <span className={i === step ? "font-semibold" : ""}>{label}</span>
              {i === step && (
                <div className="flex gap-0.5 ml-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingStep, setThinkingStep] = useState(0)
  const [showModels, setShowModels] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const thinkingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping, thinkingStep])

  const startThinking = () => {
    setIsTyping(true)
    setThinkingStep(0)
    let step = 0
    thinkingInterval.current = setInterval(() => {
      step++
      if (step < THINKING_STEPS.length) {
        setThinkingStep(step)
      }
    }, 1200)
  }

  const stopThinking = () => {
    setIsTyping(false)
    setThinkingStep(0)
    if (thinkingInterval.current) {
      clearInterval(thinkingInterval.current)
      thinkingInterval.current = null
    }
  }

  const send = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim()) return

    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    const userMsg: Message = { id: Date.now(), role: "user", text: msgText, time: now }
    setMessages(p => [...p, userMsg])
    setInput("")
    startThinking()

    try {
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

      stopThinking()

      if (data.error) {
        setMessages(p => [...p, {
          id: Date.now() + 1, role: "assistant" as const, model: "claude-sonnet" as ModelId,
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: "⚠️ Erreur de connexion. Réessaie dans quelques secondes.",
        }])
      } else {
        setMessages(p => [...p, {
          id: Date.now() + 1, role: "assistant" as const, model: (data.model || "claude-sonnet") as ModelId,
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: data.text,
        }])
      }
    } catch {
      stopThinking()
      setMessages(p => [...p, {
        id: Date.now() + 1, role: "assistant" as const, model: "claude-sonnet" as ModelId,
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        text: "⚠️ Impossible de contacter le serveur.",
      }])
    }
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

      {showModels && (
        <div className="bg-white border-b border-[var(--maestro-border)] px-4 py-3 flex flex-wrap gap-1.5 shrink-0">
          {MODELS.map(m => (
            <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border"
              style={{ background: `${m.color}08`, borderColor: `${m.color}20` }}>
              <span>{m.icon}</span>
              <span className="font-semibold" style={{ color: m.color }}>{m.name}</span>
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
              const { cleanText, artifacts } = parseResponse(msg.text)
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
                      {cleanText && <div className="text-[14px] text-gray-700 leading-relaxed whitespace-pre-line">{cleanText}</div>}
                      {artifacts.map((a, i) => (
                        <ArtifactRenderer key={i} code={a.code} title={a.title} />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}

        {isTyping && <ThinkingIndicator step={thinkingStep} />}

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
      <div className="px-4 py-3 bg-white border-t border-[var(--maestro-border)] shrink-0 mb-14">
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="Parle à Maestro..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            disabled={isTyping}
            className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-4 py-3 text-[14px] outline-none bg-[var(--maestro-cream)] text-[var(--maestro-primary)] placeholder:text-[var(--maestro-muted)] focus:border-[var(--maestro-accent)] transition-colors disabled:opacity-50" />
          <button onClick={() => send()} disabled={isTyping}
            className="bg-[var(--maestro-primary)] text-white w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 hover:bg-[var(--maestro-primary-light)] transition-colors disabled:opacity-50">
            →
          </button>
        </div>
      </div>

      <NavBar />
    </div>
  )
}
