import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb, initKnowledgeSchema } from "@/lib/db"

let ready = false
async function ensure() { if (!ready) { await initKnowledgeSchema(); ready = true } }

type SeedItem = {
  type: string; title: string; content: string
  tags: string[]; source: string; importance: string
}

const SEED_ITEMS: SeedItem[] = [
  // Identité & stack
  {
    type: "decision", importance: "haute", source: "MAESTRO.md",
    title: "Stack Maestro : Next.js + Hetzner + Claude",
    content: "Frontend Next.js 14 sur Vercel (auto-deploy on push), backend Express+tsx sur Hetzner CPX31 (178.156.251.108:4000), auth Clerk, DB Neon PostgreSQL, LLM Claude Sonnet 4. GitHub : github.com/omarou15/maestro. Frontend : maestro-chi.vercel.app.",
    tags: ["stack", "architecture", "maestro", "vercel", "hetzner"],
  },
  {
    type: "decision", importance: "haute", source: "MAESTRO.md",
    title: "Seuil d'autonomie : 50€ auto, au-dessus validation",
    content: "Les agents peuvent dépenser jusqu'à 50€ par transaction sans demander. Au-dessus, validation obligatoire. Plafond journalier : 200€.",
    tags: ["autonomie", "budget", "validation", "règle"],
  },
  {
    type: "decision", importance: "haute", source: "CLAUDE.md",
    title: "Design system Maestro : Vert Sapin + Ambre",
    content: "Couleurs : Vert Sapin #1A2F2A, Ambre #D4940A, Crème #FAF8F5, Sable #E2DDD5. Typo : DM Sans (UI) + JetBrains Mono (code). Logo : Nœud Orchestrateur SVG. NavBar : icônes SVG noir/ambre. Mode clair par défaut.",
    tags: ["design", "couleurs", "branding", "UI"],
  },
  {
    type: "process", importance: "haute", source: "CLAUDE.md",
    title: "Workflow deploy Maestro : build → commit → push",
    content: "1. git pull\n2. Lire GOALS.md — identifier prochain P0\n3. Coder la solution\n4. npm run build — OBLIGATOIRE avant tout push\n5. git add -A && git commit -m 'description en français' && git push origin main\n6. Si backend modifié : systemctl restart maestro-core\n7. Mettre à jour GOALS.md + LEARNINGS.md",
    tags: ["deploy", "workflow", "git", "build"],
  },
  // Contexte utilisateur
  {
    type: "client", importance: "haute", source: "MAESTRO.md",
    title: "Nexity — M. Durand, devis détaillés ligne par ligne",
    content: "M. Durand chez Nexity veut toujours des devis ligne par ligne avec le détail des prestations. Pas de forfait global. Délai de décision : ~2 semaines. Partenariat potentiel : 15-20 DPE/mois à prix négocié, gros volume mais marge réduite.",
    tags: ["Nexity", "devis", "client", "DPE", "partenariat"],
  },
  {
    type: "client", importance: "moyenne", source: "MAESTRO.md",
    title: "Mme Leroy — relances nécessaires (5-7 jours de délai)",
    content: "Mme Leroy met toujours du temps à répondre (5-7 jours). Ne pas hésiter à relancer. Elle finit par valider mais il faut insister poliment.",
    tags: ["Leroy", "relance", "client", "comportement"],
  },
  {
    type: "client", importance: "haute", source: "MAESTRO.md",
    title: "SCI Les Terrasses — audit 240m² urgent",
    content: "Audit énergétique d'un immeuble de 240m² avant revente. Deadline serrée, rapport sous 10 jours. Budget : 4200€ HT.",
    tags: ["SCI", "audit", "urgent", "client"],
  },
  // Équipe
  {
    type: "learning", importance: "haute", source: "MAESTRO.md",
    title: "Karim — fort en DPE, lent sur RE2020",
    content: "Karim livre les DPE en avance mais a tendance à prendre du retard sur les audits RE2020. Lui confier prioritairement les DPE et répartir les RE2020 entre les autres thermiciens.",
    tags: ["Karim", "DPE", "RE2020", "équipe", "thermicien"],
  },
  // Préférences
  {
    type: "preference", importance: "haute", source: "MAESTRO.md",
    title: "Emails : ton chaleureux, pas froid",
    content: "Emails professionnels mais avec une touche humaine. Pas de 'Cordialement' sec — préférer 'Belle journée' ou 'Au plaisir d'échanger'. GPT-4o produit un ton plus naturel que Claude pour les emails commerciaux.",
    tags: ["email", "ton", "style", "communication"],
  },
  {
    type: "preference", importance: "basse", source: "MAESTRO.md",
    title: "Courses : Carrefour Drive Villeurbanne",
    content: "Toujours commander sur Carrefour Drive Villeurbanne. Créneau de livraison préféré : 18h-20h. Pas de produits premier prix sur la viande et les fruits.",
    tags: ["courses", "Carrefour", "Villeurbanne", "perso"],
  },
  {
    type: "preference", importance: "basse", source: "MAESTRO.md",
    title: "Train : 1ère classe, gare Lyon Part-Dieu",
    content: "Billets SNCF : toujours 1ère classe, départ Lyon Part-Dieu sauf si Perrache est significativement plus pratique. Carte Avantage Adulte.",
    tags: ["SNCF", "train", "1ère classe", "Part-Dieu", "perso"],
  },
  // Apprentissages techniques
  {
    type: "learning", importance: "moyenne", source: "LEARNINGS.md",
    title: "Clerk mode Development ne marche pas sur Vercel",
    content: "Les clés pk_test_ de Clerk en mode Development ne fonctionnent pas sur un domaine Vercel. Il faut soit passer en Production (clés pk_live_), soit utiliser un domaine custom.",
    tags: ["Clerk", "auth", "bug", "Vercel", "dev"],
  },
  {
    type: "learning", importance: "basse", source: "LEARNINGS.md",
    title: "dotenv ne charge pas automatiquement dans tsx",
    content: "dotenv ne charge pas automatiquement le .env dans tsx. Il faut exporter les variables manuellement ou utiliser systemd Environment= dans l'unit file.",
    tags: ["dotenv", "tsx", "backend", "env", "systemd"],
  },
  {
    type: "learning", importance: "basse", source: "LEARNINGS.md",
    title: "Input chat : mb-14 pour ne pas être caché par la navbar",
    content: "Sur mobile, l'input du chat doit avoir mb-14 pour ne pas être caché par la navbar fixe en bas. NavBar = 56px de hauteur.",
    tags: ["UI", "mobile", "navbar", "chat", "CSS"],
  },
  {
    type: "learning", importance: "moyenne", source: "LEARNINGS.md",
    title: "self-modify opérationnel via maestro-cli",
    content: "L'auto-modification du code est opérationnelle via le endpoint /api/self-modify. Claude peut modifier son propre code, builder et redéployer. Exécuté en tant que maestro-cli (non-root) pour la sécurité.",
    tags: ["self-modify", "auto-amélioration", "maestro", "sécurité"],
  },
  // Objectifs en cours
  {
    type: "process", importance: "haute", source: "GOALS.md",
    title: "Objectifs P0 : Gmail API + Monday API à connecter",
    content: "P0 en cours : (1) Connecter Gmail API pour que l'agent Email lise/envoie de vrais emails. (2) Connecter Monday API pour que l'agent Équipe lise les vraies tâches.",
    tags: ["Gmail", "Monday", "API", "objectifs", "P0"],
  },
  {
    type: "process", importance: "moyenne", source: "GOALS.md",
    title: "Objectifs P1 : Playwright + PostgreSQL pour agents",
    content: "P1 : Installer Playwright sur le serveur pour le browser automation. Persister les missions/agents en PostgreSQL (Neon) au lieu de la mémoire in-memory. Ajouter onglet 'Agents' dans le dashboard.",
    tags: ["Playwright", "PostgreSQL", "agents", "missions", "P1"],
  },
]

async function seedIfEmpty(userId: string, sql: ReturnType<typeof import("@/lib/db").getDb>) {
  const count = await sql`SELECT COUNT(*) as n FROM knowledge_items WHERE user_id = ${userId}`
  if (Number(count[0].n) > 0) return

  for (const item of SEED_ITEMS) {
    await sql`
      INSERT INTO knowledge_items (user_id, type, title, content, tags, source, importance, linked_to)
      VALUES (
        ${userId}, ${item.type}, ${item.title}, ${item.content},
        ${JSON.stringify(item.tags)}::jsonb, ${item.source},
        ${item.importance}, '[]'::jsonb
      )
    `
  }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensure()
  const sql = getDb()

  await seedIfEmpty(userId, sql)

  const rows = await sql`
    SELECT id, type, title, content, tags, source, importance, linked_to, created_at, updated_at
    FROM knowledge_items WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `
  return NextResponse.json(rows.map(r => ({
    id: r.id, type: r.type, title: r.title, content: r.content,
    tags: r.tags, source: r.source, importance: r.importance,
    linkedTo: r.linked_to,
    date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  })))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensure()
  const sql = getDb()
  const { type, title, content, tags, source, importance, linkedTo } = await req.json()

  const rows = await sql`
    INSERT INTO knowledge_items (user_id, type, title, content, tags, source, importance, linked_to)
    VALUES (
      ${userId}, ${type || "idea"}, ${title}, ${content},
      ${JSON.stringify(tags || [])}::jsonb, ${source || "Manuel"},
      ${importance || "moyenne"}, ${JSON.stringify(linkedTo || [])}::jsonb
    )
    RETURNING *
  `
  const r = rows[0]
  return NextResponse.json({
    id: r.id, type: r.type, title: r.title, content: r.content,
    tags: r.tags, source: r.source, importance: r.importance,
    linkedTo: r.linked_to,
    date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  })
}
