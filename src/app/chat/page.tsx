"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"
import NavBar from "@/components/NavBar"

type ModelId = "claude-opus" | "claude-sonnet" | "claude-haiku" | "gpt4o" | "gemini" | "dalle"

const MODELS = [
  { id: "claude-opus", name: "Claude Opus", icon: "🧠", color: "#8B5CF6" },
  { id: "claude-sonnet", name: "Claude Sonnet", icon: "⚡", color: "#6366F1" },
  { id: "claude-haiku", name: "Claude Haiku", icon: "🐇", color: "#A78BFA" },
  { id: "gpt4o", name: "GPT-4o", icon: "🤖", color: "#10B981" },
  { id: "gemini", name: "Gemini 2.5", icon: "💎", color: "#3B82F6" },
  { id: "dalle", name: "DALL-E 3", icon: "🎨", color: "#EC4899" },
]

const THINKING_STEPS = [
  ["Analyse de la demande", "🔍"],
  ["Sélection du modèle IA", "🧠"],
  ["Mobilisation de l'agent", "🤖"],
  ["Exécution en cours", "⚡"],
]

type Message = {
  id: number
  role: "system" | "user" | "assistant"
  text: string
  time: string
  model?: ModelId
  files?: { name: string; type: string; size: string }[]
}

const WELCOME: Message = {
  id: 0, role: "system",
  time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  text: "👋 Bienvenue sur Maestro. Dis-moi ce que tu veux accomplir.",
}

const SUGGESTIONS = [
  "📧 Résume mes emails importants",
  "👥 Point sur mon équipe",
  "💻 Crée un dashboard audits",
  "🛒 Commande mes courses",
  "📊 Rapport mensuel",
  "📅 Organise ma journée",
]

// Simple markdown renderer
function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-[13px] font-mono">$1</code>')
    .replace(/^- (.*)/gm, '<div class="flex gap-2 ml-1"><span class="text-[var(--maestro-accent)]">•</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.*)/gm, '<div class="flex gap-2 ml-1"><span class="text-[var(--maestro-accent)] font-mono text-xs font-bold min-w-[18px]">$1.</span><span>$2</span></div>')
}

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
          <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><div className="w-2 h-2 rounded-full bg-yellow-400" /><div className="w-2 h-2 rounded-full bg-green-400" /></div>
          <span className="text-[10px] font-semibold text-[var(--maestro-muted)] font-mono">{title}</span>
        </div>
        <span className="text-[9px] text-[var(--maestro-accent)] font-mono font-bold">LIVE ⚡</span>
      </div>
      <iframe ref={iframeRef} className="w-full border-none" style={{ height }} sandbox="allow-scripts allow-same-origin" />
    </div>
  )
}

function parseResponse(text: string) {
  const artifacts: { code: string; title: string }[] = []
  let clean = text
  const artRx = /<artifact(?:\s+title="([^"]*)")?>([\s\S]*?)<\/artifact>/gi
  let m
  while ((m = artRx.exec(text)) !== null) {
    artifacts.push({ title: m[1] || "Artifact", code: m[2].trim() })
    clean = clean.replace(m[0], "")
  }
  const codeRx = /```html\s*\n([\s\S]*?)```/gi
  while ((m = codeRx.exec(clean)) !== null) {
    artifacts.push({ title: "Artifact", code: m[1].trim() })
    clean = clean.replace(m[0], "")
  }
  clean = clean.replace(/```[\s\S]*?```/g, "").trim()
  return { cleanText: clean, artifacts }
}

function ThinkingIndicator({ step }: { step: number }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0"><MaestroLogo size={18} /></div>
      <div className="bg-white rounded-2xl px-4 py-3 border border-[var(--maestro-border)] min-w-[200px]">
        {THINKING_STEPS.map(([label, icon], i) => (
          <div key={i} className={`flex items-center gap-2 text-[12px] mb-1 transition-all ${
            i < step ? "text-green-600" : i === step ? "text-[var(--maestro-accent)]" : "text-gray-300"
          }`}>
            <span className="text-sm w-5 text-center">{i < step ? "✅" : i === step ? icon : "○"}</span>
            <span className={i === step ? "font-semibold" : ""}>{label}</span>
            {i === step && <span className="flex gap-0.5 ml-1">{[0,1,2].map(j => <span key={j} className="w-1 h-1 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{ animationDelay: `${j*150}ms` }} />)}</span>}
          </div>
        ))}
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
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thinkingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping, thinkingStep])

  const [clock, setClock] = useState("")
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))
    update()
    const i = setInterval(update, 30000)
    return () => clearInterval(i)
  }, [])

  const startThinking = () => {
    setIsTyping(true)
    setThinkingStep(0)
    let s = 0
    thinkingRef.current = setInterval(() => { s++; if (s < THINKING_STEPS.length) setThinkingStep(s) }, 1200)
  }

  const stopThinking = () => {
    setIsTyping(false)
    setThinkingStep(0)
    if (thinkingRef.current) { clearInterval(thinkingRef.current); thinkingRef.current = null }
  }

  const copyText = (id: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const newChat = () => {
    setMessages([WELCOME])
    setAttachments([])
  }

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      stopThinking()
    }
  }

  const retry = (msgId: number) => {
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx <= 0) return
    const prevUser = messages.slice(0, idx).reverse().find(m => m.role === "user")
    if (prevUser) {
      setMessages(p => p.filter(m => m.id !== msgId))
      send(prevUser.text)
    }
  }

  const send = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() && attachments.length === 0) return

    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    const fileInfo = attachments.map(f => ({ name: f.name, type: f.type, size: `${(f.size / 1024).toFixed(1)}KB` }))
    const userMsg: Message = { id: Date.now(), role: "user", text: msgText, time: now, files: fileInfo.length > 0 ? fileInfo : undefined }
    setMessages(p => [...p, userMsg])
    setInput("")
    setAttachments([])
    startThinking()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = [...messages.filter(m => m.role !== "system"), userMsg].map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.files ? `${m.text}\n\n[Fichiers joints : ${m.files.map(f => f.name).join(", ")}]` : m.text,
      }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      })

      const data = await res.json()
      stopThinking()

      setMessages(p => [...p, {
        id: Date.now() + 1, role: "assistant" as const,
        model: (data.model || "claude-sonnet") as ModelId,
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        text: data.error ? "⚠️ Erreur de connexion. Réessaie." : data.text,
      }])
    } catch (e: unknown) {
      stopThinking()
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages(p => [...p, {
          id: Date.now() + 1, role: "assistant" as const, model: "claude-sonnet" as ModelId,
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: "⚠️ Impossible de contacter le serveur.",
        }])
      }
    }
    abortRef.current = null
  }

  const getModel = (id?: ModelId) => MODELS.find(m => m.id === id)

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--maestro-cream)]">
      {/* Header */}
      <header className="bg-[var(--maestro-primary)] px-4 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <a href="/dashboard"><MaestroLogo size={26} /></a>
          <div>
            <div className="text-white text-[14px] font-bold tracking-tight">Chat Maestro</div>
            <div className="text-white/40 text-[8px] font-mono tracking-[0.08em]">{clock} · {MODELS.length} MODÈLES</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={newChat} className="text-white/60 text-[11px] font-medium px-2 py-1 rounded-lg hover:bg-white/10 transition-colors" title="Nouveau chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button onClick={() => setShowModels(!showModels)} className="bg-white/10 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg">
            🧠 {showModels ? "▴" : "▾"}
          </button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {showModels && (
        <div className="bg-white border-b border-[var(--maestro-border)] px-3 py-2 flex flex-wrap gap-1 shrink-0">
          {MODELS.map(m => (
            <div key={m.id} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border" style={{ background: `${m.color}08`, borderColor: `${m.color}20` }}>
              <span>{m.icon}</span><span className="font-semibold" style={{ color: m.color }}>{m.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-3 py-3 flex flex-col gap-3 scroll-smooth">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === "system" && (
              <div className="bg-blue-50 rounded-2xl p-3.5 border border-blue-200 animate-fadeIn">
                <div className="text-[13px] text-blue-800 leading-relaxed">{msg.text}</div>
              </div>
            )}

            {msg.role === "user" && (
              <div className="flex justify-end animate-fadeIn">
                <div className="bg-[var(--maestro-primary)] text-white rounded-[14px_14px_4px_14px] px-3.5 py-2.5 max-w-[85%]">
                  <div className="text-[13px] leading-relaxed">{msg.text}</div>
                  {msg.files && msg.files.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {msg.files.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                          <span className="text-[10px] text-white/80 truncate">{f.name}</span>
                          <span className="text-[9px] text-white/40 font-mono">{f.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[9px] text-white/30 mt-1 text-right font-mono">{msg.time}</div>
                </div>
              </div>
            )}

            {msg.role === "assistant" && (() => {
              const mdl = getModel(msg.model)
              const { cleanText, artifacts } = parseResponse(msg.text)
              return (
                <div className="flex gap-2 animate-fadeIn">
                  <div className="w-6 h-6 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0 mt-0.5"><MaestroLogo size={16} /></div>
                  <div className="flex-1 max-w-[calc(100%-36px)]">
                    <div className="flex items-center gap-1.5 mb-1">
                      {mdl && <span className="text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded" style={{ background: `${mdl.color}12`, color: mdl.color }}>{mdl.icon} {mdl.name}</span>}
                      <span className="text-[9px] text-[var(--maestro-muted)] font-mono">{msg.time}</span>
                    </div>
                    <div className="bg-white rounded-[4px_14px_14px_14px] p-3.5 border border-[var(--maestro-border)] shadow-sm">
                      {cleanText && <div className="text-[13px] text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanText) }} />}
                      {artifacts.map((a, i) => <ArtifactRenderer key={i} code={a.code} title={a.title} />)}

                      {/* Action bar */}
                      <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-[var(--maestro-surface)]">
                        <button onClick={() => copyText(msg.id, msg.text)} className="text-[10px] text-[var(--maestro-muted)] hover:text-[var(--maestro-primary)] px-2 py-1 rounded-md hover:bg-[var(--maestro-surface)] transition-colors flex items-center gap-1">
                          {copiedId === msg.id ? (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg> Copié</>
                          ) : (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copier</>
                          )}
                        </button>
                        <button onClick={() => retry(msg.id)} className="text-[10px] text-[var(--maestro-muted)] hover:text-[var(--maestro-primary)] px-2 py-1 rounded-md hover:bg-[var(--maestro-surface)] transition-colors flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Retry
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}

        {isTyping && <ThinkingIndicator step={thinkingStep} />}

        {messages.length <= 1 && !isTyping && (
          <div className="mt-2 animate-fadeIn">
            <div className="text-[11px] font-semibold text-[var(--maestro-muted)] mb-2">Suggestions :</div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="bg-white text-[var(--maestro-primary)] text-[11px] font-medium px-3 py-2 rounded-xl border border-[var(--maestro-border)] hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-3 py-2 bg-[var(--maestro-surface)] border-t border-[var(--maestro-border)] flex gap-2 flex-wrap shrink-0">
          {attachments.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1.5 border border-[var(--maestro-border)] text-[11px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--maestro-accent)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
              <span className="text-[var(--maestro-primary)] font-medium truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-[var(--maestro-muted)] hover:text-red-500 ml-0.5">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 py-2 bg-white border-t border-[var(--maestro-border)] shrink-0 mb-14">
        <div className="flex gap-1.5 items-center">
          {/* File upload */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv,.json,.md" />
          <button onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--maestro-surface)] border border-[var(--maestro-border)] shrink-0 touch-target hover:border-[var(--maestro-accent)] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--maestro-muted)" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          {/* Text input */}
          <input type="text" placeholder="Parle à Maestro..."
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            disabled={isTyping}
            className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[14px] outline-none bg-[var(--maestro-cream)] text-[var(--maestro-primary)] focus:border-[var(--maestro-accent)] transition-colors disabled:opacity-50" />

          {/* Send or Stop */}
          {isTyping ? (
            <button onClick={stopGeneration}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500 text-white shrink-0 touch-target">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            </button>
          ) : (
            <button onClick={() => send()} disabled={!input.trim() && attachments.length === 0}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--maestro-primary)] text-white shrink-0 touch-target disabled:opacity-30 hover:bg-[var(--maestro-primary-light)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          )}
        </div>
      </div>

      <NavBar />
    </div>
  )
}
