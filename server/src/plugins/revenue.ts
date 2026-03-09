import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs"
import { join } from "path"
import Anthropic from "@anthropic-ai/sdk"
import type { Plugin } from "./types.js"

// ─── DATA MODEL ────────────────────────────────────────────────────────────

export type LeadStage = "prospect" | "contact" | "qualified" | "proposal" | "negotiation" | "won" | "lost"
export type LeadSource = "linkedin" | "referral" | "cold_email" | "inbound" | "medium" | "fiverr" | "malt" | "other"

export interface Lead {
  id: string
  company: string
  contact: string
  email?: string
  phone?: string
  source: LeadSource
  value: number
  stage: LeadStage
  score: number
  tags: string[]
  createdAt: string
  updatedAt: string
  notes: string
}

export type OpportunityType = "content" | "freelance" | "affiliation" | "api" | "consulting"
export type OpportunityStatus = "open" | "in_progress" | "won" | "lost" | "on_hold"

export interface Opportunity {
  id: string
  leadId: string
  type: OpportunityType
  description: string
  value: number
  probability: number
  deadline: string
  status: OpportunityStatus
  createdAt: string
  updatedAt: string
  activities: Array<{ date: string; note: string }>
}

export interface Revenue {
  month: string
  recurring: number
  oneTime: number
  pipeline: number
  conversion: number
  leads: number
  wonDeals: number
}

export interface RevenueData {
  leads: Lead[]
  opportunities: Opportunity[]
  monthly: Revenue[]
  lastBackup?: string
}

// ─── PERSISTENCE ──────────────────────────────────────────────────────────

const DATA_DIR = "/root/maestro/data"
const REVENUE_FILE = join(DATA_DIR, "revenue.json")
const BACKUP_FILE = join(DATA_DIR, "revenue.backup.json")

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

function loadRevenue(): RevenueData {
  ensureDataDir()
  if (!existsSync(REVENUE_FILE)) {
    const empty: RevenueData = { leads: [], opportunities: [], monthly: [] }
    writeFileSync(REVENUE_FILE, JSON.stringify(empty, null, 2), "utf-8")
    return empty
  }
  try {
    return JSON.parse(readFileSync(REVENUE_FILE, "utf-8")) as RevenueData
  } catch {
    console.error("[REVENUE] Fichier corrompu, réinitialisation")
    const empty: RevenueData = { leads: [], opportunities: [], monthly: [] }
    writeFileSync(REVENUE_FILE, JSON.stringify(empty, null, 2), "utf-8")
    return empty
  }
}

function saveRevenue(data: RevenueData) {
  ensureDataDir()
  // Auto-backup avant sauvegarde
  if (existsSync(REVENUE_FILE)) {
    try { copyFileSync(REVENUE_FILE, BACKUP_FILE) } catch { /* ignore */ }
  }
  data.lastBackup = new Date().toISOString()
  writeFileSync(REVENUE_FILE, JSON.stringify(data, null, 2), "utf-8")
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ─── STATS / DASHBOARD ────────────────────────────────────────────────────

function computeDashboard(data: RevenueData) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const wonOps = data.opportunities.filter(o => o.status === "won")
  const openOps = data.opportunities.filter(o => o.status === "open" || o.status === "in_progress")

  const thisMonthWon = wonOps.filter(o => o.updatedAt.startsWith(currentMonth))
  const recurring = thisMonthWon.filter(o => o.type === "affiliation" || o.type === "api").reduce((s, o) => s + o.value, 0)
  const oneTime = thisMonthWon.filter(o => o.type !== "affiliation" && o.type !== "api").reduce((s, o) => s + o.value, 0)
  const pipeline = openOps.reduce((s, o) => s + o.value * (o.probability / 100), 0)
  const totalLeads = data.leads.length
  const wonLeads = data.leads.filter(l => l.stage === "won").length
  const conversion = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  const stageBreakdown = {
    prospect: data.leads.filter(l => l.stage === "prospect").length,
    contact: data.leads.filter(l => l.stage === "contact").length,
    qualified: data.leads.filter(l => l.stage === "qualified").length,
    proposal: data.leads.filter(l => l.stage === "proposal").length,
    negotiation: data.leads.filter(l => l.stage === "negotiation").length,
    won: wonLeads,
    lost: data.leads.filter(l => l.stage === "lost").length,
  }

  const typeBreakdown = {
    content: openOps.filter(o => o.type === "content").reduce((s, o) => s + o.value, 0),
    freelance: openOps.filter(o => o.type === "freelance").reduce((s, o) => s + o.value, 0),
    affiliation: openOps.filter(o => o.type === "affiliation").reduce((s, o) => s + o.value, 0),
    api: openOps.filter(o => o.type === "api").reduce((s, o) => s + o.value, 0),
    consulting: openOps.filter(o => o.type === "consulting").reduce((s, o) => s + o.value, 0),
  }

  return {
    currentMonth,
    revenue: { recurring, oneTime, total: recurring + oneTime, pipeline: Math.round(pipeline) },
    leads: { total: totalLeads, conversion, stageBreakdown },
    opportunities: { open: openOps.length, won: wonOps.length, total: data.opportunities.length, typeBreakdown },
    topLeads: data.leads
      .filter(l => l.stage !== "won" && l.stage !== "lost")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(l => ({ id: l.id, company: l.company, stage: l.stage, value: l.value, score: l.score })),
    urgentDeals: data.opportunities
      .filter(o => o.status === "open" || o.status === "in_progress")
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5),
    monthlyHistory: data.monthly.slice(-6),
  }
}

// ─── AGENTS ───────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000 })

async function runAgent(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })
  const block = response.content.find(c => c.type === "text")
  return block?.type === "text" ? block.text : ""
}

// RevenueScout — prospection & scoring
async function agentScout(task: string): Promise<string> {
  return runAgent(
    `Tu es RevenueScout, agent de prospection revenue pour Maestro (orchestrateur IA).
Spécialités :
- Identifier des opportunités de revenus : contenu Medium/Substack, freelance Malt/Fiverr, affiliation énergie, API payante
- Scorer les leads (0-100) basé sur : budget estimé, urgence, fit produit, accessibilité
- Suggérer des approches de contact personnalisées
- Analyser les marchés et segments porteurs

Contexte business :
- Maestro est un orchestrateur IA spécialisé en audit énergétique et automatisation
- Cible : TPE/PME, cabinets conseil, gestionnaires immobiliers, ingénieurs thermiciens
- Prix cible : 50-500€/mois pour les abonnements API, 200-2000€ pour le freelance

Réponds en français, sois précis et actionnable. Format JSON pour les données structurées.`,
    task
  )
}

// RevenueWriter — rédaction emails/devis
async function agentWriter(task: string): Promise<string> {
  return runAgent(
    `Tu es RevenueWriter, agent de rédaction commerciale pour Maestro.
Spécialités :
- Rédiger des emails de prospection chaleureux et personnalisés
- Créer des devis professionnels et des propositions commerciales
- Adapter le ton selon le profil du prospect
- Rédiger des articles Medium/Substack monétisables sur l'IA et l'efficacité énergétique

Style :
- Chaleureux, direct, professionnel sans être corporate
- Met en valeur la valeur concrète (gains de temps, ROI, économies)
- Pas de jargon technique non nécessaire
- Call-to-action clair

Réponds en français. Pour les emails, inclure l'objet, le corps et les variantes de CTA.`,
    task
  )
}

// RevenueAccountant — calculs CA et prévisions
async function agentAccountant(task: string, data: RevenueData): Promise<string> {
  const dashboard = computeDashboard(data)
  return runAgent(
    `Tu es RevenueAccountant, agent de comptabilité et prévisions revenue pour Maestro.
Données actuelles :
${JSON.stringify(dashboard, null, 2)}

Spécialités :
- Calculer le CA mensuel, récurrent vs one-shot
- Prévoir le pipeline et les probabilités de closing
- Analyser les tendances de conversion
- Générer des rapports financiers clairs
- Identifier les leviers de croissance prioritaires

Réponds en français avec des chiffres précis et des recommandations actionnables.`,
    task
  )
}

// RevenueCloser — suivi deals et relances
async function agentCloser(task: string, data: RevenueData): Promise<string> {
  const urgentDeals = data.opportunities
    .filter(o => o.status === "open" || o.status === "in_progress")
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 10)

  return runAgent(
    `Tu es RevenueCloser, agent de closing et suivi deals pour Maestro.
Deals prioritaires actifs :
${JSON.stringify(urgentDeals, null, 2)}

Leads en phase avancée :
${JSON.stringify(data.leads.filter(l => l.stage === "negotiation" || l.stage === "proposal").slice(0, 10), null, 2)}

Spécialités :
- Définir la stratégie de relance optimale par profil
- Rédiger des messages de suivi adaptés au contexte
- Identifier les objections et préparer les réponses
- Prioriser les deals par impact/effort
- Suggérer des conditions de closing (remise, délai, bonus)

Réponds en français avec un plan d'action concret et priorisé.`,
    task
  )
}

// ─── PLUGIN ───────────────────────────────────────────────────────────────

export const revenuePlugin: Plugin = {
  id: "revenue",
  name: "Revenue Engine",
  version: "1.0.0",

  register(ctx) {
    // ── STATUS / DASHBOARD ──────────────────────────────────────────────
    ctx.app.get("/api/revenue/status", (_, res) => {
      try {
        const data = loadRevenue()
        res.json(computeDashboard(data))
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // ── LEADS ───────────────────────────────────────────────────────────
    ctx.app.get("/api/revenue/leads", (req, res) => {
      try {
        const data = loadRevenue()
        const { stage, source, minScore } = req.query
        let leads = data.leads
        if (stage) leads = leads.filter(l => l.stage === stage)
        if (source) leads = leads.filter(l => l.source === source)
        if (minScore) leads = leads.filter(l => l.score >= Number(minScore))
        leads = leads.sort((a, b) => b.score - a.score)
        res.json({ leads, total: leads.length })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.post("/api/revenue/leads", (req, res) => {
      try {
        const { company, contact, email, phone, source, value, stage, notes, tags } = req.body
        if (!company || !contact) return res.status(400).json({ error: "company et contact requis" })
        const data = loadRevenue()
        const lead: Lead = {
          id: generateId("lead"),
          company,
          contact,
          email: email || "",
          phone: phone || "",
          source: source || "other",
          value: Number(value) || 0,
          stage: stage || "prospect",
          score: 50,
          tags: tags || [],
          notes: notes || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        data.leads.push(lead)
        saveRevenue(data)
        ctx.fire("revenue:lead_created", { lead })
        res.status(201).json({ lead })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.put("/api/revenue/leads/:id", (req, res) => {
      try {
        const data = loadRevenue()
        const lead = data.leads.find(l => l.id === req.params.id)
        if (!lead) return res.status(404).json({ error: "Lead introuvable" })
        const { company, contact, email, phone, source, value, stage, score, notes, tags } = req.body
        if (company !== undefined) lead.company = company
        if (contact !== undefined) lead.contact = contact
        if (email !== undefined) lead.email = email
        if (phone !== undefined) lead.phone = phone
        if (source !== undefined) lead.source = source
        if (value !== undefined) lead.value = Number(value)
        if (stage !== undefined) lead.stage = stage
        if (score !== undefined) lead.score = Number(score)
        if (notes !== undefined) lead.notes = notes
        if (tags !== undefined) lead.tags = tags
        lead.updatedAt = new Date().toISOString()
        saveRevenue(data)
        ctx.fire("revenue:lead_updated", { lead })
        res.json({ lead })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.delete("/api/revenue/leads/:id", (req, res) => {
      try {
        const data = loadRevenue()
        const idx = data.leads.findIndex(l => l.id === req.params.id)
        if (idx === -1) return res.status(404).json({ error: "Lead introuvable" })
        data.leads.splice(idx, 1)
        saveRevenue(data)
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // ── OPPORTUNITIES ───────────────────────────────────────────────────
    ctx.app.get("/api/revenue/opportunities", (req, res) => {
      try {
        const data = loadRevenue()
        const { status, type, leadId } = req.query
        let opps = data.opportunities
        if (status) opps = opps.filter(o => o.status === status)
        if (type) opps = opps.filter(o => o.type === type)
        if (leadId) opps = opps.filter(o => o.leadId === leadId)
        opps = opps.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
        res.json({ opportunities: opps, total: opps.length })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.post("/api/revenue/opportunities", (req, res) => {
      try {
        const { leadId, type, description, value, probability, deadline } = req.body
        if (!leadId || !type || !description) return res.status(400).json({ error: "leadId, type, description requis" })
        const data = loadRevenue()
        if (!data.leads.find(l => l.id === leadId)) return res.status(404).json({ error: "Lead associé introuvable" })
        const opp: Opportunity = {
          id: generateId("opp"),
          leadId,
          type,
          description,
          value: Number(value) || 0,
          probability: Number(probability) || 50,
          deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activities: [],
        }
        data.opportunities.push(opp)
        saveRevenue(data)
        ctx.fire("revenue:opportunity_created", { opportunity: opp })
        res.status(201).json({ opportunity: opp })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.put("/api/revenue/opportunities/:id", (req, res) => {
      try {
        const data = loadRevenue()
        const opp = data.opportunities.find(o => o.id === req.params.id)
        if (!opp) return res.status(404).json({ error: "Opportunité introuvable" })
        const { description, value, probability, deadline, status, activity } = req.body
        if (description !== undefined) opp.description = description
        if (value !== undefined) opp.value = Number(value)
        if (probability !== undefined) opp.probability = Number(probability)
        if (deadline !== undefined) opp.deadline = deadline
        if (status !== undefined) opp.status = status
        if (activity) opp.activities.push({ date: new Date().toISOString(), note: activity })
        opp.updatedAt = new Date().toISOString()

        // Si won/lost, mettre à jour le lead correspondant
        if (status === "won") {
          const lead = data.leads.find(l => l.id === opp.leadId)
          if (lead) { lead.stage = "won"; lead.updatedAt = new Date().toISOString() }
        } else if (status === "lost") {
          const lead = data.leads.find(l => l.id === opp.leadId)
          if (lead) { lead.stage = "lost"; lead.updatedAt = new Date().toISOString() }
        }

        saveRevenue(data)
        ctx.fire("revenue:opportunity_updated", { opportunity: opp })
        res.json({ opportunity: opp })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // ── AGENTS ──────────────────────────────────────────────────────────
    ctx.app.post("/api/revenue/agents/scout", async (req, res) => {
      try {
        const { task } = req.body
        if (!task) return res.status(400).json({ error: "task requis" })
        const result = await agentScout(task)
        ctx.fire("revenue:agent_run", { agent: "scout", task: task.slice(0, 80) })
        res.json({ agent: "RevenueScout", result })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.post("/api/revenue/agents/writer", async (req, res) => {
      try {
        const { task } = req.body
        if (!task) return res.status(400).json({ error: "task requis" })
        const result = await agentWriter(task)
        ctx.fire("revenue:agent_run", { agent: "writer", task: task.slice(0, 80) })
        res.json({ agent: "RevenueWriter", result })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.post("/api/revenue/agents/accountant", async (req, res) => {
      try {
        const { task } = req.body
        if (!task) return res.status(400).json({ error: "task requis" })
        const data = loadRevenue()
        const result = await agentAccountant(task, data)
        ctx.fire("revenue:agent_run", { agent: "accountant", task: task.slice(0, 80) })
        res.json({ agent: "RevenueAccountant", result })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    ctx.app.post("/api/revenue/agents/closer", async (req, res) => {
      try {
        const { task } = req.body
        if (!task) return res.status(400).json({ error: "task requis" })
        const data = loadRevenue()
        const result = await agentCloser(task, data)
        ctx.fire("revenue:agent_run", { agent: "closer", task: task.slice(0, 80) })
        res.json({ agent: "RevenueCloser", result })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // ── MONTHLY REVENUE RECORD ──────────────────────────────────────────
    ctx.app.post("/api/revenue/monthly", (req, res) => {
      try {
        const { month, recurring, oneTime, pipeline, conversion, leads, wonDeals } = req.body
        if (!month) return res.status(400).json({ error: "month requis (format YYYY-MM)" })
        const data = loadRevenue()
        const existing = data.monthly.find(m => m.month === month)
        if (existing) {
          Object.assign(existing, { recurring, oneTime, pipeline, conversion, leads, wonDeals })
        } else {
          data.monthly.push({ month, recurring: recurring || 0, oneTime: oneTime || 0, pipeline: pipeline || 0, conversion: conversion || 0, leads: leads || 0, wonDeals: wonDeals || 0 })
        }
        data.monthly.sort((a, b) => a.month.localeCompare(b.month))
        saveRevenue(data)
        res.json({ ok: true })
      } catch (e) {
        res.status(500).json({ error: String(e) })
      }
    })

    // ── HOOKS ───────────────────────────────────────────────────────────
    ctx.on("revenue:lead_created", (data) => {
      const d = data as { lead: Lead }
      console.log(`[REVENUE] Nouveau lead : ${d.lead.company} (${d.lead.source}) — ${d.lead.value}€`)
    })

    ctx.on("revenue:opportunity_updated", (data) => {
      const d = data as { opportunity: Opportunity }
      if (d.opportunity.status === "won") {
        console.log(`[REVENUE] 🎉 Deal gagné ! ${d.opportunity.description} — ${d.opportunity.value}€`)
        ctx.fire("revenue:deal_won", { opportunity: d.opportunity })
      }
    })

    console.log("[REVENUE] Revenue Engine v1.0.0 — agents Scout, Writer, Accountant, Closer prêts")
  },
}
