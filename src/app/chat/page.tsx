"use client"

import { useState, useRef, useEffect } from "react"
import { UserButton, useAuth } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"
import NavBar from "@/components/NavBar"
import {
  StoredMessage, getAllChats, createChat, updateChat,
  setActiveChatId, shouldCompact, applyCompaction, getCompactionContext
} from "@/lib/chatStorage"

const MODELS = [
  { id: "claude-opus", name: "Claude Opus", icon: "🧠", color: "#8B5CF6" },
  { id: "claude-sonnet", name: "Claude Sonnet", icon: "⚡", color: "#6366F1" },
  { id: "claude-haiku", name: "Claude Haiku", icon: "🐇", color: "#A78BFA" },
  { id: "gpt4o", name: "GPT-4o", icon: "🤖", color: "#10B981" },
  { id: "gemini", name: "Gemini 2.5", icon: "💎", color: "#3B82F6" },
  { id: "dalle", name: "DALL-E 3", icon: "🎨", color: "#EC4899" },
]
const SUGGESTIONS = ["📧 Emails importants", "👥 Point équipe", "💻 Dashboard audits", "🛒 Courses", "📊 Rapport mensuel", "📅 Ma journée"]

function renderMd(t: string) {
  return t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-[14px] font-mono">$1</code>')
    .replace(/^- (.*)/gm, '<div class="flex gap-2 ml-1"><span class="text-[var(--maestro-accent)]">•</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.*)/gm, '<div class="flex gap-2 ml-1"><span class="text-[var(--maestro-accent)] font-mono text-xs font-bold min-w-[16px]">$1.</span><span>$2</span></div>')
}

function parseResponse(text: string) {
  const artifacts: { code: string; title: string }[] = []
  let clean = text
  let m
  const r1 = /<artifact(?:\s+title="([^"]*)")?>([\s\S]*?)<\/artifact>/gi
  while ((m = r1.exec(text)) !== null) { artifacts.push({ title: m[1] || "Artifact", code: m[2].trim() }); clean = clean.replace(m[0], "") }
  const r2 = /```html\s*\n([\s\S]*?)```/gi
  while ((m = r2.exec(clean)) !== null) { artifacts.push({ title: "Artifact", code: m[1].trim() }); clean = clean.replace(m[0], "") }
  clean = clean.replace(/```[\s\S]*?```/g, "").trim()
  return { cleanText: clean, artifacts }
}

function ArtifactRenderer({ code, title }: { code: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [h, setH] = useState(280)
  useEffect(() => {
    if (ref.current?.contentDocument) {
      const doc = ref.current.contentDocument; doc.open(); doc.write(code); doc.close()
      setTimeout(() => { if (ref.current?.contentDocument?.body) setH(Math.min(Math.max(ref.current.contentDocument.body.scrollHeight + 20, 200), 600)) }, 500)
    }
  }, [code])
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-[var(--maestro-border)]">
      <div className="px-3 py-1.5 bg-[var(--maestro-surface)] border-b border-[var(--maestro-border)] flex items-center justify-between">
        <div className="flex items-center gap-2"><div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-400"/><div className="w-2 h-2 rounded-full bg-yellow-400"/><div className="w-2 h-2 rounded-full bg-green-400"/></div><span className="text-[10px] font-mono text-[var(--maestro-muted)]">{title}</span></div>
        <span className="text-[9px] text-[var(--maestro-accent)] font-mono font-bold">LIVE ⚡</span>
      </div>
      <iframe ref={ref} className="w-full border-none" style={{ height: h }} sandbox="allow-scripts allow-same-origin"/>
    </div>
  )
}

export default function ChatPage() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [thinkStatus, setThinkStatus] = useState("")
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [codeMode, setCodeMode] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("claude-sonnet")
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [clock, setClock] = useState("")
  useEffect(() => { const u = () => setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })); u(); const i = setInterval(u, 30000); return () => clearInterval(i) }, [])

  // SINGLE CONVERSATION: Load the one and only conversation, or create it
  // WAIT for Clerk auth to be ready before calling API
  useEffect(() => {
    if (!authLoaded || !isSignedIn) return
    async function init() {
      try {
        const allExisting = await getAllChats()
        if (allExisting.length > 0) {
          const main = allExisting[0]
          setChatId(main.id)
          setActiveChatId(main.id)
          setMessages(main.messages || [])
          setLoaded(true)
          return
        }
        // First time ever — create THE conversation
        const newChat = await createChat()
        setChatId(newChat.id)
        const welcomeMsg: StoredMessage = {
          id: 0, role: "system",
          text: "👋 Bienvenue. Je suis Maestro, ton orchestrateur IA personnel. Dis-moi ce que tu veux accomplir.",
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        }
        setMessages([welcomeMsg])
        await updateChat(newChat.id, [welcomeMsg], "Maestro")
        setLoaded(true)
      } catch (e) {
        console.error("Init error:", e)
        setLoaded(true)
      }
    }
    init()
  }, [authLoaded, isSignedIn])

  // Save messages whenever they change (debounced)
  const messagesRef = useRef(messages)
  const chatIdRef = useRef(chatId)
  messagesRef.current = messages
  chatIdRef.current = chatId

  useEffect(() => {
    if (!chatId || !loaded || messages.length === 0) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateChat(chatId, messages, "Maestro")
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [messages, chatId, loaded])

  // Save on page close/navigation
  useEffect(() => {
    const saveNow = () => {
      if (chatIdRef.current && messagesRef.current.length > 0) {
        fetch(`/api/conversations/${chatIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: messagesRef.current, title: "Maestro" }),
          keepalive: true, // ensures request completes even after page closes
        }).catch(() => {})
      }
    }
    window.addEventListener("beforeunload", saveNow)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveNow()
    })
    return () => {
      window.removeEventListener("beforeunload", saveNow)
    }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, isTyping, thinkStatus])

  const showToastMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const startThink = (status: string) => { setIsTyping(true); setThinkStatus(status) }
  const stopThink = () => { setIsTyping(false); setThinkStatus("") }

  // AUTO-COMPACT: triggered after assistant responds
  const autoCompact = async (updatedMessages: StoredMessage[]) => {
    if (!chatId || !shouldCompact(updatedMessages)) return
    try {
      const res = await fetch("/api/compact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      })
      const data = await res.json()
      if (data.compacted) {
        const compacted = { ...data.compacted, compactedAt: new Date().toISOString(), originalMessageCount: updatedMessages.length }
        const newMsgs = await applyCompaction(chatId, compacted, updatedMessages)
        if (newMsgs) {
          setMessages(newMsgs)
          showToastMsg(`📦 Mémoire compactée — ${updatedMessages.length} msgs → ${newMsgs.length}`)
        }
      }
    } catch { /* silent */ }
  }

  const send = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() && attachments.length === 0) return
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    const fileInfo = attachments.map(f => ({ name: f.name, type: f.type, size: `${(f.size/1024).toFixed(1)}KB` }))
    const userMsg: StoredMessage = { id: Date.now(), role: "user", text: msgText, time: now, files: fileInfo.length > 0 ? fileInfo : undefined }

    // IMMEDIATE SAVE — persist user message right away before AI responds
    const updatedMsgs = [...messages, userMsg]
    setMessages(updatedMsgs)
    setInput(""); setAttachments([])
    if (chatId) await updateChat(chatId, updatedMsgs, "Maestro")

    startThink("Réception de ton message...")

    const controller = new AbortController(); abortRef.current = controller
    try {
      let assistantMsg: StoredMessage

      if (codeMode) {
        setThinkStatus("🖥️ Envoi à Claude Code sur Hetzner...")
        const res = await fetch("/api/code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: msgText }),
          signal: controller.signal,
        })
        const data = await res.json()
        stopThink()
        assistantMsg = {
          id: Date.now() + 1, role: "assistant", model: "claude-code",
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: data.success ? (data.output || "✅ Claude Code a exécuté la tâche.") : `⚠️ ${data.error || "Erreur Claude Code"}`,
        }
      } else {
        // Step 1: Check memory
        setThinkStatus("🧠 Consultation de ta mémoire...")

        // Build message history with proper multimodal content
        const hist = []
        for (const m of [...messages.filter(m => m.role !== "system"), userMsg]) {
          const role = m.role === "assistant" ? "assistant" : "user"
          hist.push({ role, content: m.text || "" })
        }

        // Convert current attachments to base64 for vision
        const imageBlocks: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[] = []
        for (const file of attachments) {
          if (file.type.startsWith("image/")) {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve((reader.result as string).split(",")[1])
              reader.readAsDataURL(file)
            })
            imageBlocks.push({
              type: "image",
              source: { type: "base64", media_type: file.type, data: base64 }
            })
          } else {
            // For non-image files, read as text if possible
            try {
              const text = await file.text()
              imageBlocks.push({ type: "text", text: `[Contenu de ${file.name}]:\n${text.slice(0, 10000)}` })
            } catch {
              imageBlocks.push({ type: "text", text: `[Fichier: ${file.name} (${file.type})]` })
            }
          }
        }

        // If there are attachments, modify the last user message to include them
        if (imageBlocks.length > 0) {
          const lastMsg = hist[hist.length - 1]
          const contentBlocks = [
            ...imageBlocks,
            { type: "text", text: lastMsg.content || "Analyse cette image." }
          ]
          hist[hist.length - 1] = { role: "user", content: contentBlocks as unknown as string }
        }

        const compCtx = chatId ? await getCompactionContext(chatId) : null

        // Step 2: Call Claude
        setThinkStatus(`⚡ ${selectedModel === "claude-opus" ? "Claude Opus" : selectedModel === "claude-haiku" ? "Claude Haiku" : "Claude Sonnet"} réfléchit...`)
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: hist, compactionContext: compCtx, model: selectedModel }),
          signal: controller.signal,
        })

        setThinkStatus("📝 Rédaction de la réponse...")
        const data = await res.json()
        stopThink()

        const usage = data.usage ? { input: data.usage.input_tokens || 0, output: data.usage.output_tokens || 0 } : undefined

        assistantMsg = {
          id: Date.now() + 1, role: "assistant",
          model: data.model || "claude-sonnet",
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          text: data.error ? "⚠️ Erreur. Réessaie." : data.text,
          tokens: usage,
        }
        // Memory extraction in background
        fetch("/api/memory/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userMessage: msgText, assistantMessage: assistantMsg.text }),
        }).then(r => r.json()).then(d => {
          if (d.count > 0) showToastMsg(`🧠 ${d.count} souvenir${d.count > 1 ? "s" : ""} capturé${d.count > 1 ? "s" : ""}`)
        }).catch(() => {})
      }

      setMessages(p => {
        const updated = [...p, assistantMsg]
        autoCompact(updated)
        return updated
      })
    } catch (e: unknown) {
      stopThink()
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages(p => [...p, { id: Date.now()+1, role: "assistant" as const, model: codeMode ? "claude-code" : "claude-sonnet", time: new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}), text: "⚠️ Serveur injoignable." }])
      }
    }
    abortRef.current = null
  }

  const nonSystemMsgs = messages.filter(m => m.role !== "system")
  const getModel = (id?: string) => {
    if (id === "claude-code") return { id: "claude-code", name: "Claude Code", icon: "</>", color: "#22C55E" }
    return MODELS.find(m => m.id === id)
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--maestro-cream)]">
      {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-5 py-2.5 rounded-xl text-[12px] font-medium z-50 shadow-xl max-w-[85vw] animate-slideDown">{toast}</div>}

      {/* Header — clean, no sidebar, no new chat */}
      <header className={`px-3 h-12 flex items-center justify-between shrink-0 transition-colors duration-300 ${codeMode ? "bg-[#0D1117]" : "bg-[var(--maestro-primary)]"}`}>
        <div className="flex items-center gap-2">
          <a href="/dashboard"><MaestroLogo size={24} /></a>
          <div>
            <div className="text-white text-[13px] font-bold tracking-tight">{codeMode ? "Claude Code" : "Maestro"}</div>
            <div className={`text-[8px] font-mono ${codeMode ? "text-green-400/70" : "text-white/40"}`}>{codeMode ? "maestro-cli · Hetzner" : `${clock} · conversation permanente`}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Model selector */}
          {!codeMode && (
            <div className="relative">
              <button onClick={() => setShowModelPicker(p => !p)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold font-mono bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-all">
                {selectedModel === "claude-opus" ? "🧠" : selectedModel === "claude-haiku" ? "🐇" : "⚡"}
                {selectedModel === "claude-opus" ? "Opus" : selectedModel === "claude-haiku" ? "Haiku" : "Sonnet"}
              </button>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-[var(--maestro-border)] overflow-hidden z-50 min-w-[160px]">
                  {[
                    { id: "claude-sonnet", name: "Sonnet", icon: "⚡", desc: "Rapide & intelligent" },
                    { id: "claude-opus", name: "Opus", icon: "🧠", desc: "Le plus puissant" },
                    { id: "claude-haiku", name: "Haiku", icon: "🐇", desc: "Ultra-rapide" },
                  ].map(m => (
                    <button key={m.id} onClick={() => { setSelectedModel(m.id); setShowModelPicker(false) }}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-[var(--maestro-surface)] transition-colors ${selectedModel === m.id ? "bg-[var(--maestro-surface)]" : ""}`}>
                      <span className="text-sm">{m.icon}</span>
                      <div>
                        <div className="text-[12px] font-semibold text-[var(--maestro-primary)]">{m.name}</div>
                        <div className="text-[9px] text-[var(--maestro-muted)]">{m.desc}</div>
                      </div>
                      {selectedModel === m.id && <span className="ml-auto text-[var(--maestro-accent)] text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setCodeMode(p => !p)}
            title={codeMode ? "Revenir au chat" : "Passer en mode Claude Code"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
              codeMode
                ? "bg-green-500/20 text-green-400 border border-green-500/40"
                : "bg-white/10 text-white/60 hover:text-white hover:bg-white/15"
            }`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            {codeMode ? "CC" : "</>"}
          </button>
          {nonSystemMsgs.length > 0 && (
            <span className="text-white/30 text-[9px] font-mono px-1.5">{nonSystemMsgs.length} msgs</span>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Messages area — full width */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto px-3 py-3 flex flex-col gap-3 scroll-smooth">
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.role === "system" && <div className="bg-blue-50 rounded-2xl p-3 border border-blue-200 text-[14px] text-blue-800 leading-relaxed animate-fadeIn">{msg.text}</div>}
              {msg.role === "user" && (
                <div className="flex justify-end animate-fadeIn">
                  <div className="bg-[var(--maestro-primary)] text-white rounded-[14px_14px_4px_14px] px-3.5 py-2.5 max-w-[85%]">
                    <div className="text-[16px] leading-relaxed">{msg.text}</div>
                    {msg.files && <div className="mt-1.5 flex flex-col gap-1">{msg.files.map((f,i) => <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1 text-[10px] text-white/80"><span>📎</span>{f.name}<span className="text-white/40 font-mono">{f.size}</span></div>)}</div>}
                    <div className="text-[9px] text-white/30 mt-1 text-right font-mono">{msg.time}</div>
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (() => {
                const mdl = getModel(msg.model); const { cleanText, artifacts } = parseResponse(msg.text)
                return (
                  <div className="flex gap-2 animate-fadeIn">
                    <div className="w-6 h-6 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0 mt-0.5"><MaestroLogo size={16}/></div>
                    <div className="flex-1 max-w-[calc(100%-36px)]">
                      <div className="flex items-center gap-1.5 mb-1">
                        {mdl && <span className="text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded" style={{ background: `${mdl.color}12`, color: mdl.color }}>{mdl.icon} {mdl.name}</span>}
                        <span className="text-[9px] text-[var(--maestro-muted)] font-mono">{msg.time}</span>
                      </div>
                      <div className="bg-white rounded-[4px_14px_14px_14px] p-3 border border-[var(--maestro-border)] shadow-sm">
                        {cleanText && <div className="text-[20px] text-[#1A2F2A] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMd(cleanText) }}/>}
                        {artifacts.map((a,i) => <ArtifactRenderer key={i} code={a.code} title={a.title}/>)}
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[var(--maestro-surface)]">
                          <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 2000) }}
                            className="text-[10px] text-[var(--maestro-muted)] hover:text-[var(--maestro-primary)] px-1.5 py-0.5 rounded hover:bg-[var(--maestro-surface)] transition-colors">
                            {copiedId === msg.id ? "✅ Copié" : "📋 Copier"}
                          </button>
                          <button onClick={() => { const prev = messages.slice(0, messages.indexOf(msg)).reverse().find(m=>m.role==="user"); if(prev) { setMessages(p=>p.filter(m=>m.id!==msg.id)); send(prev.text) }}}
                            className="text-[10px] text-[var(--maestro-muted)] hover:text-[var(--maestro-primary)] px-1.5 py-0.5 rounded hover:bg-[var(--maestro-surface)] transition-colors">🔄 Retry</button>
                          {msg.tokens && (
                            <span className="text-[9px] text-[var(--maestro-muted)] font-mono ml-auto">
                              ↑{msg.tokens.input} ↓{msg.tokens.output} tokens
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2"><div className="w-6 h-6 rounded-lg bg-[var(--maestro-surface)] flex items-center justify-center shrink-0"><MaestroLogo size={16}/></div>
              <div className="bg-white rounded-2xl px-3.5 py-2.5 border border-[var(--maestro-border)] min-w-[180px]">
                <div className="flex items-center gap-2 text-[12px] text-[var(--maestro-primary)]">
                  <span className="flex gap-0.5">{[0,1,2].map(j=><span key={j} className="w-1.5 h-1.5 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{animationDelay:`${j*150}ms`}}/>)}</span>
                  <span className="font-medium">{thinkStatus}</span>
                </div>
                <div className="text-[10px] text-[var(--maestro-muted)] mt-1">Tu peux quitter, ton message est sauvé</div>
              </div>
            </div>
          )}
          {nonSystemMsgs.length === 0 && !isTyping && (
            <div className="mt-2"><div className="text-[11px] font-semibold text-[var(--maestro-muted)] mb-2">Suggestions :</div>
              <div className="flex flex-wrap gap-1.5">{SUGGESTIONS.map((s,i) => <button key={i} onClick={()=>send(s)} className="bg-white text-[var(--maestro-primary)] text-[11px] font-medium px-3 py-2 rounded-xl border border-[var(--maestro-border)] hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">{s}</button>)}</div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-3 py-1.5 bg-[var(--maestro-surface)] border-t border-[var(--maestro-border)] flex gap-1.5 flex-wrap shrink-0">
            {attachments.map((f,i) => <div key={i} className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-[var(--maestro-border)] text-[10px]"><span>📎</span><span className="truncate max-w-[100px]">{f.name}</span><button onClick={()=>setAttachments(p=>p.filter((_,j)=>j!==i))} className="text-[var(--maestro-muted)] hover:text-red-500">✕</button></div>)}
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-2 bg-white border-t border-[var(--maestro-border)] shrink-0 mb-14">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) setAttachments(p => [...p, ...Array.from(e.target.files!)]) }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv,.json,.md"/>
          <div className="flex gap-1.5 items-center">
            <button onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--maestro-surface)] border border-[var(--maestro-border)] shrink-0 touch-target hover:border-[var(--maestro-accent)] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--maestro-muted)" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input type="text" placeholder={codeMode ? "Décris la modification à apporter au code..." : "Parle à Maestro..."} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} disabled={isTyping}
              className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[14px] outline-none bg-[var(--maestro-cream)] text-[var(--maestro-primary)] focus:border-[var(--maestro-accent)] transition-colors disabled:opacity-50"/>
            {isTyping ? (
              <button onClick={() => { abortRef.current?.abort(); stopThink() }} className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500 shrink-0 touch-target">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              </button>
            ) : (
              <button onClick={()=>send()} disabled={!input.trim()&&attachments.length===0}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--maestro-primary)] shrink-0 touch-target disabled:opacity-30 hover:bg-[var(--maestro-primary-light)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <NavBar/>
    </div>
  )
}
