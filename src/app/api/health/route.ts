import { NextResponse } from "next/server"
import { getDb, initSchema } from "@/lib/db"

export async function GET() {
  let dbOk = false
  try {
    const sql = getDb()
    await sql`SELECT 1 as ok`
    await initSchema()
    dbOk = true
  } catch { /* silent */ }
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: { ok: dbOk },
  })
}
