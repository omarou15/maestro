import { NextRequest, NextResponse } from "next/server"

const BACKEND = "http://178.156.251.108:4000"

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/missions`, { cache: "no-store" })
    const data = await res.json()
    return NextResponse.json(data.missions ?? data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${BACKEND}/api/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 503 })
  }
}
