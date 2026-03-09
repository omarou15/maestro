import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import Anthropic from "@anthropic-ai/sdk"
import { getDb } from "@/lib/db"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { userMessage, assistantMessage } = await req.json()
  if (!userMessage || !assistantMessage) return NextResponse.json({ count: 0 })

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Analyse cet échange. Extrais UNIQUEMENT les informations importantes à mémoriser durablement (préférences, décisions, faits sur l'utilisateur, infos clients, apprentissages).
Ignore les questions simples, les salutations, les tâches ponctuelles sans valeur long terme.
Score 1-10 : retiens seulement si score >= 7.
Réponds UNIQUEMENT avec du JSON valide, rien d'autre.

Format: [{"type":"preference|decision|learning|client|process","title":"...","content":"...","tags":["..."],"score":8}]
Si rien à mémoriser: []

Échange:
User: ${userMessage.slice(0, 500)}
Maestro: ${assistantMessage.slice(0, 800)}`
      }],
    })

    const raw = (response.content[0] as { text: string }).text.trim()
    let items: { type: string; title: string; content: string; tags: string[]; score: number }[] = []
    try {
      const parsed = JSON.parse(raw)
      items = Array.isArray(parsed) ? parsed.filter(i => i.score >= 7) : []
    } catch { return NextResponse.json({ count: 0 }) }

    if (items.length === 0) return NextResponse.json({ count: 0 })

    const sql = getDb()
    for (const item of items) {
      await sql`
        INSERT INTO knowledge_items (user_id, type, title, content, tags, source, importance, score, linked_to)
        VALUES (
          ${userId}, ${item.type || "learning"}, ${item.title}, ${item.content},
          ${JSON.stringify(item.tags || [])}::jsonb, ${"Chat auto"},
          ${item.score >= 9 ? "haute" : item.score >= 7 ? "moyenne" : "basse"},
          ${item.score}, '[]'::jsonb
        )
      `
    }

    return NextResponse.json({ count: items.length })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
