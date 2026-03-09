import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDb } from "@/lib/db"

const BACKEND = "http://178.156.251.108:4000"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [backendRes, dbRes] = await Promise.allSettled([
    fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(3000) }).then(r => r.json()),
    (async () => { const sql = getDb(); await sql`SELECT 1 as ok`; return { ok: true } })(),
  ])

  const backend = backendRes.status === "fulfilled" ? backendRes.value : null
  const db = dbRes.status === "fulfilled"

  return NextResponse.json({
    backend: {
      ok: !!backend,
      uptime: backend?.uptime ? Math.round(backend.uptime / 60) : null,
      missions: backend?.missions ?? null,
      startedAt: backend?.startedAt ?? null,
    },
    db: { ok: db },
    vercel: { ok: true },
    checkedAt: new Date().toISOString(),
  })
}
