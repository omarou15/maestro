import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb, initKnowledgeSchema } from "@/lib/db"

let ready = false
async function ensure() { if (!ready) { await initKnowledgeSchema(); ready = true } }

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensure()
  const sql = getDb()
  const rows = await sql`
    SELECT id, type, title, content, tags, source, importance, linked_to, created_at, updated_at
    FROM knowledge_items WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `
  return NextResponse.json(rows.map(r => ({
    id: r.id, type: r.type, title: r.title, content: r.content,
    tags: r.tags, source: r.source, importance: r.importance,
    linkedTo: r.linked_to,
    date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  })))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensure()
  const sql = getDb()
  const { type, title, content, tags, source, importance, linkedTo } = await req.json()

  const rows = await sql`
    INSERT INTO knowledge_items (user_id, type, title, content, tags, source, importance, linked_to)
    VALUES (
      ${userId}, ${type || "idea"}, ${title}, ${content},
      ${JSON.stringify(tags || [])}::jsonb, ${source || "Manuel"},
      ${importance || "moyenne"}, ${JSON.stringify(linkedTo || [])}::jsonb
    )
    RETURNING *
  `
  const r = rows[0]
  return NextResponse.json({
    id: r.id, type: r.type, title: r.title, content: r.content,
    tags: r.tags, source: r.source, importance: r.importance,
    linkedTo: r.linked_to,
    date: new Date(r.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  })
}
