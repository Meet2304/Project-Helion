export type ExamStatus =
  | "not_started"
  | "active"
  | "warning"
  | "submitted"
  | "ready_to_quit"
  | "disconnected"

export type ViolationType =
  | "visibility_hidden"
  | "window_blur"
  | "window_focus"
  | "copy_attempt"
  | "paste_attempt"
  | "cut_attempt"
  | "context_menu"
  | "fullscreen_exit"
  | "fullscreen_restored"
  | "heartbeat_missed"
  | "submit_exam"
  | "quit_password_success"
  | "quit_password_failure"
  | "session_started"

export type EventSeverity = "info" | "warning" | "critical"

export type SessionEvent = {
  id: string
  sessionId: string
  type: ViolationType
  severity: EventSeverity
  message: string
  timestamp: string
  metadata?: Record<string, string | number | boolean | null>
}

export type ExamSession = {
  id: string
  candidateName: string
  candidateEmailOrId: string
  examCode: string
  status: ExamStatus
  startedAt: string
  lastHeartbeatAt: string
  submittedAt: string | null
  quitAllowed: boolean
  isFullscreen: boolean
  isVisible: boolean
  violationCount: number
  latestEvent: SessionEvent | null
  events: SessionEvent[]
}

export type AdminSnapshot = {
  sessions: ExamSession[]
  generatedAt: string
}

export type SessionEventInput = {
  type: ViolationType
  severity: EventSeverity
  message: string
  metadata?: Record<string, string | number | boolean | null>
}
