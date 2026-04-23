export type ExamStatus =
  | "not_started"
  | "active"
  | "warning"
  | "submitted"
  | "browser_exited"
  | "disconnected"

export type ViolationType =
  | "visibility_hidden"
  | "window_blur"
  | "window_focus"
  | "copy_attempt"
  | "paste_attempt"
  | "cut_attempt"
  | "shortcut_copy_attempt"
  | "shortcut_paste_attempt"
  | "shortcut_cut_attempt"
  | "shortcut_tab_switch_attempt"
  | "shortcut_window_switch_attempt"
  | "shortcut_shutdown_attempt"
  | "shortcut_new_tab_attempt"
  | "shortcut_new_window_attempt"
  | "shortcut_reload_attempt"
  | "shortcut_save_attempt"
  | "shortcut_find_attempt"
  | "shortcut_select_all_attempt"
  | "shortcut_address_bar_attempt"
  | "shortcut_history_navigation_attempt"
  | "shortcut_print_attempt"
  | "shortcut_devtools_attempt"
  | "escape_key_attempt"
  | "context_menu"
  | "fullscreen_exit"
  | "fullscreen_restored"
  | "heartbeat_missed"
  | "submit_exam"
  | "browser_exit_detected"
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
  browserExitedAt: string | null
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
