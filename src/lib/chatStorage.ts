// Chat persistence — PostgreSQL via API routes
// All operations are async and call /api/conversations

export type StoredMessage = {
  id: number
  role: "system" | "user" | "assistant"
  text: string
  time: string
  model?: string
  files?: { name: string; type: string; size: string }[]
}

export type ChatSession = {
  id: string
  title: string
  messages: StoredMessage[]
  createdAt: string
  updatedAt: string
  compactedMemory?: CompactedMemory
  messageCount: number
}

export type CompactedMemory = {
  summary: string
  decisions: string[]
  tasks: string[]
  learnings: string[]
  pending: string[]
  context: string
  compactedAt: string
  originalMessageCount: number
}

const MAX_MESSAGES_BEFORE_COMPACT = 30
const KEEP_RECENT_AFTER_COMPACT = 6

// Active chat ID — kept in localStorage (device-specific preference)
export function getActiveChatId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("maestro_active_chat")
}

export function setActiveChatId(id: string) {
  if (typeof window === "undefined") return
  localStorage.setItem("maestro_active_chat", id)
}

function clearActiveChatId() {
  if (typeof window === "undefined") return
  localStorage.removeItem("maestro_active_chat")
}

// API calls
export async function getAllChats(): Promise<ChatSession[]> {
  const res = await fetch("/api/conversations")
  if (!res.ok) return []
  return res.json()
}

export async function getChat(id: string): Promise<ChatSession | null> {
  const res = await fetch(`/api/conversations/${id}`)
  if (!res.ok) return null
  return res.json()
}

export async function createChat(): Promise<ChatSession> {
  const id = `chat_${Date.now()}`
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  })
  const chat = await res.json()
  setActiveChatId(chat.id)
  return chat
}

export async function updateChat(id: string, messages: StoredMessage[], title?: string) {
  // Auto-title from first user message
  let autoTitle = title
  if (!autoTitle) {
    const firstUser = messages.find(m => m.role === "user")
    if (firstUser) {
      autoTitle = firstUser.text.substring(0, 50) + (firstUser.text.length > 50 ? "..." : "")
    }
  }
  await fetch(`/api/conversations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, title: autoTitle }),
  })
}

export async function deleteChat(id: string) {
  await fetch(`/api/conversations/${id}`, { method: "DELETE" })
  if (getActiveChatId() === id) clearActiveChatId()
}

export function shouldCompact(messages: StoredMessage[]): boolean {
  const nonSystemMessages = messages.filter(m => m.role !== "system")
  return nonSystemMessages.length >= MAX_MESSAGES_BEFORE_COMPACT
}

export async function applyCompaction(chatId: string, compacted: CompactedMemory, messages: StoredMessage[]) {
  const recentMessages = messages.slice(-KEEP_RECENT_AFTER_COMPACT)
  const compactedSystemMsg: StoredMessage = {
    id: Date.now(),
    role: "system",
    text: `📦 Mémoire compactée (${compacted.originalMessageCount} messages → résumé)\n\n${compacted.summary}\n\nDécisions : ${compacted.decisions.join(", ") || "—"}\nEn cours : ${compacted.tasks.join(", ") || "—"}\nEn attente : ${compacted.pending.join(", ") || "—"}`,
    time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  }
  const newMessages = [compactedSystemMsg, ...recentMessages]
  await fetch(`/api/conversations/${chatId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: newMessages, compactedMemory: compacted }),
  })
  return newMessages
}

export async function getCompactionContext(chatId: string): Promise<string | null> {
  const chat = await getChat(chatId)
  if (!chat?.compactedMemory) return null
  const mem = chat.compactedMemory
  return `MÉMOIRE COMPACTÉE DE CETTE CONVERSATION :
Résumé : ${mem.summary}
Décisions prises : ${mem.decisions.join("; ")}
Tâches en cours : ${mem.tasks.join("; ")}
Apprentissages : ${mem.learnings.join("; ")}
En attente : ${mem.pending.join("; ")}
Contexte : ${mem.context}`
}
