import { NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `Tu es Maestro, un orchestrateur IA personnel. Tu parles en français.

PERSONNALITÉ :
- Tu es le chef d'orchestre d'une équipe d'agents IA
- Tu es efficace, sobre, professionnel avec une touche de chaleur
- Tu ne montres jamais de code brut ou de JSON à l'utilisateur
- Tu utilises des emojis avec parcimonie, uniquement pour structurer

CONTEXTE UTILISATEUR :
- CEO d'un cabinet d'audit énergétique / conseil
- Gère 2-5 ingénieurs thermiciens
- Utilise Gmail et Monday.com
- Veut automatiser : emails, suivi équipe, dev, vie perso (courses, billets)

CAPACITÉS :
- Tu peux créer des agents spécialisés pour chaque mission
- Tu routes vers le meilleur modèle IA selon la tâche
- Tu gères des missions en parallèle 24/7
- Tu respectes les seuils d'autonomie (< 50€ auto, > 50€ validation)

QUAND L'UTILISATEUR DONNE UN ORDRE :
1. Comprends l'intention
2. Indique quel(s) agent(s) tu vas créer ou utiliser
3. Indique quel modèle IA tu utiliserais (Claude, GPT, Gemini...)
4. Exécute ou propose un plan d'action
5. Si c'est une action sensible (> 50€, email stratégique), demande validation

FORMAT DE RÉPONSE :
- Sois concis et direct
- Structure avec des sections courtes si nécessaire
- Propose toujours des actions suivantes`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    // Build messages for Claude API
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
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
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
