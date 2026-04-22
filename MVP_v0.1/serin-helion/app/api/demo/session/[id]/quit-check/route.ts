import { NextResponse } from "next/server"

import { DEMO_QUIT_PASSWORD } from "@/lib/demo-config"
import { allowQuit } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json()) as { password?: string }

  if (!body.password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 })
  }

  const success = body.password === DEMO_QUIT_PASSWORD
  const session = allowQuit(id, success)

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 })
  }

  return NextResponse.json({ session, success })
}
