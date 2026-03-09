import { NextRequest, NextResponse } from "next/server"

function getDateStr() {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  })
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const conversation = messages
      .filter((m: { role: string }) => m.role !== "system")
      .map((m: { role: string; text: string }) => `${m.role === "user" ? "USER" : "MAESTRO"}: ${m.text}`)
      .join("\n\n")

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `Tu es un système de compaction de mémoire. Tu reçois une conversation entre un utilisateur et Maestro (orchestrateur IA).

Tu dois extraire et résumer TOUS les points essentiels en un format structuré compact. Ne perds AUCUNE information importante.

Format de sortie (JSON strict, pas de markdown) :
{
  "summary": "Résumé en 2-3 phrases de la conversation",
  "decisions": ["liste des décisions prises"],
  "tasks": ["liste des tâches à faire / en cours"],
  "learnings": ["ce que Maestro a appris sur l'utilisateur"],
  "pending": ["questions en suspens / actions en attente"],
  "context": "contexte clé à retenir pour la suite"
}

Date actuelle : ${getDateStr()}`,
        messages: [{ role: "user", content: `Compacte cette conversation :\n\n${conversation}` }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Compaction failed" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || "{}"

    // Try to parse JSON from response
    let compacted
    try {
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()
      compacted = JSON.parse(cleaned)
    } catch {
      compacted = { summary: text, decisions: [], tasks: [], learnings: [], pending: [], context: "" }
    }

    return NextResponse.json({ compacted })
  } catch (error) {
    console.error("Compact API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
