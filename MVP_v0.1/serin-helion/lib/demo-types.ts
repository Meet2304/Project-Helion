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
  // Browser-native events from Serin Helion Browser (C# side)
  | "keyboard_blocked"
  | "clipboard_cleared"
  | "process_blocked"
  | "process_terminated"
  | "window_hidden"
  | "window_closed"
  | "explorer_started"
  | "vm_detected"
  | "remote_session_detected"
  | "display_changed"
  | "mouse_blocked"
  | "focus_changed"
  | "application_started"
  | "application_terminated"
  | "system_event"
  | "browser_lockdown_active"
  | "browser_lockdown_released"
  | "screen_capture_blocked"
  | "print_screen_blocked"
  | "task_manager_blocked"
  | "alt_tab_blocked"
  | "windows_key_blocked"

export type EventSeverity = "info" | "warning" | "critical"

export type EventSource = "web" | "browser" | "system"

export type EventCategory =
  | "keyboard"
  | "clipboard"
  | "focus"
  | "fullscreen"
  | "process"
  | "system"
  | "network"
  | "session"

export type SessionEvent = {
  id: string
  sessionId: string
  type: ViolationType
  severity: EventSeverity
  message: string
  timestamp: string
  source?: EventSource
  category?: EventCategory
  metadata?: Record<string, string | number | boolean | null>
}

export type ExamSession = {
  id: string
  externalSessionId?: string
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
  source?: EventSource
  category?: EventCategory
  metadata?: Record<string, string | number | boolean | null>
}
