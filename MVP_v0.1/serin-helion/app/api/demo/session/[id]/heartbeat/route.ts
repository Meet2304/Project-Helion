import { NextResponse } from "next/server"

import { updateHeartbeat } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json()) as {
    isFullscreen?: boolean
    isVisible?: boolean
  }

  const session = await updateHeartbeat(id, {
    isFullscreen: body.isFullscreen,
    isVisible: body.isVisible,
  })

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  return NextResponse.json({ session })
}
