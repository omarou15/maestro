import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"
import { encrypt, maskValue } from "@/lib/encrypt"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sql = getDb()
  const { category, name, icon, type, value, status, note } = await req.json()

  if (value !== undefined && value !== "") {
    // Update with new encrypted value
    const encryptedValue = encrypt(value)
    const masked = maskValue(value)
    await sql`
      UPDATE vault_items SET
        category = ${category}, name = ${name}, icon = ${icon}, type = ${type},
        encrypted_value = ${encryptedValue}, masked_value = ${masked},
        status = ${status}, note = ${note}, updated_at = NOW()
      WHERE id = ${params.id} AND user_id = ${userId}
    `
  } else {
    // Update without changing the value
    await sql`
      UPDATE vault_items SET
        category = ${category}, name = ${name}, icon = ${icon}, type = ${type},
        status = ${status}, note = ${note}, updated_at = NOW()
      WHERE id = ${params.id} AND user_id = ${userId}
    `
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const sql = getDb()
  await sql`DELETE FROM vault_items WHERE id = ${params.id} AND user_id = ${userId}`
  return NextResponse.json({ ok: true })
}
