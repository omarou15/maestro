import { NextResponse } from "next/server"
import { getDb, initSchema } from "@/lib/db"

export async function GET() {
  let dbStatus = "unknown"
  let dbError = ""
  let dbUrl = ""
  let convCount = 0
  let convList: { id: string; msgs: number; updated: string }[] = []
  try {
    const raw = process.env.DATABASE_URL || ""
    dbUrl = raw.substring(0, 30) + "..."
    const sql = getDb()
    await sql`SELECT 1 as ok`
    dbStatus = "connected"

    // Ensure schema exists
    await initSchema()

    // Count conversations
    const countRes = await sql`SELECT COUNT(*) as c FROM conversations`
    convCount = Number(countRes[0]?.c || 0)

    // List recent conversations
    const rows = await sql`SELECT id, message_count, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 5`
    convList = rows.map(r => ({
      id: String(r.id).substring(0, 20),
      msgs: Number(r.message_count),
      updated: String(r.updated_at),
    }))
  } catch (e: unknown) {
    dbStatus = "error"
    dbError = e instanceof Error ? e.message : String(e)
  }
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: { status: dbStatus, error: dbError || undefined, urlPrefix: dbUrl },
    conversations: { count: convCount, recent: convList },
  })
}
