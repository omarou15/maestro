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

// GET /api/conversations — list all conversations for the user
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureSchema()
  const sql = getDb()
  const rows = await sql`
    SELECT id, title, messages, compacted_memory, message_count, created_at, updated_at
    FROM conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `
  const chats = rows.map(r => ({
    id: r.id,
    title: r.title,
    messages: r.messages,
    compactedMemory: r.compacted_memory,
    messageCount: r.message_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
  return NextResponse.json(chats)
}

// POST /api/conversations — create a new conversation
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await ensureSchema()
  const sql = getDb()
  const body = await req.json()
  const id = body.id || `chat_${Date.now()}`
  const title = body.title || "Nouvelle conversation"
  const now = new Date().toISOString()

  await sql`
    INSERT INTO conversations (id, user_id, title, messages, message_count, created_at, updated_at)
    VALUES (${id}, ${userId}, ${title}, '[]'::jsonb, 0, ${now}, ${now})
  `

  return NextResponse.json({
    id, title, messages: [], compactedMemory: null,
    messageCount: 0, createdAt: now, updatedAt: now,
  })
}
