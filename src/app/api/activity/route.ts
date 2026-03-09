import { NextResponse } from "next/server"

const BACKEND = "http://178.156.251.108:4000"

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/activity`, { cache: "no-store" })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
