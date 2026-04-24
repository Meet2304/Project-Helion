import {
  type EventCategory,
  type EventSource,
  type ExamStatus,
  type SessionEvent,
  type ViolationType,
} from "@/lib/demo-types"

export function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatPreciseTimestamp(value: string | null) {
  if (!value) {
    return "—"
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(new Date(value))
}

export function formatRelativeSeconds(value: string) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 1000)
  )

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s ago`
}

export function getStatusTone(status: ExamStatus) {
  switch (status) {
    case "active":
      return "default"
    case "warning":
      return "secondary"
    case "submitted":
      return "outline"
    case "browser_exited":
      return "default"
    case "disconnected":
      return "destructive"
    default:
      return "outline"
  }
}

export function getSeverityTone(event: SessionEvent["severity"]) {
  switch (event) {
    case "critical":
      return "destructive"
    case "warning":
      return "secondary"
    default:
      return "outline"
  }
}

export function inferEventCategory(type: ViolationType): EventCategory {
  if (
    type.startsWith("shortcut_") ||
    type === "keyboard_blocked" ||
    type === "keyboard_allowed" ||
    type === "escape_key_attempt" ||
    type === "alt_tab_blocked" ||
    type === "windows_key_blocked" ||
    type === "task_manager_blocked" ||
    type === "print_screen_blocked"
  ) {
    return "keyboard"
  }

  if (
    type === "copy_attempt" ||
    type === "paste_attempt" ||
    type === "cut_attempt" ||
    type === "clipboard_cleared"
  ) {
    return "clipboard"
  }

  if (
    type === "visibility_hidden" ||
    type === "window_blur" ||
    type === "window_focus" ||
    type === "focus_changed"
  ) {
    return "focus"
  }

  if (type === "fullscreen_exit" || type === "fullscreen_restored") {
    return "fullscreen"
  }

  if (
    type === "process_blocked" ||
    type === "process_terminated" ||
    type === "window_hidden" ||
    type === "window_closed" ||
    type === "explorer_started" ||
    type === "application_started" ||
    type === "application_terminated"
  ) {
    return "process"
  }

  if (
    type === "vm_detected" ||
    type === "remote_session_detected" ||
    type === "display_changed" ||
    type === "mouse_blocked" ||
    type === "screen_capture_blocked" ||
    type === "print_screen_blocked" ||
    type === "browser_lockdown_active" ||
    type === "browser_lockdown_released" ||
    type === "system_event" ||
    type === "browser_exit_detected"
  ) {
    return "system"
  }

  return "session"
}

export function inferEventSource(type: ViolationType): EventSource {
  const browserNativeTypes: ViolationType[] = [
    "browser_exit_detected",
    "keyboard_blocked",
    "keyboard_allowed",
    "clipboard_cleared",
    "process_blocked",
    "process_terminated",
    "window_hidden",
    "window_closed",
    "explorer_started",
    "vm_detected",
    "remote_session_detected",
    "display_changed",
    "mouse_blocked",
    "focus_changed",
    "application_started",
    "application_terminated",
    "system_event",
    "browser_lockdown_active",
    "browser_lockdown_released",
    "screen_capture_blocked",
    "print_screen_blocked",
    "task_manager_blocked",
    "alt_tab_blocked",
    "windows_key_blocked",
    "shortcut_copy_allowed",
    "shortcut_paste_allowed",
    "shortcut_cut_allowed",
    "shortcut_select_all_allowed",
    "shortcut_undo_allowed",
    "shortcut_redo_allowed",
    "shortcut_save_allowed",
    "shortcut_print_allowed",
    "shortcut_new_allowed",
    "shortcut_new_tab_allowed",
    "shortcut_close_tab_allowed",
    "shortcut_next_tab_allowed",
    "shortcut_find_allowed",
    "shortcut_history_allowed",
    "shortcut_reload_allowed",
  ]

  if (browserNativeTypes.includes(type)) {
    return "browser"
  }

  return "web"
}

export function getEventCategoryLabel(category: EventCategory): string {
  switch (category) {
    case "keyboard":
      return "Keyboard"
    case "clipboard":
      return "Clipboard"
    case "focus":
      return "Focus"
    case "fullscreen":
      return "Fullscreen"
    case "process":
      return "Process"
    case "system":
      return "System"
    case "network":
      return "Network"
    case "session":
      return "Session"
  }
}

export function getEventCategoryColor(category: EventCategory): string {
  switch (category) {
    case "keyboard":
      return "bg-violet-100 text-violet-800 border-violet-200"
    case "clipboard":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "focus":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "fullscreen":
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    case "process":
      return "bg-rose-100 text-rose-800 border-rose-200"
    case "system":
      return "bg-slate-100 text-slate-800 border-slate-200"
    case "network":
      return "bg-teal-100 text-teal-800 border-teal-200"
    case "session":
      return "bg-emerald-100 text-emerald-800 border-emerald-200"
  }
}

export function getSeverityColor(severity: SessionEvent["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200"
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "info":
      return "bg-slate-50 text-slate-600 border-slate-200"
  }
}

export function getSourceLabel(source: EventSource): string {
  switch (source) {
    case "web":
      return "Web"
    case "browser":
      return "Browser"
    case "system":
      return "System"
  }
}

export function getSourceColor(source: EventSource): string {
  switch (source) {
    case "web":
      return "bg-sky-100 text-sky-700 border-sky-200"
    case "browser":
      return "bg-violet-100 text-violet-700 border-violet-200"
    case "system":
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}
