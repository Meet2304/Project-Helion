import { NextResponse } from "next/server"

import { createSession, getSession, updateSessionCandidateInfo, bindExternalSessionId } from "@/lib/demo-store"

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
 *
 * OR to update an existing session with candidate info:
 * {
 *   sessionId: string,        // Existing session ID from C# browser
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

    const sessionId = body.sessionId?.trim() || body.externalSessionId?.trim()

    if (sessionId) {
      const existingSession = getSession(sessionId)

      if (existingSession) {
        if (body.candidateName?.trim() && body.candidateEmailOrId?.trim()) {
          const updated = updateSessionCandidateInfo(
            existingSession.id,
            body.candidateName.trim(),
            body.candidateEmailOrId.trim(),
            sessionId
          )

          return NextResponse.json({
            ok: true,
            sessionId: updated!.id,
            externalSessionId: updated!.externalSessionId ?? sessionId,
            session: updated,
          })
        }

        return NextResponse.json({
          ok: true,
          sessionId: existingSession.id,
          externalSessionId: existingSession.externalSessionId ?? sessionId,
          session: existingSession,
        })
      }
    }

    if (!body.examCode?.trim()) {
      return NextResponse.json(
        { error: "examCode is required." },
        { status: 400 }
      )
    }

    const defaultName = "SHB Candidate"
    const defaultEmailOrId = body.externalSessionId?.trim() || body.sessionId?.trim() || "SEB-UNKNOWN"

    const session = createSession({
      candidateName: body.candidateName?.trim() || defaultName,
      candidateEmailOrId: body.candidateEmailOrId?.trim() || defaultEmailOrId,
      examCode: body.examCode.trim(),
      externalSessionId: sessionId ?? undefined,
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
