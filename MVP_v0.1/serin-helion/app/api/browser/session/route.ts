import { NextResponse } from "next/server"

import { createSession, getSession } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/browser/session
 *
 * Called by the Serin Helion Browser to register a new exam session
 * when a candidate starts. The browser sends candidate identity and
 * exam code, and receives back a session ID to use for telemetry.
 *
 * Body:
 * {
 *   candidateName: string,
 *   candidateEmailOrId: string,
 *   examCode: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      candidateName?: string
      candidateEmailOrId?: string
      examCode?: string
      sessionId?: string
      externalSessionId?: string
    }

    const externalSessionId =
      body.externalSessionId?.trim() || body.sessionId?.trim() || undefined

    if (externalSessionId) {
      const existingSession = getSession(externalSessionId)

      if (existingSession) {
        return NextResponse.json({
          ok: true,
          sessionId: existingSession.id,
          externalSessionId: existingSession.externalSessionId ?? externalSessionId,
          session: existingSession,
        })
      }
    }

    if (
      !body.candidateName?.trim() ||
      !body.candidateEmailOrId?.trim() ||
      !body.examCode?.trim()
    ) {
      return NextResponse.json(
        { error: "candidateName, candidateEmailOrId, and examCode are required." },
        { status: 400 }
      )
    }

    const session = createSession({
      candidateName: body.candidateName.trim(),
      candidateEmailOrId: body.candidateEmailOrId.trim(),
      examCode: body.examCode,
      externalSessionId,
    })

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      externalSessionId: session.externalSessionId ?? null,
      session,
    })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }
}
