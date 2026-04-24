import { NextResponse } from "next/server"

import {
  addSessionEvent,
  bindExternalSessionId,
  ensureTelemetrySession,
  getSession,
  getSnapshot,
} from "@/lib/demo-store"
import { type EventSeverity, type SessionEventInput, type ViolationType } from "@/lib/demo-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeSeverity(value?: string): EventSeverity {
  const level = value?.toLowerCase().trim()

  if (level === "critical" || level === "error" || level === "fatal") {
    return "critical"
  }

  if (level === "warning" || level === "warn") {
    return "warning"
  }

  return "info"
}

function normalizeMessage(eventType: string, value?: string) {
  const message = value?.trim()

  if (message) {
    return message
  }

  return `Browser event captured: ${eventType.replaceAll("_", " ")}.`
}

function normalizeEvent(input: Record<string, unknown>): SessionEventInput | null {
  const type =
    (typeof input.type === "string" ? input.type : undefined) ||
    (typeof input.eventType === "string" ? input.eventType : undefined) ||
    (typeof input.event_name === "string" ? input.event_name : undefined) ||
    (typeof input.name === "string" ? input.name : undefined)

  if (!type) {
    return null
  }

  const severityRaw =
    (typeof input.severity === "string" ? input.severity : undefined) ||
    (typeof input.level === "string" ? input.level : undefined) ||
    (typeof input.priority === "string" ? input.priority : undefined)

  const messageRaw =
    (typeof input.message === "string" ? input.message : undefined) ||
    (typeof input.description === "string" ? input.description : undefined) ||
    (typeof input.details === "string" ? input.details : undefined)

  const source = typeof input.source === "string" ? input.source : undefined
  const category = typeof input.category === "string" ? input.category : undefined
  const metadata =
    input.metadata && typeof input.metadata === "object"
      ? (input.metadata as Record<string, string | number | boolean | null>)
      : undefined

  return {
    type: type as ViolationType,
    severity: normalizeSeverity(severityRaw),
    message: normalizeMessage(type, messageRaw),
    source: source as SessionEventInput["source"],
    category: category as SessionEventInput["category"],
    metadata,
  }
}

/**
 * POST /api/browser/telemetry
 *
 * Accepts telemetry events from the Serin Helion Browser (C# client).
 * This is the primary ingestion endpoint for browser-native monitoring events
 * such as keyboard blocks, clipboard clears, process terminations, etc.
 *
 * Body shape:
 * {
 *   sessionId: string,             // Existing session ID
 *   event: SessionEventInput       // The event payload
 * }
 *
 * OR for batch events:
 * {
 *   sessionId: string,
 *   events: SessionEventInput[]
 * }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const externalSessionId =
      (typeof body.sessionId === "string" ? body.sessionId : undefined) ||
      (typeof body.sessionID === "string" ? body.sessionID : undefined) ||
      (typeof body.session_id === "string" ? body.session_id : undefined) ||
      (typeof body.runtimeSessionId === "string" ? body.runtimeSessionId : undefined) ||
      (typeof body.clientSessionId === "string" ? body.clientSessionId : undefined) ||
      undefined

    const candidateName =
      (typeof body.candidateName === "string" ? body.candidateName : undefined) ||
      (typeof body.candidate_name === "string" ? body.candidate_name : undefined) ||
      undefined

    const candidateEmailOrId =
      (typeof body.candidateEmailOrId === "string" ? body.candidateEmailOrId : undefined) ||
      (typeof body.candidateEmail === "string" ? body.candidateEmail : undefined) ||
      (typeof body.candidateId === "string" ? body.candidateId : undefined) ||
      undefined

    const examCode =
      (typeof body.examCode === "string" ? body.examCode : undefined) ||
      (typeof body.exam_code === "string" ? body.exam_code : undefined) ||
      undefined

    const rawEvents = Array.isArray(body.events)
      ? body.events
      : body.event && typeof body.event === "object"
        ? [body.event]
        : (typeof body.type === "string" || typeof body.eventType === "string")
          ? [body]
          : []

    if (rawEvents.length === 0) {
      return NextResponse.json(
        { error: "No telemetry events were provided." },
        { status: 400 }
      )
    }

    let session = externalSessionId ? getSession(externalSessionId) : null

    if (!session) {
      session = ensureTelemetrySession({
        externalSessionId,
        candidateName,
        candidateEmailOrId,
        examCode,
      })
    }

    if (externalSessionId) {
      bindExternalSessionId(externalSessionId, session.id)
    }

    let accepted = 0
    let rejected = 0

    for (const entry of rawEvents) {
      if (!entry || typeof entry !== "object") {
        rejected++
        continue
      }

      const normalizedEvent = normalizeEvent(entry as Record<string, unknown>)

      if (!normalizedEvent) {
        rejected++
        continue
      }

      const persisted = addSessionEvent(session.id, {
        ...normalizedEvent,
        source: normalizedEvent.source ?? "browser",
      })

      if (persisted) {
        accepted++
      } else {
        rejected++
      }
    }

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      externalSessionId: externalSessionId ?? null,
      accepted,
      rejected,
    })
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }
}

/**
 * GET /api/browser/telemetry
 *
 * Returns all current sessions. Used by the browser to discover
 * if a session exists or to bootstrap initial state.
 */
export async function GET() {
  return NextResponse.json(getSnapshot())
}
