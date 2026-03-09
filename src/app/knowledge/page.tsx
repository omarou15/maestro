"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Header from "@/components/Header"
import NavBar from "@/components/NavBar"

type KnowledgeItem = {
  id: number
  type: "idea" | "decision" | "learning" | "client" | "process" | "preference"
  title: string
  content: string
  tags: string[]
  source: string
  date: string
  linkedTo?: string[]
  importance: "haute" | "moyenne" | "basse"
}

const CATEGORIES = [
  { key: "all", label: "Tout", icon: "🧠", color: "#1A2F2A" },
  { key: "idea", label: "Idées", icon: "💡", color: "#F59E0B" },
  { key: "decision", label: "Décisions", icon: "⚖️", color: "#8B5CF6" },
  { key: "learning", label: "Apprentissages", icon: "📚", color: "#3B82F6" },
  { key: "client", label: "Clients", icon: "👤", color: "#10B981" },
  { key: "process", label: "Process", icon: "⚙️", color: "#6366F1" },
  { key: "preference", label: "Préférences", icon: "⭐", color: "#EC4899" },
]

const importanceStyles: Record<string, { bg: string; text: string }> = {
  haute: { bg: "#FEE2E2", text: "#DC2626" },
  moyenne: { bg: "#FEF3C7", text: "#D97706" },
  basse: { bg: "#F3F4F6", text: "#6B7280" },
}

type EditState = Omit<KnowledgeItem, "id" | "date">

const EMPTY_EDIT: EditState = {
  type: "idea", title: "", content: "", tags: [], source: "Manuel", importance: "moyenne", linkedTo: [],
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [newIdea, setNewIdea] = useState("")
  const [showCapture, setShowCapture] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [editItem, setEditItem] = useState<KnowledgeItem | null>(null)
  const [editState, setEditState] = useState<EditState>(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge")
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const filtered = items.filter(k => {
    const matchesFilter = filter === "all" || k.type === filter
    const matchesSearch = search === "" ||
      k.title.toLowerCase().includes(search.toLowerCase()) ||
      k.content.toLowerCase().includes(search.toLowerCase()) ||
      k.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const captureIdea = async () => {
    if (!newIdea.trim()) return
    setIsCapturing(true)
    try {
      const res = await fetch("/api/knowledge/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newIdea }),
      })
      const data = await res.json()
      if (data.item) {
        setItems(p => [data.item, ...p])
        showToast(data.message || "💡 Idée capturée !")
        setNewIdea("")
        setShowCapture(false)
      }
    } catch {
      showToast("⚠️ Erreur lors de la capture")
    }
    setIsCapturing(false)
  }

  const openEdit = (item: KnowledgeItem) => {
    setEditItem(item)
    setEditState({
      type: item.type, title: item.title, content: item.content,
      tags: item.tags, source: item.source, importance: item.importance,
      linkedTo: item.linkedTo || [],
    })
  }

  const saveEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      await fetch(`/api/knowledge/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editState),
      })
      setItems(p => p.map(i => i.id === editItem.id ? { ...i, ...editState } : i))
      setEditItem(null)
      showToast("✅ Modifié")
    } catch { showToast("⚠️ Erreur") }
    setSaving(false)
  }

  const deleteItem = async (id: number) => {
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" })
    setItems(p => p.filter(i => i.id !== id))
    setExpandedItem(null)
    showToast("🗑️ Supprimé")
  }

  const categoriesWithCounts = CATEGORIES.map(c => ({
    ...c,
    count: c.key === "all" ? items.length : items.filter(k => k.type === c.key).length,
  }))

  return (
    <div className="min-h-[100dvh] bg-[var(--maestro-cream)]">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-5 py-3 rounded-xl text-[13px] font-medium z-50 shadow-xl max-w-[90vw] animate-slideDown leading-relaxed">
          {toast}
        </div>
      )}

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-[var(--maestro-primary)] mb-4">Modifier</div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <select value={editState.type} onChange={e => setEditState(p => ({ ...p, type: e.target.value as KnowledgeItem["type"] }))}
                  className="border border-[var(--maestro-border)] rounded-xl px-3 py-2 text-[13px] outline-none bg-white flex-1">
                  {CATEGORIES.filter(c => c.key !== "all").map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
                <select value={editState.importance} onChange={e => setEditState(p => ({ ...p, importance: e.target.value as KnowledgeItem["importance"] }))}
                  className="border border-[var(--maestro-border)] rounded-xl px-3 py-2 text-[13px] outline-none bg-white flex-1">
                  <option value="haute">🔴 Haute</option>
                  <option value="moyenne">🟡 Moyenne</option>
                  <option value="basse">⚪ Basse</option>
                </select>
              </div>
              <input value={editState.title} onChange={e => setEditState(p => ({ ...p, title: e.target.value }))} placeholder="Titre"
                className="border border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)]" />
              <textarea value={editState.content} onChange={e => setEditState(p => ({ ...p, content: e.target.value }))} placeholder="Contenu" rows={4}
                className="border border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)] resize-none" />
              <input value={editState.tags.join(", ")} onChange={e => setEditState(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                placeholder="Tags (séparés par des virgules)"
                className="border border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)]" />
              <div className="flex gap-2 mt-1">
                <button onClick={() => setEditItem(null)} className="flex-1 border border-[var(--maestro-border)] rounded-xl py-2.5 text-[13px] font-medium text-[var(--maestro-muted)]">Annuler</button>
                <button onClick={saveEdit} disabled={saving} className="flex-1 bg-[var(--maestro-primary)] text-white rounded-xl py-2.5 text-[13px] font-semibold disabled:opacity-50">
                  {saving ? "..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Header subtitle="KNOWLEDGE ENGINE" rightContent={
        <button onClick={() => { setShowCapture(!showCapture); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="bg-[var(--maestro-accent)] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg touch-target">
          💡 Capturer
        </button>
      } />

      <div className="page-content">
        {/* Quick capture */}
        {showCapture && (
          <div className="mx-4 mt-4 bg-[var(--maestro-accent-bg)] rounded-2xl p-4 border-2 border-[var(--maestro-accent)]/30 animate-scaleIn">
            <div className="text-[13px] font-semibold text-[var(--maestro-primary)] mb-2">💡 Capture rapide — Maestro catégorise automatiquement</div>
            <div className="flex gap-2">
              <input ref={inputRef} type="text" placeholder="Note ton idée, ta décision, ton apprentissage..."
                value={newIdea} onChange={e => setNewIdea(e.target.value)}
                onKeyDown={e => e.key === "Enter" && captureIdea()}
                className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none bg-white text-[var(--maestro-primary)] focus:border-[var(--maestro-accent)] transition-colors" />
              <button onClick={captureIdea} disabled={isCapturing || !newIdea.trim()}
                className="bg-[var(--maestro-accent)] text-white rounded-xl px-4 py-2.5 text-[12px] font-semibold touch-target disabled:opacity-50 whitespace-nowrap">
                {isCapturing ? "⏳" : "Capturer →"}
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-4">
          <div className="bg-white rounded-xl px-3.5 py-2.5 flex items-center gap-2 border border-[var(--maestro-border)]">
            <span className="text-sm opacity-50">🔍</span>
            <input type="text" placeholder="Rechercher dans la mémoire..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 border-none outline-none text-[13px] bg-transparent text-[var(--maestro-primary)]" />
            {search && <button onClick={() => setSearch("")} className="text-xs text-[var(--maestro-muted)]">✕</button>}
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Entrées", value: items.length, icon: "🧠" },
            { label: "Idées", value: items.filter(i => i.type === "idea").length, icon: "💡" },
            { label: "Décisions", value: items.filter(i => i.type === "decision").length, icon: "⚖️" },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-3 border border-[var(--maestro-border)] text-center">
              <div className="text-lg">{s.icon}</div>
              <div className="text-[16px] font-bold text-[var(--maestro-primary)] font-mono">{s.value}</div>
              <div className="text-[10px] text-[var(--maestro-muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Category filters */}
        <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto pb-1">
          {categoriesWithCounts.map(c => (
            <button key={c.key} onClick={() => setFilter(c.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap border shrink-0 ${
                filter === c.key
                  ? "border-[var(--maestro-accent)] bg-[var(--maestro-accent-bg)] text-[var(--maestro-accent)]"
                  : "border-[var(--maestro-border)] bg-white text-[var(--maestro-muted)]"
              }`}>
              <span className="text-sm">{c.icon}</span>{c.label}
              <span className="text-[10px] font-mono opacity-60">{c.count}</span>
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="px-4 pt-3 pb-24 flex flex-col gap-2">
          {loading ? (
            <div className="text-center py-12 text-[var(--maestro-muted)] text-[13px]">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-[var(--maestro-border)]">
              <div className="text-3xl mb-2">{items.length === 0 ? "🧠" : "🔍"}</div>
              <div className="text-sm text-[var(--maestro-muted)] mb-3">
                {items.length === 0 ? "Ta mémoire est vide" : `Aucun résultat pour "${search}"`}
              </div>
              {items.length === 0 && (
                <button onClick={() => { setShowCapture(true); setTimeout(() => inputRef.current?.focus(), 100) }}
                  className="bg-[var(--maestro-accent)] text-white rounded-xl px-4 py-2 text-[12px] font-semibold">
                  💡 Capturer ma première idée
                </button>
              )}
            </div>
          ) : filtered.map(item => {
            const cat = CATEGORIES.find(c => c.key === item.type)
            const imp = importanceStyles[item.importance]
            return (
              <div key={item.id}
                className="bg-white rounded-2xl border border-[var(--maestro-border)] shadow-sm overflow-hidden animate-fadeIn"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
                <div className="p-3.5 cursor-pointer active:bg-[var(--maestro-surface)] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                      style={{ background: `${cat?.color}10` }}>
                      {cat?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-[var(--maestro-primary)] truncate">{item.title}</span>
                        <span className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: imp.bg, color: imp.text }}>{item.importance.toUpperCase()}</span>
                      </div>
                      <div className="text-[12px] text-[var(--maestro-muted)] line-clamp-2 leading-relaxed">{item.content}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[var(--maestro-muted)] font-mono">{item.source} · {item.date}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedItem === item.id && (
                  <div className="border-t border-[var(--maestro-surface)] p-3.5 bg-[var(--maestro-cream)]/50 animate-scaleIn" onClick={e => e.stopPropagation()}>
                    <div className="text-[13px] text-[var(--maestro-primary)] leading-relaxed mb-3">{item.content}</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] font-mono bg-[var(--maestro-surface)] text-[var(--maestro-muted)] px-2 py-0.5 rounded-md border border-[var(--maestro-border)]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => openEdit(item)}
                        className="text-[11px] font-medium text-[var(--maestro-muted)] bg-[var(--maestro-surface)] border border-[var(--maestro-border)] rounded-lg px-3 py-1.5">
                        ✏️ Modifier
                      </button>
                      <button onClick={() => deleteItem(item.id)}
                        className="text-[11px] font-medium text-red-400 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <NavBar />
    </div>
  )
}
