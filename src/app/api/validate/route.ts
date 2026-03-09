import { NextRequest, NextResponse } from "next/server"

function getDateStr() {
  const now = new Date()
  return now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  })
}

export async function POST(req: NextRequest) {
  try {
    const { action, decision, approvalId, reason } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    const prompt = decision === "approve"
      ? `L'utilisateur a APPROUVÉ cette action. Exécute-la et confirme ce que tu as fait.

Action approuvée : "${action}"

Réponds en 2-3 lignes max :
1. Confirme l'exécution
2. Résume ce qui a été fait
3. Propose une action suivante si pertinent

Date actuelle : ${getDateStr()}`
      : `L'utilisateur a REFUSÉ cette action. Confirme l'annulation.

Action refusée : "${action}"
${reason ? `Raison du refus : ${reason}` : ""}

Réponds en 2 lignes max :
1. Confirme l'annulation
2. Propose une alternative si pertinent

Date actuelle : ${getDateStr()}`

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: "Tu es Maestro, un orchestrateur IA. Tu confirmes les actions validées ou refusées par l'utilisateur. Sois concis et professionnel. Parle en français.",
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "AI request failed" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || "Action traitée."

    return NextResponse.json({
      text,
      decision,
      action,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Validate API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
