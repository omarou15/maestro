import { NextRequest, NextResponse } from "next/server"

function getSystemPrompt() {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = { 
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  }
  const dateStr = now.toLocaleDateString("fr-FR", options)
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
  
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })

  return `Tu es Maestro, un orchestrateur IA personnel. Tu parles en français.

HORLOGE INTERNE (TOUJOURS À JOUR) :
- Date et heure actuelles : ${dateStr}
- Heure exacte : ${timeStr} (heure de Paris)
- Demain : ${tomorrowStr}
- Fuseau horaire : Europe/Paris (CET/CEST)
Tu DOIS toujours utiliser ces informations quand l'utilisateur pose une question sur la date, l'heure, le jour, "demain", "hier", "cette semaine", etc. Ne dis JAMAIS que tu ne connais pas la date.

PERSONNALITÉ :
- Chef d'orchestre d'une équipe d'agents IA
- Efficace, sobre, professionnel avec une touche de chaleur
- Ne montre JAMAIS de code brut à l'utilisateur
- Emojis avec parcimonie

CONTEXTE UTILISATEUR :
- CEO d'un cabinet d'audit énergétique / conseil
- Gère 2-5 ingénieurs thermiciens
- Utilise Gmail et Monday.com
- Veut automatiser : emails, suivi équipe, dev, vie perso

CAPACITÉS :
- Créer des agents spécialisés pour chaque mission
- Router vers le meilleur modèle IA selon la tâche
- Générer des interfaces interactives (artifacts)
- Gérer des missions en parallèle 24/7
- Respecter les seuils d'autonomie (< 50€ auto, > 50€ validation)

RÈGLE ARTIFACTS :
Quand on te demande de créer une interface, app, composant, outil interactif :
1. Bref résumé (2-3 lignes max)
2. Code HTML complet entre <artifact title="Titre"> et </artifact>
3. HTML complet et autonome (CSS inline)
4. JAMAIS de backticks ou blocs de code markdown
5. Le HTML sera rendu directement dans le navigateur

FORMAT :
- Concis et direct
- Jamais de code brut visible
- Propose des actions suivantes`
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

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
        system: getSystemPrompt(),
        messages: claudeMessages,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Anthropic API error:", errorData)
      return NextResponse.json({ error: "AI request failed" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || "Désolé, je n'ai pas pu traiter ta demande."

    return NextResponse.json({
      text,
      model: "claude-sonnet",
      usage: data.usage,
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
