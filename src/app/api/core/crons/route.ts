import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const BACKEND = "http://178.156.251.108:4000"

// GET /api/core/crons — list all crons
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/crons`, { signal: AbortSignal.timeout(5000) })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ crons: [] })
  }
}

// POST /api/core/crons — create new cron
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  try {
    const res = await fetch(`${BACKEND}/api/crons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

// PATCH /api/core/crons — update a cron (expects { id, ...fields } in body)
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  try {
    const res = await fetch(`${BACKEND}/api/crons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

// DELETE /api/core/crons — delete a cron (expects { id } in body)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })
  try {
    const res = await fetch(`${BACKEND}/api/crons/${body.id}`, { method: "DELETE" })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}
