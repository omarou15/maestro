import { NextResponse } from "next/server"
import { getDb, initSchema } from "@/lib/db"

export async function GET() {
  let dbStatus = "unknown"
  let dbError = ""
  let dbUrl = ""
  let convCount = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let convDebug: any = null
  try {
    const raw = process.env.DATABASE_URL || ""
    dbUrl = raw.substring(0, 30) + "..."
    const sql = getDb()
    await sql`SELECT 1 as ok`
    dbStatus = "connected"

    await initSchema()

    const countRes = await sql`SELECT COUNT(*) as c FROM conversations`
    convCount = Number(countRes[0]?.c || 0)

    // Get full latest conversation to debug message format
    const rows = await sql`SELECT id, title, messages, message_count, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 1`
    if (rows.length > 0) {
      const r = rows[0]
      const msgs = r.messages
      convDebug = {
        id: r.id,
        title: r.title,
        messageCount: r.message_count,
        messagesType: typeof msgs,
        messagesIsArray: Array.isArray(msgs),
        messagesLength: Array.isArray(msgs) ? msgs.length : (typeof msgs === 'string' ? msgs.length : 0),
        firstMessage: Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : (typeof msgs === 'string' ? msgs.substring(0, 100) : null),
        updated: String(r.updated_at),
      }
    }
  } catch (e: unknown) {
    dbStatus = "error"
    dbError = e instanceof Error ? e.message : String(e)
  }
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: { status: dbStatus, error: dbError || undefined, urlPrefix: dbUrl },
    conversations: { count: convCount, debug: convDebug },
  })
}
