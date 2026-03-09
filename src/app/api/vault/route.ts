import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb, initVaultSchema } from "@/lib/db"
import { encrypt, maskValue } from "@/lib/encrypt"

let ready = false
async function ensure() { if (!ready) { await initVaultSchema(); ready = true } }

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensure()
  const sql = getDb()
  const rows = await sql`
    SELECT id, category, name, icon, type, masked_value, status, note, created_at
    FROM vault_items WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `
  return NextResponse.json(rows.map(r => ({
    id: r.id, category: r.category, name: r.name, icon: r.icon,
    type: r.type, maskedValue: r.masked_value, status: r.status, note: r.note,
  })))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await ensure()
  const sql = getDb()
  const { category, name, icon, type, value, status, note } = await req.json()

  const encryptedValue = encrypt(value || "")
  const masked = maskValue(value || "")

  const rows = await sql`
    INSERT INTO vault_items (user_id, category, name, icon, type, encrypted_value, masked_value, status, note)
    VALUES (${userId}, ${category}, ${name}, ${icon || "🔑"}, ${type},
            ${encryptedValue}, ${masked}, ${status || "active"}, ${note || ""})
    RETURNING id, category, name, icon, type, masked_value, status, note
  `
  const r = rows[0]
  return NextResponse.json({
    id: r.id, category: r.category, name: r.name, icon: r.icon,
    type: r.type, maskedValue: r.masked_value, status: r.status, note: r.note,
  })
}
