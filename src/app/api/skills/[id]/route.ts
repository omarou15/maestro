import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const BACKEND = "http://178.156.251.108:4000"

// GET /api/skills/[id] — get full skill
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/skills/${params.id}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

// PUT /api/skills/[id] — create or update skill
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  try {
    const res = await fetch(`${BACKEND}/api/skills/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}

// DELETE /api/skills/[id] — delete skill
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/skills/${params.id}`, { method: "DELETE" })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 })
  }
}
