import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"
import { decrypt } from "@/lib/encrypt"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sql = getDb()
  const rows = await sql`
    SELECT encrypted_value FROM vault_items
    WHERE id = ${params.id} AND user_id = ${userId}
  `
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const decrypted = decrypt(rows[0].encrypted_value)
  return NextResponse.json({ value: decrypted })
}
