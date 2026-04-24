import Database from "better-sqlite3"
import path from "path"
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
import { existsSync, mkdirSync } from "fs"

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

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  const dbPath = path.join(process.cwd(), "serin-helion.db")
  
  const dbDir = path.dirname(dbPath)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma("journal_mode = WAL")
  initDb(db)
  return db
}

function initDb(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      external_session_id TEXT,
      candidate_name TEXT NOT NULL,
      candidate_email_or_id TEXT NOT NULL,
      exam_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL,
      last_heartbeat_at TEXT NOT NULL,
      submitted_at TEXT,
      browser_exited_at TEXT,
      is_fullscreen INTEGER NOT NULL DEFAULT 1,
      is_visible INTEGER NOT NULL DEFAULT 1,
      violation_count INTEGER NOT NULL DEFAULT 0,
      latest_event_json TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_sessions_external_id ON sessions(external_session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_exam_code ON sessions(exam_code);
    CREATE INDEX IF NOT EXISTS idx_sessions_candidate_email ON sessions(candidate_email_or_id);
    
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT,
      category TEXT,
      metadata_json TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  `)
}

function rowToSession(row: any): ExamSession {
  return {
    id: row.id,
    externalSessionId: row.external_session_id || undefined,
    candidateName: row.candidate_name,
    candidateEmailOrId: row.candidate_email_or_id,
    examCode: row.exam_code,
    status: row.status as ExamStatus,
    startedAt: row.started_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    submittedAt: row.submitted_at,
    browserExitedAt: row.browser_exited_at,
    isFullscreen: Boolean(row.is_fullscreen),
    isVisible: Boolean(row.is_visible),
    violationCount: row.violation_count,
    latestEvent: row.latest_event_json ? JSON.parse(row.latest_event_json) : null,
    events: [],
  }
}

function rowToEvent(row: any): SessionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type as any,
    severity: row.severity as any,
    message: row.message,
    timestamp: row.timestamp,
    source: row.source as any,
    category: row.category as any,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  }
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

function resolveSessionKey(sessionId: string): string | null {
  const database = getDb()
  
  let row = database.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as any
  if (row) return row.id
  
  row = database.prepare("SELECT id FROM sessions WHERE external_session_id = ?").get(sessionId) as any
  if (row) return row.id
  
  return null
}

function getCanonicalSession(sessionId: string): ExamSession | null {
  const key = resolveSessionKey(sessionId)
  if (!key) return null

  const database = getDb()
  const sessionRow = database.prepare("SELECT * FROM sessions WHERE id = ?").get(key) as any
  if (!sessionRow) return null

  const session = rowToSession(sessionRow)
  
  const eventRows = database
    .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?")
    .all(key, MAX_EVENT_LOGS_PER_SESSION) as any[]
  
  session.events = eventRows.map(rowToEvent).reverse()
  
  return session
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
  const database = getDb()
  const rows = database
    .prepare("SELECT * FROM sessions ORDER BY last_heartbeat_at DESC")
    .all() as any[]

  return rows.map((row) => {
    const session = rowToSession(row)
    const eventRows = database
      .prepare("SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?")
      .all(session.id, MAX_EVENT_LOGS_PER_SESSION) as any[]
    session.events = eventRows.map(rowToEvent).reverse()
    return materializeSession(session)
  })
}

function emit() {
  const snapshot = getSnapshot()
  for (const listener of listeners) {
    listener(snapshot)
  }
}

function appendEvent(sessionId: string, eventInput: SessionEventInput): SessionEvent | null {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const database = getDb()
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

  database
    .prepare(
      `INSERT INTO events (id, session_id, type, severity, message, timestamp, source, category, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      eventId,
      sessionId,
      event.type,
      event.severity,
      event.message,
      timestamp,
      event.source,
      event.category,
      event.metadata ? JSON.stringify(event.metadata) : null
    )

  database.prepare("SELECT id FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1").get(sessionId)

  const violationCountDelta = event.severity !== "info" ? 1 : 0
  let visibleDelta = 0
  let fullscreenDelta = 0
  let newIsVisible = session.isVisible
  let newIsFullscreen = session.isFullscreen

  if (event.type === "visibility_hidden") {
    visibleDelta = -1
    newIsVisible = false
  }
  if (event.type === "window_focus") {
    visibleDelta = 1
    newIsVisible = true
  }
  if (event.type === "fullscreen_exit") {
    fullscreenDelta = -1
    newIsFullscreen = false
  }
  if (event.type === "fullscreen_restored") {
    fullscreenDelta = 1
    newIsFullscreen = true
  }
  if (event.type === "browser_lockdown_active") {
    fullscreenDelta = 1
    newIsFullscreen = true
  }
  if (event.type === "browser_lockdown_released") {
    fullscreenDelta = -1
    newIsFullscreen = false
  }
  if (event.type === "browser_exit_detected") {
    database.prepare("UPDATE sessions SET browser_exited_at = ? WHERE id = ?").run(timestamp, sessionId)
  }

  const latestEventJson = JSON.stringify(event)

  database.prepare(
    `UPDATE sessions SET 
      violation_count = violation_count + ?,
      is_visible = ?,
      is_fullscreen = ?,
      latest_event_json = ?,
      last_heartbeat_at = ?
     WHERE id = ?`
  ).run(
    violationCountDelta,
    newIsVisible ? 1 : 0,
    newIsFullscreen ? 1 : 0,
    latestEventJson,
    timestamp,
    sessionId
  )

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
  const database = getDb()
  const sessionId = createId("session")
  const now = new Date().toISOString()
  const externalSessionId = normalizeExternalSessionId(input.externalSessionId)

  database
    .prepare(
      `INSERT INTO sessions (id, external_session_id, candidate_name, candidate_email_or_id, exam_code, status, started_at, last_heartbeat_at, is_fullscreen, is_visible, violation_count)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, 1, 0)`
    )
    .run(
      sessionId,
      externalSessionId || null,
      input.candidateName,
      input.candidateEmailOrId,
      input.examCode,
      now,
      now
    )

  appendEvent(sessionId, {
    type: "session_started",
    severity: "info",
    message: "Candidate started the exam session.",
    source: "web",
    category: "session",
  })

  return cloneSession(getCanonicalSession(sessionId)!)
}

export function getSession(sessionId: string) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null
  return materializeSession(session)
}

export function updateHeartbeat(sessionId: string, patch?: SessionPatch) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const database = getDb()
  const now = new Date().toISOString()

  let isVisible = session.isVisible
  let isFullscreen = session.isFullscreen

  if (typeof patch?.isVisible === "boolean") {
    isVisible = patch.isVisible
  }
  if (typeof patch?.isFullscreen === "boolean") {
    isFullscreen = patch.isFullscreen
  }

  const status = patch?.status ?? deriveStatus(session)

  database.prepare(
    "UPDATE sessions SET last_heartbeat_at = ?, is_visible = ?, is_fullscreen = ?, status = ? WHERE id = ?"
  ).run(now, isVisible ? 1 : 0, isFullscreen ? 1 : 0, status, sessionId)

  emit()
  return cloneSession(getCanonicalSession(sessionId)!)
}

export function updateSessionCandidateInfo(
  sessionId: string,
  candidateName: string,
  candidateEmailOrId: string,
  externalSessionId?: string
) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const database = getDb()

  if (externalSessionId) {
    const normalized = normalizeExternalSessionId(externalSessionId)
    if (normalized) {
      database.prepare("UPDATE sessions SET external_session_id = ? WHERE id = ?").run(normalized, sessionId)
    }
  }

  database.prepare(
    "UPDATE sessions SET candidate_name = ?, candidate_email_or_id = ? WHERE id = ?"
  ).run(candidateName, candidateEmailOrId, sessionId)

  appendEvent(sessionId, {
    type: "session_updated",
    severity: "info",
    message: "Candidate info updated: " + candidateName,
    source: "web",
    category: "session",
  })

  emit()
  return cloneSession(getCanonicalSession(sessionId)!)
}

export function addSessionEvent(sessionId: string, eventInput: SessionEventInput) {
  const event = appendEvent(sessionId, eventInput)
  if (!event) return null

  return cloneSession(getCanonicalSession(sessionId)!)
}

export function submitSession(sessionId: string) {
  const session = getCanonicalSession(sessionId)
  if (!session) return null

  const database = getDb()
  const now = new Date().toISOString()

  database.prepare(
    "UPDATE sessions SET submitted_at = ?, status = 'submitted', last_heartbeat_at = ?, browser_exited_at = NULL WHERE id = ?"
  ).run(now, now, sessionId)

  appendEvent(sessionId, {
    type: "submit_exam",
    severity: "info",
    message: "Candidate submitted the exam.",
    source: "web",
    category: "session",
  })

  return cloneSession(getCanonicalSession(sessionId)!)
}

export function subscribeToSessions(listener: Listener) {
  listeners.add(listener)
  listener(getSnapshot())

  return () => {
    listeners.delete(listener)
  }
}

export function bindExternalSessionId(externalSessionId: string, sessionId: string) {
  const normalized = normalizeExternalSessionId(externalSessionId)
  if (!normalized) return false

  const session = getCanonicalSession(sessionId)
  if (!session) return false

  const database = getDb()
  database.prepare("UPDATE sessions SET external_session_id = ? WHERE id = ?").run(normalized, sessionId)

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
  const database = getDb()

  if (normalizedExternalSessionId) {
    const existingSession = getCanonicalSession(normalizedExternalSessionId)
    if (existingSession) {
      return cloneSession(existingSession)
    }
  }

  if (normalizedCandidateEmailOrId && normalizedExamCode) {
    const row = database
      .prepare("SELECT id FROM sessions WHERE candidate_email_or_id = ? AND exam_code = ? LIMIT 1")
      .get(normalizedCandidateEmailOrId, normalizedExamCode) as any

    if (row) {
      const session = getCanonicalSession(row.id)
      if (session) {
        if (normalizedExternalSessionId) {
          database.prepare("UPDATE sessions SET external_session_id = ? WHERE id = ?").run(
            normalizedExternalSessionId,
            session.id
          )
        }
        return cloneSession(session)
      }
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

      const database = getDb()
      database
        .prepare(
          `INSERT INTO events (id, session_id, type, severity, message, timestamp, source, category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          event.id,
          session.id,
          event.type,
          event.severity,
          event.message,
          event.timestamp,
          event.source,
          event.category
        )

      database.prepare("UPDATE sessions SET browser_exited_at = ? WHERE id = ?").run(
        next.browserExitedAt,
        session.id
      )

      session.events = [event, ...session.events].slice(0, MAX_EVENT_LOGS_PER_SESSION)
      session.latestEvent = event
    }
  }

  return next
}
