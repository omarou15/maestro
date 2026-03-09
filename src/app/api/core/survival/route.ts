import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const BACKEND = "http://178.156.251.108:4000"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const res = await fetch(`${BACKEND}/api/survival`, { signal: AbortSignal.timeout(5000) })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ score: 0, alive: false, error: "Backend unreachable" })
  }
}
