import { NextResponse } from "next/server"

import { submitSession } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await submitSession(id)

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  return NextResponse.json({ session })
}
