"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"
import NavBar from "@/components/NavBar"
import {
  StoredMessage, ChatSession, getAllChats, getChat, createChat, updateChat, deleteChat,
  getActiveChatId, setActiveChatId, shouldCompact, applyCompaction, getCompactionContext
} from "@/lib/chatStorage"

type ModelId = "claude-opus" | "claude-sonnet" | "claude-haiku" | "gpt4o" | "gemini" | "dalle"
const MODELS = [
  { id: "claude-opus", name: "Claude Opus", icon: "🧠", color: "#8B5CF6" },
  { id: "claude-sonnet", name: "Claude Sonnet", icon: "⚡", color: "#6366F1" },
  { id: "claude-haiku", name: "Claude Haiku", icon: "🐇", color: "#A78BFA" },
  { id: "gpt4o", name: "GPT-4o", icon: "🤖", color: "#10B981" },
  { id: "gemini", name: "Gemini 2.5", icon: "💎", color: "#3B82F6" },
  { id: "dalle", name: "DALL-E 3", icon: "🎨", color: "#EC4899" },
]
const THINKING = [["Analyse", "🔍"], ["Modèle IA", "🧠"], ["Agent", "🤖"], ["Exécution", "⚡"]]
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
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [thinkStep, setThinkStep] = useState(0)
  const [showModels, setShowModels] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [compacting, setCompacting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [allChats, setAllChats] = useState<ChatSession[]>([])
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const thinkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [clock, setClock] = useState("")
  useEffect(() => { const u = () => setClock(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })); u(); const i = setInterval(u, 30000); return () => clearInterval(i) }, [])

  const refreshChatList = useCallback(async () => {
    const chats = await getAllChats()
    setAllChats(chats)
  }, [])

  // Load or create chat on mount
  useEffect(() => {
    async function init() {
      const activeId = getActiveChatId()
      if (activeId) {
        const chat = await getChat(activeId)
        if (chat) { setChatId(activeId); setMessages(chat.messages); setLoaded(true); refreshChatList(); return }
      }
      const newChatObj = await createChat()
      setChatId(newChatObj.id)
      const welcomeMsg: StoredMessage = { id: 0, role: "system", text: "👋 Bienvenue sur Maestro. Dis-moi ce que tu veux accomplir.", time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) }
      setMessages([welcomeMsg])
      await updateChat(newChatObj.id, [welcomeMsg])
      setLoaded(true)
      refreshChatList()
    }
    init()
  }, [refreshChatList])

  // Save messages whenever they change (debounced)
  useEffect(() => {
    if (!chatId || !loaded || messages.length === 0) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateChat(chatId, messages)
      refreshChatList()
    }, 500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [messages, chatId, loaded, refreshChatList])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, isTyping, thinkStep])

  const showToastMsg = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const startThink = () => { setIsTyping(true); setThinkStep(0); let s = 0; thinkRef.current = setInterval(() => { s++; if (s < 4) setThinkStep(s) }, 1200) }
  const stopThink = () => { setIsTyping(false); setThinkStep(0); if (thinkRef.current) { clearInterval(thinkRef.current); thinkRef.current = null } }

  const switchChat = async (id: string) => {
    const chat = await getChat(id)
    if (chat) { setChatId(id); setActiveChatId(id); setMessages(chat.messages); setShowHistory(false) }
  }

  const newChat = async () => {
    const chat = await createChat()
    setChatId(chat.id)
    const welcomeMsg: StoredMessage = { id: 0, role: "system", text: "👋 Nouvelle conversation. Que veux-tu accomplir ?", time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) }
    setMessages([welcomeMsg])
    await updateChat(chat.id, [welcomeMsg])
    setAttachments([])
    setShowHistory(false)
    refreshChatList()
  }

  const delChat = async (id: string) => {
    await deleteChat(id)
    if (id === chatId) await newChat()
    refreshChatList()
  }

  const doCompact = async () => {
    if (!chatId) return
    setCompacting(true)
    try {
      const res = await fetch("/api/compact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })
      const data = await res.json()
      if (data.compacted) {
        const compacted = { ...data.compacted, compactedAt: new Date().toISOString(), originalMessageCount: messages.length }
        const newMsgs = await applyCompaction(chatId, compacted, messages)
        if (newMsgs) { setMessages(newMsgs); showToastMsg(`📦 ${messages.length} messages compactés → ${newMsgs.length} conservés`) }
      }
    } catch { showToastMsg("⚠️ Erreur de compaction") }
    setCompacting(false)
  }

  const send = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() && attachments.length === 0) return
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    const fileInfo = attachments.map(f => ({ name: f.name, type: f.type, size: `${(f.size/1024).toFixed(1)}KB` }))
    const userMsg: StoredMessage = { id: Date.now(), role: "user", text: msgText, time: now, files: fileInfo.length > 0 ? fileInfo : undefined }
    setMessages(p => [...p, userMsg])
    setInput(""); setAttachments([])
    startThink()

    const controller = new AbortController(); abortRef.current = controller
    try {
      const hist = [...messages.filter(m => m.role !== "system"), userMsg].map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.files ? `${m.text}\n[Fichiers: ${m.files.map(f=>f.name).join(", ")}]` : m.text }))
      const compCtx = chatId ? await getCompactionContext(chatId) : null

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: hist, compactionContext: compCtx }),
        signal: controller.signal,
      })
      const data = await res.json()
      stopThink()
      const assistantMsg: StoredMessage = {
        id: Date.now() + 1, role: "assistant",
        model: data.model || "claude-sonnet",
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        text: data.error ? "⚠️ Erreur. Réessaie." : data.text,
      }
      setMessages(p => {
        const updated = [...p, assistantMsg]
        if (shouldCompact(updated)) showToastMsg("💡 Conversation longue — pense à compacter (bouton 📦)")
        return updated
      })

      // Extraction mémoire silencieuse en background
      fetch("/api/memory/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: msgText, assistantMessage: assistantMsg.text }),
      }).then(r => r.json()).then(d => {
        if (d.count > 0) showToastMsg(`🧠 ${d.count} souvenir${d.count > 1 ? "s" : ""} capturé${d.count > 1 ? "s" : ""}`)
      }).catch(() => {})
    } catch (e: unknown) {
      stopThink()
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages(p => [...p, { id: Date.now()+1, role: "assistant" as const, model: "claude-sonnet", time: new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}), text: "⚠️ Serveur injoignable." }])
      }
    }
    abortRef.current = null
  }

  const nonSystemMsgs = messages.filter(m => m.role !== "system")
  const getModel = (id?: string) => MODELS.find(m => m.id === id)

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--maestro-cream)]">
      {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-5 py-2.5 rounded-xl text-[12px] font-medium z-50 shadow-xl max-w-[85vw] animate-slideDown">{toast}</div>}

      {/* Header */}
      <header className="bg-[var(--maestro-primary)] px-3 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)} className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <a href="/dashboard"><MaestroLogo size={24} /></a>
          <div>
            <div className="text-white text-[13px] font-bold tracking-tight">Maestro</div>
            <div className="text-white/40 text-[8px] font-mono">{clock} · {MODELS.length} IA</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {nonSystemMsgs.length >= 20 && (
            <button onClick={doCompact} disabled={compacting}
              className="text-white/60 hover:text-white text-[10px] font-mono px-2 py-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
              {compacting ? "⏳" : "📦"} {compacting ? "..." : nonSystemMsgs.length}
            </button>
          )}
          <button onClick={newChat} className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button onClick={() => setShowModels(!showModels)} className="bg-white/10 text-white text-[10px] font-semibold px-2 py-1 rounded-lg">🧠</button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {showModels && (
        <div className="bg-white border-b border-[var(--maestro-border)] px-3 py-2 flex flex-wrap gap-1 shrink-0 animate-scaleIn">
          {MODELS.map(m => <div key={m.id} className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] border" style={{ background: `${m.color}08`, borderColor: `${m.color}20` }}><span>{m.icon}</span><span className="font-semibold" style={{ color: m.color }}>{m.name}</span></div>)}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Chat history sidebar */}
        {showHistory && (
          <div className="w-64 bg-white border-r border-[var(--maestro-border)] flex flex-col shrink-0 animate-fadeIn overflow-hidden">
            <div className="p-3 border-b border-[var(--maestro-border)]">
              <button onClick={newChat} className="w-full bg-[var(--maestro-primary)] text-white rounded-xl py-2 text-[12px] font-semibold">+ Nouvelle conversation</button>
            </div>
            <div className="flex-1 overflow-auto">
              {allChats.map(c => (
                <div key={c.id} onClick={() => switchChat(c.id)}
                  className={`px-3 py-2.5 border-b border-[var(--maestro-surface)] cursor-pointer transition-colors flex items-center gap-2 ${c.id === chatId ? "bg-[var(--maestro-accent-bg)]" : "hover:bg-[var(--maestro-surface)]"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--maestro-primary)] truncate">{c.title}</div>
                    <div className="text-[10px] text-[var(--maestro-muted)] font-mono">{c.messageCount} msgs · {new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); delChat(c.id) }} className="text-[var(--maestro-muted)] hover:text-red-500 text-xs shrink-0">✕</button>
                </div>
              ))}
              {allChats.length === 0 && <div className="p-4 text-center text-[12px] text-[var(--maestro-muted)]">Aucune conversation</div>}
            </div>
          </div>
        )}

        {/* Messages area */}
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
                  {THINKING.map(([l,ic],i) => <div key={i} className={`flex items-center gap-1.5 text-[11px] mb-0.5 ${i<thinkStep?"text-green-600":i===thinkStep?"text-[var(--maestro-accent)]":"text-gray-300"}`}><span className="w-4 text-center text-xs">{i<thinkStep?"✅":i===thinkStep?ic:"○"}</span><span className={i===thinkStep?"font-semibold":""}>{l}</span>{i===thinkStep&&<span className="flex gap-0.5 ml-0.5">{[0,1,2].map(j=><span key={j} className="w-1 h-1 rounded-full bg-[var(--maestro-accent)] animate-bounce" style={{animationDelay:`${j*150}ms`}}/>)}</span>}</div>)}
                </div>
              </div>
            )}
            {messages.filter(m=>m.role!=="system").length === 0 && !isTyping && (
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
              <input type="text" placeholder="Parle à Maestro..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} disabled={isTyping}
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
      </div>
      <NavBar/>
    </div>
  )
}
