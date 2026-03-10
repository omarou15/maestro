import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"

export const maxDuration = 300 // 5 min — nécessaire pour les auto-modifications

const BACKEND = "http://178.156.251.108:4000"

// Router mémoire : Haiku décide si le message nécessite du contexte personnel
async function needsMemoryContext(apiKey: string, userMessage: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        messages: [{ role: "user", content: `Ce message nécessite-t-il des informations personnelles sur l'utilisateur (préférences, clients, équipe, décisions passées) pour être bien répondu ? Réponds uniquement OUI ou NON.\n\nMessage: "${userMessage.slice(0, 300)}"` }],
      }),
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json() as { content: { text: string }[] }
    return data.content?.[0]?.text?.trim().toUpperCase().startsWith("OUI") ?? false
  } catch { return false }
}

async function getMemoryContext(userId: string): Promise<string> {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT title, content, type, score FROM knowledge_items
      WHERE user_id = ${userId} AND score >= 5
      ORDER BY score DESC, updated_at DESC
      LIMIT 15
    `
    if (rows.length === 0) return ""
    const lines = rows.map(r => `[${r.type}] ${r.title}: ${r.content}`).join("\n")
    return `\nMÉMOIRE PERSONNELLE (contexte utilisateur) :\n${lines}`
  } catch { return "" }
}

function getSystemPrompt(compactionContext?: string, memoryContext?: string, skillsContext?: string) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  })
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })

  let prompt = `Tu es Maestro, l'orchestrateur IA personnel d'Omar. Tu parles en français.

HORLOGE INTERNE :
- Maintenant : ${dateStr} (heure de Paris)
- Demain : ${tomorrowStr}

PERSONNALITÉ :
- Tu es un vrai bras droit — détendu, chaleureux, direct
- Tu tutoies Omar et tu parles comme un pote de confiance qui gère tout
- Tu utilises un ton naturel et relax, pas corporate ni robotique
- Tu vas droit au but, pas de blabla — mais avec de la chaleur humaine
- Tu peux plaisanter quand c'est approprié
- Tu dis "je" comme si tu étais vraiment là
- Quand tu ne sais pas, tu le dis franchement au lieu de tourner autour du pot
- JAMAIS de code brut, JAMAIS de JSON dans tes réponses
- Emojis avec parcimonie, uniquement quand ça ajoute de la clarté

EXEMPLES DE TON :
- ❌ "Je vais procéder à l'orchestration de votre demande"
- ✅ "C'est parti, je lance ça"
- ❌ "Voici le résultat de l'analyse que j'ai effectuée"
- ✅ "Voilà ce que j'ai trouvé"
- ❌ "N'hésitez pas à me solliciter pour toute autre requête"
- ✅ "Dis-moi si tu veux que je creuse"

CONTEXTE UTILISATEUR :
- Omar, CEO cabinet audit énergétique / conseil, France
- 2-5 ingénieurs thermiciens (Karim fort en DPE, lent en RE2020)
- Gmail + Monday.com
- Clients : Nexity (devis détaillés), SCI Les Terrasses (urgent 240m²), Mme Leroy (lente, relancer)
- Préférences : emails chaleureux ("Belle journée") pas froids ("Cordialement"), courses Carrefour Villeurbanne 18h-20h, train 1ère classe Part-Dieu avec Carte Avantage

CAPACITÉS :
- Créer des agents spécialisés par mission (outil : orchestrate)
- Consulter missions et agents actifs (outil : list_missions)
- Voir les validations en attente (outil : list_approvals)
- Approuver ou refuser une validation (outil : resolve_approval)
- Consulter l'activité récente (outil : get_activity)
- Rechercher sur le web en temps réel (outil : web_search) — prix, actus, horaires, infos
- Lire le contenu complet d'une page web (outil : web_fetch) — articles, pages produit, docs
- Lire et chercher dans Gmail (outils : gmail_search, gmail_read) — emails clients, factures
- Créer des brouillons et envoyer des emails (outils : gmail_draft, gmail_send) — ton chaleureux
- Voir l'agenda Google Calendar (outil : calendar_list) — RDV de la semaine
- Créer/modifier/supprimer des événements (outils : calendar_create, calendar_update, calendar_delete)
- Générer des PDF depuis HTML (outil : generate_pdf) — devis, rapports, factures
- Générer des fichiers Excel (outil : generate_xlsx) — tableaux, données
- Lire les documents uploadés (PDF, DOCX, XLSX, CSV) — extraction de texte
- Générer des artifacts interactifs
- Modifier ton propre code (outil : self_modify) — POUVOIR ULTIME
- Seuil autonomie : < 50€ auto, > 50€ validation

RÈGLE IMPORTANTE :
Quand Omar donne un ordre d'action, UTILISE TOUJOURS l'outil correspondant. Ne simule jamais une action.

RÈGLE SELF-MODIFY :
Quand Omar te demande de modifier l'interface — utilise self_modify avec un prompt précis. Le deploy Vercel est automatique.

ARTIFACTS :
Quand on demande une interface/composant :
1. Bref résumé (2-3 lignes)
2. HTML complet entre <artifact title="Titre"> et </artifact>
3. JAMAIS de backticks markdown`

  if (memoryContext) {
    prompt += `\n\n${memoryContext}`
  }

  if (skillsContext) {
    prompt += `\n\n${skillsContext}`
  }

  if (compactionContext) {
    prompt += `\n\n${compactionContext}`
  }

  return prompt
}

const TOOLS = [
  {
    name: "orchestrate",
    description: "Lance une nouvelle mission ou donne un ordre à Maestro. Utilise cet outil quand l'utilisateur veut créer une mission, lancer un projet, ou exécuter une tâche.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "L'ordre ou la description de la mission à lancer" },
      },
      required: ["message"],
    },
  },
  {
    name: "list_missions",
    description: "Récupère la liste des missions actives et l'état de chaque agent.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_approvals",
    description: "Récupère les validations en attente qui nécessitent une décision de l'utilisateur.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "resolve_approval",
    description: "Approuve ou refuse une action en attente de validation.",
    input_schema: {
      type: "object",
      properties: {
        approvalId: { type: "string", description: "L'ID de la validation à résoudre" },
        decision: { type: "string", enum: ["approve", "reject"], description: "approve pour valider, reject pour refuser" },
      },
      required: ["approvalId", "decision"],
    },
  },
  {
    name: "get_activity",
    description: "Récupère le journal d'activité récent des agents.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "self_modify",
    description: "Modifie le code source de Maestro lui-même — ajoute des pages, corrige des bugs, améliore l'interface. Le deploy Vercel est automatique. Utilise cet outil quand l'utilisateur veut changer quelque chose dans l'application.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Description précise et complète de la modification à apporter. Inclure : quoi modifier, où, comment, dans quel style (design system Maestro : Vert Sapin #1A2F2A, Ambre #D4940A).",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "get_skill",
    description: "Charge le contenu complet d'un skill par son ID. Utilise cet outil quand tu as besoin des instructions détaillées d'un skill pour exécuter une tâche.",
    input_schema: {
      type: "object",
      properties: {
        skillId: { type: "string", description: "L'identifiant du skill (ex: courses-carrefour, email-clients)" },
      },
      required: ["skillId"],
    },
  },
  {
    name: "gmail_search",
    description: "Cherche dans les emails Gmail. Query: 'is:unread', 'from:nexity', 'subject:devis', 'newer_than:3d'.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Requête Gmail" }, max: { type: "number", description: "Nombre max (défaut: 5)" } }, required: ["query"] },
  },
  {
    name: "gmail_read",
    description: "Lit le contenu complet d'un email par son ID.",
    input_schema: { type: "object", properties: { messageId: { type: "string" } }, required: ["messageId"] },
  },
  {
    name: "gmail_draft",
    description: "Crée un brouillon d'email. Ton chaleureux d'Omar.",
    input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, threadId: { type: "string" } }, required: ["to", "subject", "body"] },
  },
  {
    name: "gmail_send",
    description: "Envoie un email. Pour > 50€ d'impact, préfère gmail_draft.",
    input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, threadId: { type: "string" } }, required: ["to", "subject", "body"] },
  },
  {
    name: "calendar_list",
    description: "Liste les événements à venir du calendrier.",
    input_schema: { type: "object", properties: { days: { type: "number", description: "Nombre de jours (défaut: 7)" } }, required: [] },
  },
  {
    name: "calendar_create",
    description: "Crée un événement dans Google Calendar.",
    input_schema: { type: "object", properties: { summary: { type: "string" }, start: { type: "string" }, end: { type: "string" }, description: { type: "string" }, location: { type: "string" } }, required: ["summary", "start", "end"] },
  },
  {
    name: "calendar_update",
    description: "Modifie un événement existant.",
    input_schema: { type: "object", properties: { eventId: { type: "string" }, summary: { type: "string" }, start: { type: "string" }, end: { type: "string" }, description: { type: "string" }, location: { type: "string" } }, required: ["eventId"] },
  },
  {
    name: "calendar_delete",
    description: "Supprime un événement.",
    input_schema: { type: "object", properties: { eventId: { type: "string" } }, required: ["eventId"] },
  },
  {
    name: "generate_pdf",
    description: "Génère un PDF à partir de HTML. Pour devis, rapports, factures.",
    input_schema: { type: "object", properties: { html: { type: "string", description: "Contenu HTML complet" }, filename: { type: "string", description: "Nom du fichier" } }, required: ["html"] },
  },
  {
    name: "generate_xlsx",
    description: "Génère un fichier Excel. Données en tableau 2D.",
    input_schema: { type: "object", properties: { data: { type: "array", description: "[[headers...], [row1...], ...]", items: { type: "array", items: { type: "string" } } }, filename: { type: "string" }, sheetName: { type: "string" } }, required: ["data"] },
  },
  {
    name: "web_search",
    description: "Recherche sur le web en temps réel. Utilise cet outil pour toute question nécessitant des informations récentes, des prix, des horaires, de l'actualité, etc.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "La requête de recherche" },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description: "Lit le contenu complet d'une page web à partir de son URL. Utilise cet outil pour lire un article, une page produit, un document en ligne, etc.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "L'URL complète de la page à lire" },
      },
      required: ["url"],
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "orchestrate": {
        const res = await fetch(`${BACKEND}/api/orchestrate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input.message }),
        })
        return JSON.stringify(await res.json())
      }
      case "list_missions": {
        const res = await fetch(`${BACKEND}/api/missions`)
        return JSON.stringify(await res.json())
      }
      case "list_approvals": {
        const res = await fetch(`${BACKEND}/api/approvals`)
        return JSON.stringify(await res.json())
      }
      case "resolve_approval": {
        const res = await fetch(`${BACKEND}/api/approvals/${input.approvalId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: input.decision }),
        })
        return JSON.stringify(await res.json())
      }
      case "get_activity": {
        const res = await fetch(`${BACKEND}/api/activity`)
        return JSON.stringify(await res.json())
      }
      case "self_modify": {
        const res = await fetch(`${BACKEND}/api/self-modify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: input.prompt }),
          signal: AbortSignal.timeout(200000), // 3min 20s
        })
        return JSON.stringify(await res.json())
      }
      case "get_skill": {
        const res = await fetch(`${BACKEND}/api/skills/${input.skillId}`)
        return JSON.stringify(await res.json())
      }
      case "gmail_search": {
        const q = input.query || "is:unread"
        const max = input.max || 5
        const res = await fetch(`${BACKEND}/api/gmail/messages?q=${encodeURIComponent(q)}&max=${max}`)
        const data = await res.json()
        if (data.error) return `Erreur Gmail: ${data.error}`
        if (!data.messages?.length) return "Aucun email trouvé."
        return data.messages.map((m: { from: string; subject: string; snippet: string; date: string; id: string; unread: boolean }, i: number) =>
          `${i+1}. ${m.unread ? "[NON LU] " : ""}${m.subject}\n   De: ${m.from}\n   ${m.date}\n   ${m.snippet.slice(0, 100)}\n   [ID: ${m.id}]`
        ).join("\n\n")
      }
      case "gmail_read": {
        const res = await fetch(`${BACKEND}/api/gmail/messages/${input.messageId}`)
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `De: ${data.from}\nÀ: ${data.to}\nSujet: ${data.subject}\nDate: ${data.date}\n\n${data.body?.slice(0, 8000) || "[Vide]"}`
      }
      case "gmail_draft": {
        const res = await fetch(`${BACKEND}/api/gmail/drafts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: input.to, subject: input.subject, body: input.body, threadId: input.threadId }),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `Brouillon créé (ID: ${data.id}). Disponible dans Gmail > Brouillons.`
      }
      case "gmail_send": {
        const res = await fetch(`${BACKEND}/api/gmail/send`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: input.to, subject: input.subject, body: input.body, threadId: input.threadId }),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `Email envoyé à ${input.to}.`
      }
      case "calendar_list": {
        const days = input.days || 7
        const res = await fetch(`${BACKEND}/api/calendar/events?days=${days}`)
        const data = await res.json()
        if (data.error) return `Erreur Calendar: ${data.error}`
        if (!data.events?.length) return `Aucun événement dans les ${days} prochains jours.`
        return data.events.map((e: { summary: string; start: string; end: string; location: string; id: string }, i: number) => {
          const start = new Date(e.start).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
          const end = new Date(e.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
          return `${i+1}. ${e.summary}\n   ${start} → ${end}${e.location ? `\n   Lieu: ${e.location}` : ""}\n   [ID: ${e.id}]`
        }).join("\n\n")
      }
      case "calendar_create": {
        const res = await fetch(`${BACKEND}/api/calendar/events`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: input.summary, start: input.start, end: input.end, description: input.description, location: input.location }),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `Événement "${input.summary}" créé.${data.htmlLink ? ` Lien: ${data.htmlLink}` : ""}`
      }
      case "calendar_update": {
        const res = await fetch(`${BACKEND}/api/calendar/events/${input.eventId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summary: input.summary, start: input.start, end: input.end, description: input.description, location: input.location }),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `Événement mis à jour.`
      }
      case "calendar_delete": {
        const res = await fetch(`${BACKEND}/api/calendar/events/${input.eventId}`, { method: "DELETE" })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `Événement supprimé.`
      }
      case "generate_pdf": {
        const res = await fetch(`${BACKEND}/api/documents/generate/pdf`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: input.html, filename: input.filename || "document" }),
          signal: AbortSignal.timeout(30000),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `PDF généré : ${data.filename} (${Math.round(data.size / 1024)} Ko)\nTéléchargement : ${BACKEND}/api/documents/download/${data.filename}`
      }
      case "generate_xlsx": {
        const res = await fetch(`${BACKEND}/api/documents/generate/xlsx`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: input.data, filename: input.filename || "tableau", sheetName: input.sheetName }),
          signal: AbortSignal.timeout(15000),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        return `Excel généré : ${data.filename} (${Math.round(data.size / 1024)} Ko)\nTéléchargement : ${BACKEND}/api/documents/download/${data.filename}`
      }
      case "web_search": {
        const res = await fetch(`${BACKEND}/api/web-search?q=${encodeURIComponent(input.query)}`, {
          signal: AbortSignal.timeout(10000),
        })
        const data = await res.json()
        if (!data.results?.length) return "Aucun résultat trouvé."
        return data.results.map((r: { title: string; url: string; snippet: string }, i: number) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
        ).join("\n\n")
      }
      case "web_fetch": {
        const res = await fetch(`${BACKEND}/api/web-fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input.url }),
          signal: AbortSignal.timeout(20000),
        })
        const data = await res.json()
        if (data.error) return `Erreur: ${data.error}`
        const content = data.content?.slice(0, 30000) || "Page vide"
        return `Contenu de ${data.url} (${data.contentType}):\n\n${content}`
      }
      default:
        return JSON.stringify({ error: `Outil inconnu : ${name}` })
    }
  } catch {
    return JSON.stringify({ error: "Backend indisponible" })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    const { messages, compactionContext, model } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    // Map model selection to actual model IDs
    const modelMap: Record<string, string> = {
      "claude-opus": "claude-opus-4-0-20250514",
      "claude-sonnet": "claude-sonnet-4-20250514",
      "claude-haiku": "claude-haiku-4-5-20251001",
    }
    const actualModel = modelMap[model || "claude-sonnet"] || modelMap["claude-sonnet"]

    // Router mémoire intelligent
    const lastUserMsgRaw = [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || ""
    const lastUserMsg = typeof lastUserMsgRaw === "string" ? lastUserMsgRaw : (Array.isArray(lastUserMsgRaw) ? lastUserMsgRaw.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(" ") : "")
    let memoryContext = ""
    if (userId && lastUserMsg) {
      const needs = await needsMemoryContext(apiKey, lastUserMsg)
      if (needs) memoryContext = await getMemoryContext(userId)
    }

    // Fetch available skills from Hetzner
    let skillsContext = ""
    try {
      const skillsRes = await fetch("http://178.156.251.108:4000/api/skills", { signal: AbortSignal.timeout(3000) })
      const skillsData = await skillsRes.json()
      if (skillsData.skills?.length > 0) {
        const skillList = skillsData.skills.map((s: { id: string; name: string; description: string }) =>
          `- [${s.id}] ${s.description}`
        ).join("\n")
        skillsContext = `\nSKILLS DISPONIBLES :\n${skillList}\n\nQuand un message correspond à un skill, applique les instructions de ce skill. Tu peux demander le détail d'un skill via l'outil get_skill.`
      }
    } catch { /* skills unavailable, continue without */ }

    const systemPrompt = getSystemPrompt(compactionContext || undefined, memoryContext || undefined, skillsContext || undefined)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentMessages: any[] = messages.map((m: { role: string; content: string | any[] }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content, // Can be string or array of content blocks (text + image)
    }))

    let finalText = ""
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastUsage: any = null

    // Agentic loop — max 5 tool calls
    for (let i = 0; i < 5; i++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: actualModel,
          max_tokens: 16384,
          system: systemPrompt,
          tools: TOOLS,
          messages: currentMessages,
        }),
      })

      if (!response.ok) {
        return NextResponse.json({ error: "AI request failed" }, { status: 500 })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await response.json()
      lastUsage = data.usage

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolUses = data.content.filter((c: any) => c.type === "tool_use")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = data.content.find((c: any) => c.type === "text")

      // No more tool calls — we have our final answer
      if (toolUses.length === 0) {
        finalText = textBlock?.text || "Action effectuée."
        break
      }

      // Execute all tool calls in parallel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults = await Promise.all(toolUses.map(async (tu: any) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: await executeTool(tu.name, tu.input),
      })))

      // Append assistant turn + tool results for next iteration
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: data.content },
        { role: "user", content: toolResults },
      ]

      // If this was the last iteration, use any text we have
      if (i === 4) {
        finalText = textBlock?.text || "Actions effectuées."
      }
    }

    return NextResponse.json({ text: finalText, model: model || "claude-sonnet", usage: lastUsage })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
