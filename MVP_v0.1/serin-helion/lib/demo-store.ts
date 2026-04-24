import {
  DISCONNECT_AFTER_MS,
  MAX_EVENT_LOGS_PER_SESSION,
} from "@/lib/demo-config"
import { inferEventCategory, inferEventSource } from "@/lib/demo-helpers"
import {
  type AdminSnapshot,
  type ExamSession,
  type ExamStatus,
  type SessionEvent,
  type SessionEventInput,
} from "@/lib/demo-types"

type SessionStartInput = {
  candidateName: string
  candidateEmailOrId: string
  examCode: string
  externalSessionId?: string
}

type SessionPatch = Partial<
  Pick<ExamSession, "isFullscreen" | "isVisible" | "status">
>

type Listener = (snapshot: AdminSnapshot) => void

const sessions = new Map<string, ExamSession>()
const externalSessionIds = new Map<string, string>()
const listeners = new Set<Listener>()

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function cloneSession(session: ExamSession): ExamSession {
  return {
    ...session,
    latestEvent: session.latestEvent ? { ...session.latestEvent } : null,
    events: session.events.map((event) => ({ ...event })),
  }
}

function normalizeExternalSessionId(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function resolveSessionKey(sessionId: string) {
  if (sessions.has(sessionId)) {
    return sessionId
  }

  const external = externalSessionIds.get(sessionId)
  if (external) {
    return external
  }

  return null
}

function getCanonicalSession(sessionId: string) {
  const key = resolveSessionKey(sessionId)

  if (!key) {
    return null
  }

  return sessions.get(key) ?? null
}

function deriveStatus(session: ExamSession): ExamStatus {
  const heartbeatAge = Date.now() - new Date(session.lastHeartbeatAt).getTime()

  if (session.submittedAt && heartbeatAge > DISCONNECT_AFTER_MS) {
    return "browser_exited"
  }

  if (!session.submittedAt && heartbeatAge > DISCONNECT_AFTER_MS) {
    return "disconnected"
  }

  if (session.submittedAt) {
    return "submitted"
  }

  if (!session.isFullscreen || !session.isVisible || session.violationCount > 0) {
    return "warning"
  }

  return "active"
}

function getOrderedSessions() {
  return Array.from(sessions.values())
    .map((session) => {
      return materializeSession(session)
    })
    .sort((left, right) => {
      return (
        new Date(right.lastHeartbeatAt).getTime() -
        new Date(left.lastHeartbeatAt).getTime()
      )
    })
}

function emit() {
  const snapshot = getSnapshot()

  for (const listener of listeners) {
    listener(snapshot)
  }
}

function appendEvent(sessionId: string, eventInput: SessionEventInput) {
  const session = getCanonicalSession(sessionId)

  if (!session) {
    return null
  }

  const event: SessionEvent = {
    id: createId("evt"),
    sessionId,
    timestamp: new Date().toISOString(),
    source: eventInput.source ?? inferEventSource(eventInput.type),
    category: eventInput.category ?? inferEventCategory(eventInput.type),
    ...eventInput,
  }

  session.events = [event, ...session.events].slice(0, MAX_EVENT_LOGS_PER_SESSION)
  session.latestEvent = event

  if (event.severity !== "info") {
    session.violationCount += 1
  }

  if (event.type === "visibility_hidden") {
    session.isVisible = false
  }

  if (event.type === "window_focus") {
    session.isVisible = true
  }

  if (event.type === "fullscreen_exit") {
    session.isFullscreen = false
  }

  if (event.type === "fullscreen_restored") {
    session.isFullscreen = true
  }

  if (event.type === "browser_exit_detected") {
    session.browserExitedAt = event.timestamp
  }

  // Handle browser-native lockdown events
  if (event.type === "browser_lockdown_active") {
    session.isFullscreen = true
  }

  if (event.type === "browser_lockdown_released") {
    session.isFullscreen = false
  }

  session.status = deriveStatus(session)
  emit()

  return event
}

export function getSnapshot(): AdminSnapshot {
  return {
    sessions: getOrderedSessions(),
    generatedAt: new Date().toISOString(),
  }
}

export function createSession(input: SessionStartInput) {
  const sessionId = createId("session")
  const now = new Date().toISOString()
  const externalSessionId = normalizeExternalSessionId(input.externalSessionId)

  const session: ExamSession = {
    id: sessionId,
    ...(externalSessionId ? { externalSessionId } : {}),
    candidateName: input.candidateName,
    candidateEmailOrId: input.candidateEmailOrId,
    examCode: input.examCode,
    status: "active",
    startedAt: now,
    lastHeartbeatAt: now,
    submittedAt: null,
    browserExitedAt: null,
    isFullscreen: true,
    isVisible: true,
    violationCount: 0,
    latestEvent: null,
    events: [],
  }

  sessions.set(sessionId, session)

  if (externalSessionId) {
    externalSessionIds.set(externalSessionId, sessionId)
  }

  appendEvent(sessionId, {
    type: "session_started",
    severity: "info",
    message: "Candidate started the exam session.",
    source: "web",
    category: "session",
  })

  return cloneSession(sessions.get(sessionId)!)
}

export function getSession(sessionId: string) {
  const session = getCanonicalSession(sessionId)

  if (!session) {
    return null
  }

  return materializeSession(session)
}

export function updateHeartbeat(sessionId: string, patch?: SessionPatch) {
  const session = getCanonicalSession(sessionId)

  if (!session) {
    return null
  }

  session.lastHeartbeatAt = new Date().toISOString()

  if (typeof patch?.isVisible === "boolean") {
    session.isVisible = patch.isVisible
  }

  if (typeof patch?.isFullscreen === "boolean") {
    session.isFullscreen = patch.isFullscreen
  }

  if (patch?.status) {
    session.status = patch.status
  } else {
    session.status = deriveStatus(session)
  }

  emit()
  return cloneSession(session)
}

export function updateSessionCandidateInfo(sessionId: string, candidateName: string, candidateEmailOrId: string) {
  const session = getCanonicalSession(sessionId)

  if (!session) {
    return null
  }

  session.candidateName = candidateName
  session.candidateEmailOrId = candidateEmailOrId

  appendEvent(sessionId, {
    type: "session_updated",
    severity: "info",
    message: "Candidate info updated: " + candidateName,
    source: "web",
    category: "session",
  })

  emit()
  return cloneSession(session)
}

export function addSessionEvent(sessionId: string, eventInput: SessionEventInput) {
  const event = appendEvent(sessionId, eventInput)

  if (!event) {
    return null
  }

  return cloneSession(sessions.get(sessionId)!)
}

export function submitSession(sessionId: string) {
  const session = getCanonicalSession(sessionId)

  if (!session) {
    return null
  }

  session.submittedAt = new Date().toISOString()
  session.status = "submitted"
  session.lastHeartbeatAt = new Date().toISOString()
  session.browserExitedAt = null

  appendEvent(sessionId, {
    type: "submit_exam",
    severity: "info",
    message: "Candidate submitted the exam.",
    source: "web",
    category: "session",
  })

  return cloneSession(sessions.get(sessionId)!)
}

export function subscribeToSessions(listener: Listener) {
  listeners.add(listener)
  listener(getSnapshot())

  return () => {
    listeners.delete(listener)
  }
}

export function bindExternalSessionId(externalSessionId: string, sessionId: string) {
  const normalizedExternalSessionId = normalizeExternalSessionId(externalSessionId)

  if (!normalizedExternalSessionId) {
    return false
  }

  const canonicalSession = getCanonicalSession(sessionId)

  if (!canonicalSession) {
    return false
  }

  canonicalSession.externalSessionId = normalizedExternalSessionId
  externalSessionIds.set(normalizedExternalSessionId, canonicalSession.id)
  emit()

  return true
}

export function ensureTelemetrySession(input: {
  externalSessionId?: string
  candidateName?: string
  candidateEmailOrId?: string
  examCode?: string
}) {
  const normalizedExternalSessionId = normalizeExternalSessionId(input.externalSessionId)
  const normalizedCandidateEmailOrId = input.candidateEmailOrId?.trim()
  const normalizedExamCode = input.examCode?.trim()

  if (normalizedExternalSessionId) {
    const existingSession = getCanonicalSession(normalizedExternalSessionId)

    if (existingSession) {
      return cloneSession(existingSession)
    }
  }

  if (normalizedCandidateEmailOrId && normalizedExamCode) {
    const matchedSession = Array.from(sessions.values()).find((session) => {
      return (
        session.candidateEmailOrId === normalizedCandidateEmailOrId &&
        session.examCode === normalizedExamCode
      )
    })

    if (matchedSession) {
      if (normalizedExternalSessionId) {
        matchedSession.externalSessionId = normalizedExternalSessionId
        externalSessionIds.set(normalizedExternalSessionId, matchedSession.id)
      }

      return cloneSession(matchedSession)
    }
  }

  const session = createSession({
    candidateName: input.candidateName?.trim() || "SEB Candidate",
    candidateEmailOrId: normalizedCandidateEmailOrId || "SEB-UNKNOWN",
    examCode: normalizedExamCode || "serin-helion-demo",
    externalSessionId: normalizedExternalSessionId ?? undefined,
  })

  return session
}

function materializeSession(session: ExamSession) {
  const next = cloneSession(session)
  next.status = deriveStatus(next)

  if (next.status === "browser_exited" && !next.browserExitedAt) {
    next.browserExitedAt = new Date().toISOString()
    session.browserExitedAt = next.browserExitedAt

    const existingExitEvent = session.events.find(
      (event) => event.type === "browser_exit_detected"
    )

    if (!existingExitEvent) {
      const event: SessionEvent = {
        id: createId("evt"),
        sessionId: session.id,
        type: "browser_exit_detected",
        severity: "info",
        message: "Browser session ended after exam submission.",
        timestamp: next.browserExitedAt,
        source: "system",
        category: "session",
      }

      session.events = [event, ...session.events].slice(0, MAX_EVENT_LOGS_PER_SESSION)
      session.latestEvent = event
    }
  }

  return next
}
