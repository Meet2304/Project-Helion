import { NextResponse } from "next/server"

import { addSessionEvent, createSession, getSnapshot } from "@/lib/demo-store"
import { type SessionEventInput } from "@/lib/demo-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    const body = (await request.json()) as {
      sessionId?: string
      event?: Partial<SessionEventInput>
      events?: Partial<SessionEventInput>[]
    }

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      )
    }

    // Handle single event
    if (body.event) {
      if (!body.event.type || !body.event.severity || !body.event.message) {
        return NextResponse.json(
          { error: "Event type, severity, and message are required." },
          { status: 400 }
        )
      }

      const session = addSessionEvent(body.sessionId, {
        type: body.event.type,
        severity: body.event.severity,
        message: body.event.message,
        source: body.event.source ?? "browser",
        category: body.event.category,
        metadata: body.event.metadata,
      })

      if (!session) {
        return NextResponse.json(
          { error: "Session not found." },
          { status: 404 }
        )
      }

      return NextResponse.json({ ok: true, sessionId: body.sessionId })
    }

    // Handle batch events
    if (body.events && Array.isArray(body.events)) {
      let accepted = 0
      let rejected = 0

      for (const evt of body.events) {
        if (!evt.type || !evt.severity || !evt.message) {
          rejected++
          continue
        }

        const session = addSessionEvent(body.sessionId, {
          type: evt.type,
          severity: evt.severity,
          message: evt.message,
          source: evt.source ?? "browser",
          category: evt.category,
          metadata: evt.metadata,
        })

        if (session) {
          accepted++
        } else {
          rejected++
        }
      }

      return NextResponse.json({ ok: true, accepted, rejected })
    }

    return NextResponse.json(
      { error: "Either 'event' or 'events' field is required." },
      { status: 400 }
    )
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
