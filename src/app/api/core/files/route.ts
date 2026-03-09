import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const BACKEND = "http://178.156.251.108:4000"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const name = req.nextUrl.searchParams.get("name")
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
  const res = await fetch(`${BACKEND}/api/files/${name}`)
  return NextResponse.json(await res.json())
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { name, content } = await req.json()
  const res = await fetch(`${BACKEND}/api/files/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  return NextResponse.json(await res.json())
}
