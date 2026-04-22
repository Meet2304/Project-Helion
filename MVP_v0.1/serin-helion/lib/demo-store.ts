import {
  DISCONNECT_AFTER_MS,
  MAX_EVENT_LOGS_PER_SESSION,
} from "@/lib/demo-config"
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
}

type SessionPatch = Partial<
  Pick<ExamSession, "isFullscreen" | "isVisible" | "status" | "quitAllowed">
>

type Listener = (snapshot: AdminSnapshot) => void

const sessions = new Map<string, ExamSession>()
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

function deriveStatus(session: ExamSession): ExamStatus {
  if (session.quitAllowed) {
    return "ready_to_quit"
  }

  if (session.submittedAt) {
    return "submitted"
  }

  const heartbeatAge = Date.now() - new Date(session.lastHeartbeatAt).getTime()

  if (heartbeatAge > DISCONNECT_AFTER_MS) {
    return "disconnected"
  }

  if (!session.isFullscreen || !session.isVisible || session.violationCount > 0) {
    return "warning"
  }

  return "active"
}

function getOrderedSessions() {
  return Array.from(sessions.values())
    .map((session) => {
      const next = cloneSession(session)
      next.status = deriveStatus(next)
      return next
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
  const session = sessions.get(sessionId)

  if (!session) {
    return null
  }

  const event: SessionEvent = {
    id: createId("evt"),
    sessionId,
    timestamp: new Date().toISOString(),
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

  const session: ExamSession = {
    id: sessionId,
    candidateName: input.candidateName,
    candidateEmailOrId: input.candidateEmailOrId,
    examCode: input.examCode,
    status: "active",
    startedAt: now,
    lastHeartbeatAt: now,
    submittedAt: null,
    quitAllowed: false,
    isFullscreen: true,
    isVisible: true,
    violationCount: 0,
    latestEvent: null,
    events: [],
  }

  sessions.set(sessionId, session)
  appendEvent(sessionId, {
    type: "session_started",
    severity: "info",
    message: "Candidate started the exam session.",
  })

  return cloneSession(sessions.get(sessionId)!)
}

export function getSession(sessionId: string) {
  const session = sessions.get(sessionId)

  if (!session) {
    return null
  }

  const next = cloneSession(session)
  next.status = deriveStatus(next)
  return next
}

export function updateHeartbeat(sessionId: string, patch?: SessionPatch) {
  const session = sessions.get(sessionId)

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

export function addSessionEvent(sessionId: string, eventInput: SessionEventInput) {
  const event = appendEvent(sessionId, eventInput)

  if (!event) {
    return null
  }

  return cloneSession(sessions.get(sessionId)!)
}

export function submitSession(sessionId: string) {
  const session = sessions.get(sessionId)

  if (!session) {
    return null
  }

  session.submittedAt = new Date().toISOString()
  session.status = "submitted"
  session.lastHeartbeatAt = new Date().toISOString()

  appendEvent(sessionId, {
    type: "submit_exam",
    severity: "info",
    message: "Candidate submitted the exam.",
  })

  return cloneSession(sessions.get(sessionId)!)
}

export function allowQuit(sessionId: string, allowed: boolean) {
  const session = sessions.get(sessionId)

  if (!session) {
    return null
  }

  session.quitAllowed = allowed
  session.status = allowed ? "ready_to_quit" : deriveStatus(session)
  session.lastHeartbeatAt = new Date().toISOString()

  appendEvent(sessionId, {
    type: allowed ? "quit_password_success" : "quit_password_failure",
    severity: allowed ? "info" : "warning",
    message: allowed
      ? "Correct quit password entered."
      : "Incorrect quit password entered.",
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
