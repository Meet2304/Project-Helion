import { type ExamStatus, type SessionEvent } from "@/lib/demo-types"

export function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
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
