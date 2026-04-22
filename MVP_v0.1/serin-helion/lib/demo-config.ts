export const DEMO_EXAM_CODE =
  process.env.NEXT_PUBLIC_DEMO_EXAM_CODE ?? "serin-helion-demo"

export const DEMO_EXAM_TITLE =
  process.env.NEXT_PUBLIC_DEMO_EXAM_TITLE ?? "Serin-Helion Proctored Assessment"

export const DEMO_EXAM_DURATION_MINUTES = Number(
  process.env.NEXT_PUBLIC_DEMO_EXAM_DURATION_MINUTES ?? "15"
)

export const DEMO_QUIT_PASSWORD =
  process.env.DEMO_QUIT_PASSWORD ?? "SERIN-QUIT-2026"

export const DEMO_ADMIN_PASSCODE =
  process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSCODE ?? "HELION-ADMIN"

export const HEARTBEAT_INTERVAL_MS = 5_000
export const DISCONNECT_AFTER_MS = 15_000
export const MAX_EVENT_LOGS_PER_SESSION = 100
