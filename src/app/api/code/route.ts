import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 300

const BACKEND = "http://178.156.251.108:4000"

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 })

  try {
    const res = await fetch(`${BACKEND}/api/self-modify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(280000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ success: false, error: "Backend injoignable" }, { status: 500 })
  }
}
