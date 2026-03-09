import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET() {
  // Test DB connection directly
  let dbStatus = "unknown"
  let dbError = ""
  let dbUrl = ""
  try {
    const raw = process.env.DATABASE_URL || ""
    // Show first 30 chars to debug without leaking full password
    dbUrl = raw.substring(0, 30) + "..."
    const sql = getDb()
    await sql`SELECT 1 as ok`
    dbStatus = "connected"
  } catch (e: unknown) {
    dbStatus = "error"
    dbError = e instanceof Error ? e.message : String(e)
  }
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db: { status: dbStatus, error: dbError || undefined, urlPrefix: dbUrl },
  })
}
