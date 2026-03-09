import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sql = getDb()
  const { type, title, content, tags, source, importance, linkedTo } = await req.json()
  await sql`
    UPDATE knowledge_items SET
      type = ${type}, title = ${title}, content = ${content},
      tags = ${JSON.stringify(tags || [])}::jsonb, source = ${source},
      importance = ${importance}, linked_to = ${JSON.stringify(linkedTo || [])}::jsonb,
      updated_at = NOW()
    WHERE id = ${params.id} AND user_id = ${userId}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sql = getDb()
  await sql`DELETE FROM knowledge_items WHERE id = ${params.id} AND user_id = ${userId}`
  return NextResponse.json({ ok: true })
}
