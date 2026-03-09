import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import Anthropic from "@anthropic-ai/sdk"
import { getDb } from "@/lib/db"

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: "No text" }, { status: 400 })

  // Ask Claude to extract structured knowledge
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Extrait les informations de cette note en JSON. Réponds UNIQUEMENT avec le JSON, rien d'autre.

Note: "${text}"

JSON à retourner:
{
  "type": "idea" | "decision" | "learning" | "client" | "process" | "preference",
  "title": "titre court (max 60 chars)",
  "content": "contenu détaillé et clair",
  "tags": ["tag1", "tag2", "tag3"],
  "importance": "haute" | "moyenne" | "basse"
}`
    }],
  })

  let parsed
  try {
    const raw = (response.content[0] as { text: string }).text.trim()
    parsed = JSON.parse(raw)
  } catch {
    // Fallback if Claude doesn't return valid JSON
    parsed = {
      type: "idea",
      title: text.substring(0, 60),
      content: text,
      tags: [],
      importance: "moyenne",
    }
  }

  const sql = getDb()
  const rows = await sql`
    INSERT INTO knowledge_items (user_id, type, title, content, tags, source, importance, linked_to)
    VALUES (
      ${userId}, ${parsed.type}, ${parsed.title}, ${parsed.content},
      ${JSON.stringify(parsed.tags || [])}::jsonb, ${"Capture rapide"},
      ${parsed.importance}, '[]'::jsonb
    )
    RETURNING *
  `
  const r = rows[0]
  return NextResponse.json({
    item: {
      id: r.id, type: r.type, title: r.title, content: r.content,
      tags: r.tags, source: r.source, importance: r.importance, linkedTo: r.linked_to,
      date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    },
    message: `💡 Capturé comme "${parsed.type}" — "${parsed.title}"`,
  })
}
