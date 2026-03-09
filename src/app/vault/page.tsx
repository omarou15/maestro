"use client"

import { useState, useEffect, useCallback } from "react"
import { UserButton } from "@clerk/nextjs"
import MaestroLogo from "@/components/MaestroLogo"
import NavBar from "@/components/NavBar"

type VaultItem = {
  id: number
  category: string
  name: string
  icon: string
  type: string
  maskedValue: string
  status: "active" | "inactive"
  note: string
}

const CATEGORIES = [
  { key: "all", label: "Tout", icon: "🔐" },
  { key: "llm", label: "IA / LLMs", icon: "🧠" },
  { key: "services", label: "Services", icon: "🌐" },
  { key: "payment", label: "Paiement", icon: "💳" },
  { key: "infra", label: "Infra", icon: "🖥️" },
  { key: "perso", label: "Comptes perso", icon: "👤" },
]

const RULES = [
  { icon: "💳", label: "Plafond par transaction", value: "50€", desc: "Au-dessus → validation requise", mode: "validation" },
  { icon: "📅", label: "Plafond journalier", value: "200€", desc: "Total max auto par jour", mode: "validation" },
  { icon: "📧", label: "Emails stratégiques", value: "Validation", desc: "Clients > 10K€ de CA annuel", mode: "validation" },
  { icon: "🚀", label: "Déploiements staging", value: "Auto", desc: "Push & deploy autorisés", mode: "auto" },
  { icon: "⚠️", label: "Déploiements production", value: "Validation", desc: "Toujours demander avant", mode: "validation" },
]

const MODEL_CONFIGS = [
  { role: "Orchestrateur (Maestro)", model: "Claude Sonnet 4", icon: "🎯", reason: "Raisonnement + coordination", cost: "Via API" },
  { role: "Agents Dev (PO → QA)", model: "Claude Code", icon: "💻", reason: "Code via Claude Code sur serveur", cost: "Inclus Max" },
  { role: "Rédaction emails", model: "GPT-4o", icon: "📧", reason: "Rédaction naturelle", cost: "~0.02€/email" },
  { role: "Tri / classification", model: "Claude Haiku", icon: "📥", reason: "Ultra-rapide, pas cher", cost: "~0.001€/tri" },
  { role: "Browser automation", model: "Claude Sonnet", icon: "🛒", reason: "Navigation web complexe", cost: "~0.05€/action" },
]

type FormState = {
  category: string; name: string; icon: string; type: string
  value: string; status: "active" | "inactive"; note: string
}
const EMPTY_FORM: FormState = { category: "services", name: "", icon: "🔑", type: "Clé API", value: "", status: "active", note: "" }

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([])
  const [filter, setFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<"coffre" | "regles" | "modeles">("coffre")
  const [revealedValues, setRevealedValues] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/vault")
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const filtered = filter === "all" ? items : items.filter(v => v.category === filter)

  const reveal = async (id: number) => {
    if (revealedValues[id]) {
      setRevealedValues(p => { const n = { ...p }; delete n[id]; return n })
      return
    }
    const res = await fetch(`/api/vault/${id}/reveal`)
    if (!res.ok) return
    const { value } = await res.json()
    setRevealedValues(p => ({ ...p, [id]: value }))
    setTimeout(() => setRevealedValues(p => { const n = { ...p }; delete n[id]; return n }), 10000)
  }

  const openNew = () => { setForm(EMPTY_FORM); setEditingItem(null); setShowForm(true) }
  const openEdit = (item: VaultItem) => {
    setForm({ category: item.category, name: item.name, icon: item.icon, type: item.type, value: "", status: item.status, note: item.note })
    setEditingItem(item)
    setShowForm(true)
  }

  const saveItem = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingItem) {
        await fetch(`/api/vault/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        setItems(p => p.map(i => i.id === editingItem.id
          ? { ...i, category: form.category, name: form.name, icon: form.icon, type: form.type, status: form.status, note: form.note }
          : i))
        showToast("✅ Secret modifié")
      } else {
        const res = await fetch("/api/vault", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const newItem = await res.json()
        setItems(p => [...p, newItem])
        showToast("🔐 Secret ajouté et chiffré")
      }
      setShowForm(false)
    } catch { showToast("⚠️ Erreur") }
    setSaving(false)
  }

  const deleteItem = async (id: number) => {
    await fetch(`/api/vault/${id}`, { method: "DELETE" })
    setItems(p => p.filter(i => i.id !== id))
    showToast("🗑️ Supprimé")
  }

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      {toast && <div className="fixed top-3 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-5 py-2.5 rounded-xl text-[12px] font-medium z-50 shadow-xl animate-slideDown">{toast}</div>}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-[var(--maestro-primary)] mb-4">
              {editingItem ? "Modifier le secret" : "Ajouter un secret"}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="flex-none">
                  <input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                    className="border border-[var(--maestro-border)] rounded-xl px-3 py-2.5 text-[20px] outline-none w-14 text-center" maxLength={2} />
                </div>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nom (ex: Anthropic API)"
                  className="flex-1 border border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)]" />
              </div>
              <div className="flex gap-2">
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className="flex-1 border border-[var(--maestro-border)] rounded-xl px-3 py-2.5 text-[13px] outline-none bg-white">
                  {CATEGORIES.filter(c => c.key !== "all").map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
                <input value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} placeholder="Type (Clé API...)"
                  className="flex-1 border border-[var(--maestro-border)] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)]" />
              </div>
              <div className="relative">
                <input value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  type="password"
                  placeholder={editingItem ? "Nouvelle valeur (laisser vide pour ne pas changer)" : "Valeur secrète (clé API, token...)"}
                  className="w-full border border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)] font-mono" />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--maestro-muted)]">🔒</span>
              </div>
              <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Note (optionnel)"
                className="border border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--maestro-accent)]" />
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as "active" | "inactive" }))}
                className="border border-[var(--maestro-border)] rounded-xl px-3 py-2.5 text-[13px] outline-none bg-white">
                <option value="active">✅ Actif</option>
                <option value="inactive">⭕ Inactif</option>
              </select>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setShowForm(false)} className="flex-1 border border-[var(--maestro-border)] rounded-xl py-2.5 text-[13px] font-medium text-[var(--maestro-muted)]">Annuler</button>
                <button onClick={saveItem} disabled={saving || !form.name.trim()}
                  className="flex-1 bg-[var(--maestro-primary)] text-white rounded-xl py-2.5 text-[13px] font-semibold disabled:opacity-50">
                  {saving ? "⏳" : "🔐 Chiffrer & Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[var(--maestro-primary)] px-4 h-14 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <a href="/dashboard"><MaestroLogo size={30} /></a>
          <div>
            <div className="text-white text-[15px] font-bold tracking-tight">MAESTRO</div>
            <div className="text-white/40 text-[9px] font-mono tracking-[0.08em]">COFFRE-FORT & PARAMÈTRES</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-green-500/[0.12] px-2.5 py-1 rounded-full">
            <div className="w-[6px] h-[6px] rounded-full bg-green-500" />
            <span className="text-green-500 text-[11px] font-semibold font-mono">AES-256</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="mx-5 mt-4 bg-gradient-to-r from-[#1A2F2A] to-[#243D36] rounded-2xl p-4 flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">🔐</div>
        <div>
          <div className="text-white text-[14px] font-semibold mb-0.5">Secrets chiffrés en base de données</div>
          <div className="text-white/50 text-[12px]">AES-256-CBC · Neon PostgreSQL · Jamais exposés côté client</div>
        </div>
      </div>

      <div className="px-5 pt-4 flex gap-1">
        {([
          { key: "coffre" as const, label: "🔑 Coffre-fort", count: items.length },
          { key: "regles" as const, label: "⚡ Autonomie", count: RULES.length },
          { key: "modeles" as const, label: "🧠 Modèles IA", count: MODEL_CONFIGS.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === t.key ? "bg-[var(--maestro-primary)] text-white" : "bg-[var(--maestro-surface)] text-[var(--maestro-muted)]"
            }`}>
            {t.label}
            <span className={`text-[10px] font-bold font-mono px-1.5 rounded-md ${activeTab === t.key ? "bg-white/20" : "bg-[var(--maestro-border)]"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="px-5 pt-4 pb-24">
        {/* COFFRE-FORT */}
        {activeTab === "coffre" && (
          <>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setFilter(c.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors border ${
                    filter === c.key
                      ? "border-[var(--maestro-accent)] bg-[var(--maestro-accent-bg)] text-[var(--maestro-accent)]"
                      : "border-[var(--maestro-border)] bg-white text-[var(--maestro-muted)]"
                  }`}>
                  <span className="text-sm">{c.icon}</span>{c.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12 text-[var(--maestro-muted)] text-[13px]">Chargement...</div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl p-3.5 border border-[var(--maestro-border)] shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--maestro-surface)] flex items-center justify-center text-lg shrink-0">{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold text-[var(--maestro-primary)]">{item.name}</span>
                          <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                            item.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>{item.status === "active" ? "ACTIF" : "INACTIF"}</span>
                        </div>
                        <div className="text-[11px] text-[var(--maestro-muted)] font-mono mb-1">{item.type}</div>
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] text-gray-500 bg-[var(--maestro-surface)] px-2 py-1 rounded-md font-mono">
                            {revealedValues[item.id] || item.maskedValue}
                          </code>
                          <button onClick={() => reveal(item.id)} className="text-sm">
                            {revealedValues[item.id] ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button onClick={() => openEdit(item)}
                          className="bg-[var(--maestro-surface)] border border-[var(--maestro-border)] rounded-lg px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:border-[var(--maestro-accent)] transition-colors">
                          Modifier
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="text-[9px] text-red-400 hover:text-red-600 font-mono">
                          supprimer
                        </button>
                      </div>
                    </div>
                    {item.note && (
                      <div className="mt-2 pt-2 border-t border-[var(--maestro-surface)] text-[11px] text-[var(--maestro-muted)] flex items-center gap-1.5">
                        <span className="text-xs">💡</span>{item.note}
                      </div>
                    )}
                  </div>
                ))}

                {filtered.length === 0 && !loading && (
                  <div className="bg-white rounded-2xl p-8 border border-[var(--maestro-border)] text-center">
                    <div className="text-3xl mb-2">🔐</div>
                    <div className="text-[13px] text-[var(--maestro-muted)]">Aucun secret dans cette catégorie</div>
                  </div>
                )}

                <button onClick={openNew}
                  className="bg-white rounded-2xl p-5 border-2 border-dashed border-[var(--maestro-border)] text-[var(--maestro-muted)] text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
                  <span className="text-xl">+</span> Ajouter un secret
                </button>
              </div>
            )}
          </>
        )}

        {/* RÈGLES */}
        {activeTab === "regles" && (
          <div className="flex flex-col gap-2.5">
            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 flex items-center gap-3 mb-1">
              <span className="text-xl">⚡</span>
              <div>
                <div className="text-[13px] font-semibold text-amber-900">Règles d'autonomie</div>
                <div className="text-[12px] text-amber-700">Ce que Maestro peut faire seul vs ce qui te demande validation</div>
              </div>
            </div>
            {RULES.map((rule, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-[var(--maestro-border)] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--maestro-surface)] flex items-center justify-center text-lg shrink-0">{rule.icon}</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[var(--maestro-primary)] mb-0.5">{rule.label}</div>
                  <div className="text-[12px] text-[var(--maestro-muted)]">{rule.desc}</div>
                </div>
                <div className={`text-[12px] font-bold font-mono px-3 py-1.5 rounded-lg text-center min-w-[80px] ${
                  rule.mode === "auto" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>{rule.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* MODÈLES IA */}
        {activeTab === "modeles" && (
          <div className="flex flex-col gap-2.5">
            <div className="bg-blue-50 rounded-xl p-3.5 border border-blue-200 flex items-center gap-3 mb-1">
              <span className="text-xl">🧠</span>
              <div>
                <div className="text-[13px] font-semibold text-blue-900">Attribution des modèles IA</div>
                <div className="text-[12px] text-blue-700">Maestro choisit le meilleur cerveau pour chaque type d'agent</div>
              </div>
            </div>
            {MODEL_CONFIGS.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-[var(--maestro-border)] flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--maestro-surface)] flex items-center justify-center text-lg shrink-0">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[var(--maestro-primary)] mb-0.5">{item.role}</div>
                  <div className="text-[12px] text-[var(--maestro-muted)]">{item.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="bg-purple-50 text-purple-700 text-[11px] font-bold font-mono px-2.5 py-1 rounded-lg mb-1">{item.model}</div>
                  <div className="text-[10px] text-[var(--maestro-muted)] font-mono">{item.cost}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NavBar />
    </div>
  )
}
