import { NextResponse } from "next/server"

import { addSessionEvent } from "@/lib/demo-store"
import { type SessionEventInput } from "@/lib/demo-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json()) as Partial<SessionEventInput>

  if (!body.type || !body.severity || !body.message) {
    return NextResponse.json(
      { error: "Event type, severity, and message are required." },
      { status: 400 }
    )
  }

  const session = addSessionEvent(id, {
    type: body.type,
    severity: body.severity,
    message: body.message,
    metadata: body.metadata,
  })

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  return NextResponse.json({ session })
}
