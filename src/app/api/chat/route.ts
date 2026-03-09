import { NextRequest, NextResponse } from "next/server"

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
- Créer des agents spécialisés par mission
- Router vers le meilleur modèle IA
- Générer des artifacts interactifs
- Seuil autonomie : < 50€ auto, > 50€ validation

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

export async function POST(req: NextRequest) {
  try {
    const { messages, compactionContext } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const claudeMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }))

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
        system: getSystemPrompt(compactionContext || undefined),
        messages: claudeMessages,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "AI request failed" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || "Désolé, erreur."

    return NextResponse.json({ text, model: "claude-sonnet", usage: data.usage })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
