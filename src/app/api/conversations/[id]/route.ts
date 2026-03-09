import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb, initSchema } from "@/lib/db"

let schemaReady = false

async function ensureSchema() {
  if (!schemaReady) {
    await initSchema()
    schemaReady = true
  }
}

// GET /api/conversations/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureSchema()
  const sql = getDb()
  const rows = await sql`
    SELECT id, title, messages, compacted_memory, message_count, created_at, updated_at
    FROM conversations
    WHERE id = ${params.id} AND user_id = ${userId}
  `
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const r = rows[0]
  return NextResponse.json({
    id: r.id, title: r.title, messages: r.messages,
    compactedMemory: r.compacted_memory, messageCount: r.message_count,
    createdAt: r.created_at, updatedAt: r.updated_at,
  })
}

// PUT /api/conversations/[id] — update messages, title, compacted_memory
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureSchema()
  const sql = getDb()
  const body = await req.json()
  const now = new Date().toISOString()

  if (body.compactedMemory !== undefined) {
    await sql`
      UPDATE conversations
      SET messages = ${JSON.stringify(body.messages)}::jsonb,
          title = COALESCE(${body.title || null}, title),
          compacted_memory = ${JSON.stringify(body.compactedMemory)}::jsonb,
          message_count = ${body.messages?.length || 0},
          updated_at = ${now}
      WHERE id = ${params.id} AND user_id = ${userId}
    `
  } else {
    await sql`
      UPDATE conversations
      SET messages = ${JSON.stringify(body.messages)}::jsonb,
          title = COALESCE(${body.title || null}, title),
          message_count = ${body.messages?.length || 0},
          updated_at = ${now}
      WHERE id = ${params.id} AND user_id = ${userId}
    `
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/conversations/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureSchema()
  const sql = getDb()
  await sql`DELETE FROM conversations WHERE id = ${params.id} AND user_id = ${userId}`
  return NextResponse.json({ ok: true })
}
