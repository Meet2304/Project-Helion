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

const listeners = new Set<Listener>()

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

const sessions = new Map<string, ExamSession>()
const externalSessionIds = new Map<string, string>()
const externalSessionIdsReverse = new Map<string, string>()

const PERSISTENCE_KEY = "serin_helion_session"

function normalizeExternalSessionId(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function resolveSessionKey(sessionId: string): string | null {
  if (sessions.has(sessionId)) return sessionId
  const internalId = externalSessionIds.get(sessionId)
  if (internalId && sessions.has(internalId)) return internalId
  return null
}

function getCanonicalSession(sessionId: string): ExamSession | null {
  const key = resolveSessionKey(sessionId)
  if (!key) return null
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

function getOrderedSessions(): ExamSession[] {
  const list = Array.from(sessions.values())
  return list.map(materializeSession).sort(
    (a, b) =>
      new Date(b.lastHeartbeatAt).getTime() - new Date(a.lastHeartbeatAt).getTime()
  )
}

function emit() {
  getSnapshot().then((snapshot) => {
    for (const listener of listeners) {
      listener(snapshot)
    }
  })
}

function appendEvent(sessionId: string, eventInput: SessionEventInput): SessionEvent | null {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const eventId = createId("evt")
  const timestamp = new Date().toISOString()

  const event: SessionEvent = {
    id: eventId,
    sessionId,
    timestamp,
    source: eventInput.source ?? inferEventSource(eventInput.type),
    category: eventInput.category ?? inferEventCategory(eventInput.type),
    ...eventInput,
  }

  session.events = [event, ...session.events].slice(0, MAX_EVENT_LOGS_PER_SESSION)
  session.latestEvent = event

  const violationCountDelta = event.severity !== "info" ? 1 : 0
  session.violationCount += violationCountDelta

  if (event.type === "visibility_hidden") session.isVisible = false
  if (event.type === "window_focus") session.isVisible = true
  if (event.type === "fullscreen_exit") session.isFullscreen = false
  if (event.type === "fullscreen_restored") session.isFullscreen = true
  if (event.type === "browser_lockdown_active") session.isFullscreen = true
  if (event.type === "browser_lockdown_released") session.isFullscreen = false

  if (event.type === "browser_exit_detected") {
    session.browserExitedAt = timestamp
  }

  return event
}

function materializeSession(session: ExamSession): ExamSession {
  const next = cloneSession(session)
  next.status = deriveStatus(next)

  if (next.status === "browser_exited" && !next.browserExitedAt) {
    next.browserExitedAt = new Date().toISOString()

    const existingExitEvent = session.events.find((e) => e.type === "browser_exit_detected")
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
      next.events = [event, ...next.events].slice(0, MAX_EVENT_LOGS_PER_SESSION)
      next.latestEvent = event
    }
  }

  return next
}

function cloneSession(session: ExamSession): ExamSession {
  return {
    ...session,
    latestEvent: session.latestEvent ? { ...session.latestEvent } : null,
    events: session.events.map((event) => ({ ...event })),
  }
}

export async function getSnapshot(): Promise<AdminSnapshot> {
  return {
    sessions: getOrderedSessions(),
    generatedAt: new Date().toISOString(),
  }
}

export async function createSession(input: SessionStartInput) {
  const sessionId = createId("session")
  const now = new Date().toISOString()
  const externalId = normalizeExternalSessionId(input.externalSessionId)

  const session: ExamSession = {
    id: sessionId,
    externalSessionId: externalId ?? undefined,
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

  if (externalId) {
    externalSessionIds.set(externalId, sessionId)
    externalSessionIdsReverse.set(sessionId, externalId)
  }

  appendEvent(sessionId, {
    type: "session_started",
    severity: "info",
    message: "Candidate started the exam session.",
    source: "web",
    category: "session",
  })

  return cloneSession(session)
}

export async function getSession(sessionId: string) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null
  return materializeSession(session)
}

export async function updateHeartbeat(sessionId: string, patch?: SessionPatch) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const now = new Date().toISOString()
  session.lastHeartbeatAt = now

  if (typeof patch?.isVisible === "boolean") session.isVisible = patch.isVisible
  if (typeof patch?.isFullscreen === "boolean") session.isFullscreen = patch.isFullscreen
  if (patch?.status) session.status = patch.status
  else session.status = deriveStatus(session)

  emit()
  return cloneSession(materializeSession(session))
}

export async function updateSessionCandidateInfo(
  sessionId: string,
  candidateName: string,
  candidateEmailOrId: string,
  externalSessionId?: string
) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const normalizedExternalId = normalizeExternalSessionId(externalSessionId)
  const oldExternalId = session.externalSessionId

  if (normalizedExternalId && normalizedExternalId !== oldExternalId) {
    if (oldExternalId) {
      externalSessionIds.delete(oldExternalId)
      externalSessionIdsReverse.delete(sessionId)
    }
    externalSessionIds.set(normalizedExternalId, sessionId)
    externalSessionIdsReverse.set(sessionId, normalizedExternalId)
    session.externalSessionId = normalizedExternalId
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

  return cloneSession(session)
}

export async function addSessionEvent(sessionId: string, eventInput: SessionEventInput) {
  const event = appendEvent(sessionId, eventInput)
  if (!event) return null

  const session = getCanonicalSession(sessionId)
  emit()
  return cloneSession(session!)
}

export async function submitSession(sessionId: string) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const now = new Date().toISOString()
  session.submittedAt = now
  session.status = "submitted"
  session.lastHeartbeatAt = now
  session.browserExitedAt = null

  appendEvent(sessionId, {
    type: "submit_exam",
    severity: "info",
    message: "Candidate submitted the exam.",
    source: "web",
    category: "session",
  })

  emit()
  return cloneSession(session)
}

export function subscribeToSessions(listener: Listener) {
  listeners.add(listener)
  getSnapshot().then((snapshot) => listener(snapshot))

  return () => {
    listeners.delete(listener)
  }
}

export async function bindExternalSessionId(externalSessionId: string, sessionId: string) {
  const normalized = normalizeExternalSessionId(externalSessionId)
  if (!normalized) return false

  const session = getCanonicalSession(sessionId)
  if (!session) return false

  if (session.externalSessionId && session.externalSessionId !== normalized) {
    externalSessionIds.delete(session.externalSessionId)
  }

  session.externalSessionId = normalized
  externalSessionIds.set(normalized, sessionId)
  externalSessionIdsReverse.set(sessionId, normalized)
  emit()
  return true
}

type SessionPersistData = {
  sessionId: string
  candidateName: string
  candidateEmailOrId: string
  examCode: string
  externalSessionId?: string
  startedAt: string
  lastHeartbeatAt: string
}

export async function ensureTelemetrySession(input: {
  externalSessionId?: string
  candidateName?: string
  candidateEmailOrId?: string
  examCode?: string
}) {
  const normalizedExternalId = normalizeExternalSessionId(input.externalSessionId)
  const normalizedEmail = input.candidateEmailOrId?.trim()
  const normalizedExamCode = input.examCode?.trim()

  if (normalizedExternalId) {
    const existing = getCanonicalSession(normalizedExternalId)
    if (existing) return cloneSession(existing)
  }

  if (normalizedEmail && normalizedExamCode) {
    for (const session of sessions.values()) {
      if (
        session.candidateEmailOrId === normalizedEmail &&
        session.examCode === normalizedExamCode
      ) {
        if (normalizedExternalId) {
          await bindExternalSessionId(normalizedExternalId, session.id)
        }
        return cloneSession(session)
      }
    }
  }

  const session = await createSession({
    candidateName: input.candidateName?.trim() || "SEB Candidate",
    candidateEmailOrId: normalizedEmail || "SEB-UNKNOWN",
    examCode: normalizedExamCode || "serin-helion-demo",
    externalSessionId: normalizedExternalId ?? undefined,
  })

  return session
}

export async function reconnectSession(data: SessionPersistData): Promise<ExamSession | null> {
  const existing = getCanonicalSession(data.sessionId)
  if (existing) return cloneSession(existing)

  if (data.externalSessionId) {
    const byExternal = getCanonicalSession(data.externalSessionId)
    if (byExternal) return cloneSession(byExternal)
  }

  const now = new Date().toISOString()

  const session: ExamSession = {
    id: data.sessionId,
    externalSessionId: data.externalSessionId ?? undefined,
    candidateName: data.candidateName,
    candidateEmailOrId: data.candidateEmailOrId,
    examCode: data.examCode,
    status: "active",
    startedAt: data.startedAt,
    lastHeartbeatAt: data.lastHeartbeatAt,
    submittedAt: null,
    browserExitedAt: null,
    isFullscreen: true,
    isVisible: true,
    violationCount: 0,
    latestEvent: null,
    events: [],
  }

  sessions.set(data.sessionId, session)

  if (data.externalSessionId) {
    externalSessionIds.set(data.externalSessionId, data.sessionId)
    externalSessionIdsReverse.set(data.sessionId, data.externalSessionId)
  }

  appendEvent(data.sessionId, {
    type: "session_started",
    severity: "info",
    message: "Candidate resumed the exam session.",
    source: "web",
    category: "session",
  })

  emit()
  return cloneSession(session)
}

export { type SessionPersistData }