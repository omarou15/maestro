// Chat persistence with compaction system
// Stores conversations in localStorage with auto-compaction

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

const STORAGE_KEY = "maestro_chats"
const ACTIVE_CHAT_KEY = "maestro_active_chat"
const MAX_MESSAGES_BEFORE_COMPACT = 30 // Compact after 30 messages
const KEEP_RECENT_AFTER_COMPACT = 6 // Keep last 6 messages after compaction

function getChats(): ChatSession[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveChats(chats: ChatSession[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}

export function getActiveChatId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_CHAT_KEY)
}

export function setActiveChatId(id: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_CHAT_KEY, id)
}

export function getAllChats(): ChatSession[] {
  return getChats().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getChat(id: string): ChatSession | null {
  return getChats().find(c => c.id === id) || null
}

export function createChat(): ChatSession {
  const now = new Date().toISOString()
  const chat: ChatSession = {
    id: `chat_${Date.now()}`,
    title: "Nouvelle conversation",
    messages: [],
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }
  const chats = getChats()
  chats.push(chat)
  saveChats(chats)
  setActiveChatId(chat.id)
  return chat
}

export function updateChat(id: string, messages: StoredMessage[], title?: string) {
  const chats = getChats()
  const idx = chats.findIndex(c => c.id === id)
  if (idx === -1) return

  chats[idx].messages = messages
  chats[idx].messageCount = messages.length
  chats[idx].updatedAt = new Date().toISOString()

  // Auto-title from first user message
  if (title) {
    chats[idx].title = title
  } else if (chats[idx].title === "Nouvelle conversation") {
    const firstUser = messages.find(m => m.role === "user")
    if (firstUser) {
      chats[idx].title = firstUser.text.substring(0, 50) + (firstUser.text.length > 50 ? "..." : "")
    }
  }

  saveChats(chats)
}

export function deleteChat(id: string) {
  const chats = getChats().filter(c => c.id !== id)
  saveChats(chats)
  if (getActiveChatId() === id) {
    localStorage.removeItem(ACTIVE_CHAT_KEY)
  }
}

export function shouldCompact(messages: StoredMessage[]): boolean {
  const nonSystemMessages = messages.filter(m => m.role !== "system")
  return nonSystemMessages.length >= MAX_MESSAGES_BEFORE_COMPACT
}

export function applyCompaction(chatId: string, compacted: CompactedMemory, messages: StoredMessage[]) {
  const chats = getChats()
  const idx = chats.findIndex(c => c.id === chatId)
  if (idx === -1) return

  // Keep only the most recent messages
  const recentMessages = messages.slice(-KEEP_RECENT_AFTER_COMPACT)

  // Create a system message with the compacted memory
  const compactedSystemMsg: StoredMessage = {
    id: Date.now(),
    role: "system",
    text: `📦 Mémoire compactée (${compacted.originalMessageCount} messages → résumé)\n\n${compacted.summary}\n\nDécisions : ${compacted.decisions.join(", ") || "—"}\nEn cours : ${compacted.tasks.join(", ") || "—"}\nEn attente : ${compacted.pending.join(", ") || "—"}`,
    time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  }

  chats[idx].messages = [compactedSystemMsg, ...recentMessages]
  chats[idx].compactedMemory = compacted
  chats[idx].updatedAt = new Date().toISOString()
  chats[idx].messageCount = chats[idx].messages.length

  saveChats(chats)
  return chats[idx].messages
}

export function getCompactionContext(chatId: string): string | null {
  const chat = getChat(chatId)
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
