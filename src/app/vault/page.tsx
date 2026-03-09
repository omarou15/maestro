"use client"

import { useState } from "react"
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
  lastUsed: string
  usedBy: number
  note: string
}

type Rule = {
  icon: string
  label: string
  value: string
  desc: string
  mode: "auto" | "validation"
}

type ModelConfig = {
  role: string
  model: string
  icon: string
  reason: string
  cost: string
}

const CATEGORIES = [
  { key: "all", label: "Tout", icon: "🔐" },
  { key: "llm", label: "IA / LLMs", icon: "🧠" },
  { key: "services", label: "Services", icon: "🌐" },
  { key: "payment", label: "Paiement", icon: "💳" },
  { key: "infra", label: "Infra", icon: "🖥️" },
  { key: "perso", label: "Comptes perso", icon: "👤" },
]

const VAULT_ITEMS: VaultItem[] = [
  { id: 1, category: "llm", name: "Anthropic (Claude)", icon: "🧠", type: "Clé API",
    maskedValue: "sk-ant-••••••••WqA", status: "active", lastUsed: "il y a 2 min", usedBy: 8, note: "Abonnement Max — illimité" },
  { id: 2, category: "llm", name: "OpenAI (GPT-4o)", icon: "🤖", type: "Clé API",
    maskedValue: "sk-proj-••••••••xN8", status: "inactive", lastUsed: "—", usedBy: 0, note: "Pas encore configuré" },
  { id: 3, category: "llm", name: "Google (Gemini)", icon: "💎", type: "Clé API",
    maskedValue: "AIzaSy••••••••k2M", status: "inactive", lastUsed: "—", usedBy: 0, note: "Pas encore configuré" },
  { id: 4, category: "services", name: "Gmail / Google Workspace", icon: "📧", type: "OAuth",
    maskedValue: "Connecté — o.barry@•••", status: "active", lastUsed: "il y a 5 min", usedBy: 3, note: "Scope: mail, calendar, drive" },
  { id: 5, category: "services", name: "Monday.com", icon: "📊", type: "Token API",
    maskedValue: "eyJhbG••••••••zI1N", status: "inactive", lastUsed: "—", usedBy: 0, note: "À connecter" },
  { id: 6, category: "payment", name: "Carte Visa ••4521", icon: "💳", type: "Carte bancaire",
    maskedValue: "4976 •••• •••• 4521", status: "inactive", lastUsed: "—", usedBy: 0, note: "Plafond auto: 50€/transaction · 200€/jour" },
  { id: 7, category: "perso", name: "Carrefour Drive", icon: "🛒", type: "Identifiants",
    maskedValue: "email@••• / ••••••", status: "inactive", lastUsed: "—", usedBy: 0, note: "À configurer" },
  { id: 8, category: "perso", name: "Amazon", icon: "📦", type: "Identifiants",
    maskedValue: "email@••• / ••••••", status: "inactive", lastUsed: "—", usedBy: 0, note: "À configurer" },
  { id: 9, category: "perso", name: "SNCF Connect", icon: "🚄", type: "Identifiants",
    maskedValue: "email@••• / ••••••", status: "inactive", lastUsed: "—", usedBy: 0, note: "À configurer" },
  { id: 10, category: "perso", name: "Uber Eats", icon: "🍔", type: "Identifiants",
    maskedValue: "email@••• / ••••••", status: "inactive", lastUsed: "—", usedBy: 0, note: "À configurer" },
  { id: 11, category: "infra", name: "GitHub", icon: "🐙", type: "Token",
    maskedValue: "ghp_••••••••a4R", status: "active", lastUsed: "il y a 15 min", usedBy: 4, note: "Scope: repo, workflow" },
  { id: 12, category: "infra", name: "Vercel", icon: "▲", type: "Token",
    maskedValue: "vcp_••••••••mN3", status: "active", lastUsed: "il y a 2h", usedBy: 2, note: "Projet: maestro" },
  { id: 13, category: "infra", name: "Hetzner", icon: "🖥️", type: "Token API",
    maskedValue: "NiGr••••••••Zipuw", status: "active", lastUsed: "il y a 1 jour", usedBy: 1, note: "Serveur: CPX31 · Ashburn" },
  { id: 14, category: "infra", name: "Neon PostgreSQL", icon: "🗄️", type: "Connection string",
    maskedValue: "postgres://••••@ep-••.neon.tech", status: "active", lastUsed: "il y a 1 min", usedBy: 1, note: "DB: neondb" },
]

const RULES: Rule[] = [
  { icon: "💳", label: "Plafond par transaction", value: "50€", desc: "Au-dessus → validation requise", mode: "validation" },
  { icon: "📅", label: "Plafond journalier", value: "200€", desc: "Total max auto par jour", mode: "validation" },
  { icon: "📧", label: "Emails stratégiques", value: "Validation", desc: "Clients > 10K€ de CA annuel", mode: "validation" },
  { icon: "🚀", label: "Déploiements staging", value: "Auto", desc: "Push & deploy autorisés", mode: "auto" },
  { icon: "⚠️", label: "Déploiements production", value: "Validation", desc: "Toujours demander avant", mode: "validation" },
]

const MODEL_CONFIGS: ModelConfig[] = [
  { role: "Orchestrateur (Maestro)", model: "Claude Sonnet 4", icon: "🎯", reason: "Raisonnement + coordination", cost: "Via API" },
  { role: "Agents Dev (PO → QA)", model: "Claude Code", icon: "💻", reason: "Code via Claude Code sur serveur", cost: "Inclus Max" },
  { role: "Rédaction emails", model: "GPT-4o", icon: "📧", reason: "Rédaction naturelle", cost: "~0.02€/email" },
  { role: "Tri / classification", model: "Claude Haiku", icon: "📥", reason: "Ultra-rapide, pas cher", cost: "~0.001€/tri" },
  { role: "Suivi Monday", model: "Claude Haiku", icon: "📊", reason: "Lectures API simples", cost: "~0.001€/check" },
  { role: "Browser automation", model: "Claude Sonnet", icon: "🛒", reason: "Navigation web complexe", cost: "~0.05€/action" },
]

export default function VaultPage() {
  const [filter, setFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<"coffre" | "regles" | "modeles">("coffre")
  const [showValues, setShowValues] = useState<Record<number, boolean>>({})

  const filtered = filter === "all" ? VAULT_ITEMS : VAULT_ITEMS.filter(v => v.category === filter)

  const toggleShow = (id: number) => {
    setShowValues(p => ({ ...p, [id]: !p[id] }))
    if (!showValues[id]) {
      setTimeout(() => setShowValues(p => ({ ...p, [id]: false })), 8000)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--maestro-cream)]">
      {/* Header */}
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

      {/* Security Banner */}
      <div className="mx-5 mt-4 bg-gradient-to-r from-[#1A2F2A] to-[#243D36] rounded-2xl p-4 flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">🔐</div>
        <div>
          <div className="text-white text-[14px] font-semibold mb-0.5">Données chiffrées sur ton serveur</div>
          <div className="text-white/50 text-[12px]">AES-256 · Stockage local · Jamais transmis à des tiers</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-4 flex gap-1">
        {([
          { key: "coffre" as const, label: "🔑 Coffre-fort", count: VAULT_ITEMS.length },
          { key: "regles" as const, label: "⚡ Autonomie", count: RULES.length },
          { key: "modeles" as const, label: "🧠 Modèles IA", count: MODEL_CONFIGS.length },
        ]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === t.key ? "bg-[var(--maestro-primary)] text-white" : "bg-[var(--maestro-surface)] text-[var(--maestro-muted)]"
            }`}>
            {t.label}
            <span className={`text-[10px] font-bold font-mono px-1.5 rounded-md ${
              activeTab === t.key ? "bg-white/20" : "bg-[var(--maestro-border)]"
            }`}>{t.count}</span>
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
                          {showValues[item.id] ? item.maskedValue.replace(/•/g, "x") : item.maskedValue}
                        </code>
                        <button onClick={() => toggleShow(item.id)} className="text-sm">
                          {showValues[item.id] ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button className="bg-[var(--maestro-surface)] border border-[var(--maestro-border)] rounded-lg px-2.5 py-1 text-[10px] font-semibold text-gray-500 hover:border-[var(--maestro-accent)] transition-colors">
                        Modifier
                      </button>
                      <span className="text-[9px] text-[var(--maestro-muted)] font-mono">
                        {item.usedBy > 0 ? `${item.usedBy} agents · ${item.lastUsed}` : "Non utilisé"}
                      </span>
                    </div>
                  </div>
                  {item.note && (
                    <div className="mt-2 pt-2 border-t border-[var(--maestro-surface)] text-[11px] text-[var(--maestro-muted)] flex items-center gap-1.5">
                      <span className="text-xs">💡</span>{item.note}
                    </div>
                  )}
                </div>
              ))}

              <button className="bg-white rounded-2xl p-5 border-2 border-dashed border-[var(--maestro-border)] text-[var(--maestro-muted)] text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
                <span className="text-xl">+</span> Ajouter un secret
              </button>
            </div>
          </>
        )}

        {/* RÈGLES D'AUTONOMIE */}
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
                  rule.mode === "auto"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}>{rule.value}</div>
              </div>
            ))}

            <button className="bg-white rounded-2xl p-5 border-2 border-dashed border-[var(--maestro-border)] text-[var(--maestro-muted)] text-sm font-medium flex items-center justify-center gap-2 hover:border-[var(--maestro-accent)] hover:text-[var(--maestro-accent)] transition-colors">
              <span className="text-xl">+</span> Ajouter une règle
            </button>
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
