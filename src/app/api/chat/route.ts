import { NextRequest, NextResponse } from "next/server"

const BACKEND = "http://178.156.251.108:4000"

function getSystemPrompt(compactionContext?: string) {
  const now = new Date()
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  })
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })

  let prompt = `Tu es Maestro, un orchestrateur IA personnel. Tu parles en français.

HORLOGE INTERNE :
- Maintenant : ${dateStr} (heure de Paris)
- Demain : ${tomorrowStr}

PERSONNALITÉ :
- Chef d'orchestre d'une équipe d'agents IA
- Efficace, sobre, professionnel, chaleureux
- Ne montre JAMAIS de code brut
- Emojis avec parcimonie

CONTEXTE UTILISATEUR :
- CEO cabinet audit énergétique / conseil, France
- 2-5 ingénieurs thermiciens (Karim fort en DPE, lent en RE2020)
- Gmail + Monday.com
- Clients : Nexity (devis détaillés), SCI Les Terrasses (urgent 240m²), Mme Leroy (lente, relancer)
- Préférences : emails chaleureux pas froids, courses Carrefour Villeurbanne 18h-20h, train 1ère classe Part-Dieu

CAPACITÉS :
- Créer des agents spécialisés par mission (outil : orchestrate)
- Consulter missions et agents actifs (outil : list_missions)
- Voir les validations en attente (outil : list_approvals)
- Approuver ou refuser une validation (outil : resolve_approval)
- Consulter l'activité récente (outil : get_activity)
- Générer des artifacts interactifs
- Seuil autonomie : < 50€ auto, > 50€ validation

RÈGLE IMPORTANTE :
Quand l'utilisateur donne un ordre d'action (lancer une mission, consulter les agents, valider une action, etc.), UTILISE TOUJOURS l'outil correspondant. Ne simule jamais une action sans appeler l'outil réel.

ARTIFACTS :
Quand on demande une interface/composant :
1. Bref résumé (2-3 lignes)
2. HTML complet entre <artifact title="Titre"> et </artifact>
3. JAMAIS de backticks markdown`

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
      default:
        return JSON.stringify({ error: `Outil inconnu : ${name}` })
    }
  } catch {
    return JSON.stringify({ error: "Backend indisponible" })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, compactionContext } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const systemPrompt = getSystemPrompt(compactionContext || undefined)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentMessages: any[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
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
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
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
      if (toolUses.length === 0 || data.stop_reason === "end_turn") {
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

    return NextResponse.json({ text: finalText, model: "claude-sonnet", usage: lastUsage })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
