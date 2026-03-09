import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const BACKEND = "http://178.156.251.108:4000"

// GET /api/skills — list all skills
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/skills`, { signal: AbortSignal.timeout(5000) })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ skills: [] })
  }
}
