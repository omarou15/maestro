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
    name: "web_search",
    description: "Recherche sur le web. Utilise cet outil quand tu as besoin d'informations actuelles, de prix, de news, ou quand tu ne connais pas la réponse. Aussi utile pour vérifier des faits récents.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "La requête de recherche" },
      },
      required: ["query"],
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
      case "web_search": {
        // Use DuckDuckGo lite + Google fallback
        const q = encodeURIComponent(input.query)
        try {
          // Try Google first (more reliable)
          const res = await fetch(`https://www.google.com/search?q=${q}&num=5&hl=fr`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
            signal: AbortSignal.timeout(10000),
          })
          const html = await res.text()
          // Extract results from Google HTML
          const results: string[] = []
          const regex = /<a href="\/url\?q=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g
          let match
          while ((match = regex.exec(html)) !== null && results.length < 5) {
            const url = decodeURIComponent(match[1])
            if (url.startsWith("http") && !url.includes("google.com") && !url.includes("youtube.com/results")) {
              const title = match[2].replace(/<[^>]+>/g, "").trim()
              if (title) results.push(`${title}\n${url}`)
            }
          }
          // Also try to extract snippets
          const snippets: string[] = []
          const snipRegex = /<span class="st">([\s\S]*?)<\/span>/g
          while ((match = snipRegex.exec(html)) !== null && snippets.length < 5) {
            snippets.push(match[1].replace(/<[^>]+>/g, "").trim())
          }
          if (results.length > 0) {
            return `Résultats pour "${input.query}":\n\n${results.map((r, i) => `${i + 1}. ${r}${snippets[i] ? "\n   " + snippets[i] : ""}`).join("\n\n")}`
          }
          return `Recherche "${input.query}" — pas de résultats exploitables. Essaie de reformuler.`
        } catch {
          return `Erreur de recherche pour "${input.query}". Le service est temporairement indisponible.`
        }
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
