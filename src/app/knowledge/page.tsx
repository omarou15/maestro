"use client"

import { useState, useRef } from "react"
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

type Category = {
  key: string
  label: string
  icon: string
  count: number
  color: string
}

const CATEGORIES: Category[] = [
  { key: "all", label: "Tout", icon: "🧠", count: 0, color: "#1A2F2A" },
  { key: "idea", label: "Idées", icon: "💡", count: 4, color: "#F59E0B" },
  { key: "decision", label: "Décisions", icon: "⚖️", count: 3, color: "#8B5CF6" },
  { key: "learning", label: "Apprentissages", icon: "📚", count: 3, color: "#3B82F6" },
  { key: "client", label: "Clients", icon: "👤", count: 3, color: "#10B981" },
  { key: "process", label: "Process", icon: "⚙️", count: 2, color: "#6366F1" },
  { key: "preference", label: "Préférences", icon: "⭐", count: 3, color: "#EC4899" },
]

const KNOWLEDGE: KnowledgeItem[] = [
  // Idées
  { id: 1, type: "idea", title: "App mobile pour les diagnostiqueurs terrain", 
    content: "Créer une app mobile que mes thermiciens utilisent directement sur site pour saisir les données de l'audit. Photos, mesures, plan du bâtiment — tout en un.",
    tags: ["app", "mobile", "terrain", "audit"], source: "Chat Maestro", date: "9 mars 2026", importance: "haute",
    linkedTo: ["Dev App Audits"] },
  { id: 2, type: "idea", title: "Partenariat Nexity — DPE volume", 
    content: "Nexity propose un partenariat annuel pour tous leurs programmes neufs. Potentiel : 15-20 DPE/mois à prix négocié. Gros volume mais marge réduite.",
    tags: ["nexity", "partenariat", "DPE", "volume"], source: "Email", date: "9 mars 2026", importance: "haute",
    linkedTo: ["Gestion Emails"] },
  { id: 3, type: "idea", title: "Automatiser les rapports DPE avec un template", 
    content: "Au lieu de rédiger chaque rapport DPE from scratch, créer un template intelligent qui se remplit automatiquement avec les données de l'audit.",
    tags: ["DPE", "template", "automatisation"], source: "Réflexion perso", date: "8 mars 2026", importance: "moyenne" },
  { id: 4, type: "idea", title: "Formation RE2020 pour l'équipe", 
    content: "La RE2020 évolue, mes thermiciens doivent se mettre à jour. Trouver une formation certifiante, idéalement en ligne pour ne pas bloquer les projets.",
    tags: ["RE2020", "formation", "équipe"], source: "Chat Maestro", date: "7 mars 2026", importance: "moyenne" },
  
  // Décisions
  { id: 5, type: "decision", title: "Stack Maestro : Next.js + Hetzner + Claude", 
    content: "Décidé : Next.js 14 sur Vercel pour le frontend, serveur Hetzner CPX31 pour le backend/agents, Claude comme LLM principal, multi-modèle pour les cas spécifiques.",
    tags: ["maestro", "stack", "architecture"], source: "Session build", date: "9 mars 2026", importance: "haute" },
  { id: 6, type: "decision", title: "Seuil d'autonomie : 50€ auto, au-dessus validation", 
    content: "Les agents peuvent dépenser jusqu'à 50€ par transaction sans demander. Au-dessus, validation obligatoire. Plafond journalier : 200€.",
    tags: ["autonomie", "budget", "validation"], source: "Config Maestro", date: "9 mars 2026", importance: "haute" },
  { id: 7, type: "decision", title: "Design : Vert Sapin + Ambre, logo Nœud", 
    content: "Palette validée : Vert Sapin #1A2F2A, Ambre #D4940A, Crème #FAF8F5. Logo : Nœud Orchestrateur (centre + 6 agents). Mode clair par défaut.",
    tags: ["design", "branding", "couleurs"], source: "Session build", date: "9 mars 2026", importance: "moyenne" },

  // Apprentissages
  { id: 8, type: "learning", title: "GPT-4o meilleur que Claude pour la rédaction d'emails", 
    content: "Testé les deux sur des emails clients. GPT-4o produit un ton plus naturel et professionnel pour les emails commerciaux. Claude est meilleur pour l'analyse et le code.",
    tags: ["GPT", "Claude", "emails", "comparaison"], source: "Test agents", date: "9 mars 2026", importance: "moyenne" },
  { id: 9, type: "learning", title: "Clerk Development ne marche pas sur Vercel", 
    content: "Les clés pk_test_ de Clerk en mode Development ne fonctionnent pas sur un domaine Vercel. Il faut soit passer en Production, soit utiliser un domaine custom.",
    tags: ["Clerk", "auth", "bug", "Vercel"], source: "Debug", date: "9 mars 2026", importance: "basse" },
  { id: 10, type: "learning", title: "Karim plus performant sur les DPE que les RE2020", 
    content: "Karim livre les DPE en avance mais a tendance à prendre du retard sur les audits RE2020. Lui confier prioritairement les DPE et répartir les RE2020 entre les autres.",
    tags: ["Karim", "DPE", "RE2020", "performance"], source: "Suivi Monday", date: "8 mars 2026", importance: "haute",
    linkedTo: ["Suivi Équipe Monday"] },

  // Clients
  { id: 11, type: "client", title: "Nexity — préfère les devis détaillés", 
    content: "M. Durand chez Nexity veut toujours des devis ligne par ligne avec le détail des prestations. Pas de forfait global. Délai de décision : ~2 semaines.",
    tags: ["Nexity", "devis", "préférence"], source: "Historique emails", date: "9 mars 2026", importance: "haute" },
  { id: 12, type: "client", title: "SCI Les Terrasses — projet urgent 240m²", 
    content: "Audit énergétique d'un immeuble de 240m² avant revente. Deadline serrée, ils veulent le rapport sous 10 jours. Budget : 4200€ HT.",
    tags: ["SCI", "audit", "urgent"], source: "Email", date: "9 mars 2026", importance: "haute" },
  { id: 13, type: "client", title: "Mme Leroy — relances nécessaires", 
    content: "Mme Leroy met toujours du temps à répondre (5-7 jours). Ne pas hésiter à relancer. Elle finit par valider mais il faut insister poliment.",
    tags: ["Leroy", "relance", "comportement"], source: "Agent Relanceur", date: "8 mars 2026", importance: "moyenne" },

  // Process
  { id: 14, type: "process", title: "Workflow audit énergétique standard", 
    content: "1. Réception demande → 2. Devis sous 48h → 3. Validation client → 4. Planification visite → 5. Visite terrain → 6. Saisie données → 7. Calculs → 8. Rapport → 9. Livraison → 10. Facturation",
    tags: ["workflow", "audit", "standard"], source: "Process interne", date: "7 mars 2026", importance: "haute" },
  { id: 15, type: "process", title: "Checklist visite DPE", 
    content: "Surface habitable, isolation murs/toit/sol, type de chauffage, ventilation, menuiseries, production eau chaude, photos façades + compteurs.",
    tags: ["DPE", "checklist", "visite"], source: "Process interne", date: "6 mars 2026", importance: "moyenne" },

  // Préférences
  { id: 16, type: "preference", title: "Emails : ton professionnel mais pas froid", 
    content: "Je veux que mes emails soient professionnels mais avec une touche humaine. Pas de 'Cordialement' sec — préférer 'Belle journée' ou 'Au plaisir d'échanger'.",
    tags: ["email", "ton", "style"], source: "Correction agent", date: "9 mars 2026", importance: "haute" },
  { id: 17, type: "preference", title: "Courses : Carrefour Villeurbanne par défaut", 
    content: "Toujours commander sur Carrefour Drive Villeurbanne. Livraison créneau 18h-20h préféré. Pas de produits premier prix sur la viande et les fruits.",
    tags: ["courses", "Carrefour", "préférence"], source: "Config agent", date: "8 mars 2026", importance: "basse" },
  { id: 18, type: "preference", title: "Train : toujours 1ère classe, gare Part-Dieu", 
    content: "Billets SNCF : toujours 1ère classe, départ Lyon Part-Dieu sauf si Perrache est significativement plus pratique. Carte Avantage Adulte.",
    tags: ["SNCF", "train", "préférence"], source: "Config agent", date: "7 mars 2026", importance: "basse" },
]

const importanceStyles: Record<string, { bg: string; text: string }> = {
  haute: { bg: "#FEE2E2", text: "#DC2626" },
  moyenne: { bg: "#FEF3C7", text: "#D97706" },
  basse: { bg: "#F3F4F6", text: "#6B7280" },
}

export default function KnowledgePage() {
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [newIdea, setNewIdea] = useState("")
  const [showCapture, setShowCapture] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = KNOWLEDGE.filter(k => {
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `L'utilisateur capture cette idée dans son Knowledge Engine : "${newIdea}". 
            
Réponds en 2 lignes max :
1. Confirme que l'idée est capturée
2. Suggère un lien avec un projet ou une idée existante si pertinent

Contexte : CEO cabinet audit énergétique, projets en cours : Dev app audits, gestion emails, suivi équipe Monday, vie perso.`
          }]
        }),
      })

      const data = await res.json()
      showToast(data.text || "💡 Idée capturée !")
      setNewIdea("")
      setShowCapture(false)
    } catch {
      showToast("💡 Idée capturée !")
      setNewIdea("")
      setShowCapture(false)
    }

    setIsCapturing(false)
  }

  // Update category counts
  const categoriesWithCounts = CATEGORIES.map(c => ({
    ...c,
    count: c.key === "all" ? filtered.length : KNOWLEDGE.filter(k => k.type === c.key).length,
  }))

  return (
    <div className="min-h-[100dvh] bg-[var(--maestro-cream)]">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[var(--maestro-primary)] text-white px-5 py-3 rounded-xl text-[13px] font-medium z-50 shadow-xl max-w-[90vw] animate-slideDown leading-relaxed">
          {toast}
        </div>
      )}

      <Header subtitle="KNOWLEDGE ENGINE" rightContent={
        <button onClick={() => { setShowCapture(!showCapture); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="bg-[var(--maestro-accent)] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg touch-target">
          💡 Capturer
        </button>
      } />

      <div className="page-content">
        {/* Quick capture bar */}
        {showCapture && (
          <div className="mx-4 mt-4 bg-[var(--maestro-accent-bg)] rounded-2xl p-4 border-2 border-[var(--maestro-accent)]/30 animate-scaleIn">
            <div className="text-[13px] font-semibold text-[var(--maestro-primary)] mb-2">💡 Capture rapide</div>
            <div className="flex gap-2">
              <input ref={inputRef} type="text" placeholder="Note ton idée, ta décision, ton apprentissage..."
                value={newIdea} onChange={e => setNewIdea(e.target.value)}
                onKeyDown={e => e.key === "Enter" && captureIdea()}
                className="flex-1 border-[1.5px] border-[var(--maestro-border)] rounded-xl px-3.5 py-2.5 text-[13px] outline-none bg-white text-[var(--maestro-primary)] focus:border-[var(--maestro-accent)] transition-colors" />
              <button onClick={captureIdea} disabled={isCapturing}
                className="bg-[var(--maestro-accent)] text-white rounded-xl px-4 py-2.5 text-[12px] font-semibold touch-target disabled:opacity-50 whitespace-nowrap">
                {isCapturing ? "..." : "Capturer →"}
              </button>
            </div>
            <div className="flex gap-1.5 mt-2">
              {["💡 Idée", "⚖️ Décision", "📚 Apprentissage", "👤 Client"].map((t, i) => (
                <button key={i} onClick={() => setNewIdea(newIdea + " ")}
                  className="text-[10px] bg-white border border-[var(--maestro-border)] rounded-lg px-2 py-1 text-[var(--maestro-muted)]">
                  {t}
                </button>
              ))}
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
            {search && (
              <button onClick={() => setSearch("")} className="text-xs text-[var(--maestro-muted)]">✕</button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Entrées", value: KNOWLEDGE.length, icon: "🧠" },
            { label: "Cette semaine", value: "+8", icon: "📈" },
            { label: "Connexions", value: "12", icon: "🔗" },
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

        {/* Knowledge items */}
        <div className="px-4 pt-3 pb-24 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-[var(--maestro-border)]">
              <div className="text-3xl mb-2">🔍</div>
              <div className="text-sm text-[var(--maestro-muted)]">Aucun résultat pour "{search}"</div>
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
                  <div className="border-t border-[var(--maestro-surface)] p-3.5 bg-[var(--maestro-cream)]/50 animate-scaleIn">
                    <div className="text-[13px] text-[var(--maestro-primary)] leading-relaxed mb-3">{item.content}</div>
                    
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.tags.map((tag, i) => (
                        <span key={i} className="text-[10px] font-mono bg-[var(--maestro-surface)] text-[var(--maestro-muted)] px-2 py-0.5 rounded-md border border-[var(--maestro-border)]">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Linked missions */}
                    {item.linkedTo && item.linkedTo.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-[var(--maestro-muted)]">🔗 Lié à :</span>
                        {item.linkedTo.map((link, i) => (
                          <span key={i} className="text-[10px] font-semibold text-[var(--maestro-accent)] bg-[var(--maestro-accent-bg)] px-2 py-0.5 rounded-md">
                            {link}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-2">
                      <button className="text-[11px] font-medium text-[var(--maestro-muted)] bg-[var(--maestro-surface)] border border-[var(--maestro-border)] rounded-lg px-3 py-1.5">
                        ✏️ Modifier
                      </button>
                      <button className="text-[11px] font-medium text-[var(--maestro-muted)] bg-[var(--maestro-surface)] border border-[var(--maestro-border)] rounded-lg px-3 py-1.5">
                        🔗 Lier
                      </button>
                      <button className="text-[11px] font-medium text-red-400 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                        🗑️
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
