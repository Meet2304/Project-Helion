"use client"

import Link from "next/link"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Terminal,
  Activity,
} from "lucide-react"

import {
  DEMO_EXAM_DURATION_MINUTES,
  DEMO_EXAM_TITLE,
  HEARTBEAT_INTERVAL_MS,
} from "@/lib/demo-config"
import { type ExamSession, type SessionEventInput } from "@/lib/demo-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type CandidateExamProps = {
  examCode: string
  examTitle?: string
}

type SessionState = {
  session: ExamSession
}

const questions = [
  {
    id: "q1",
    prompt: "Describe one policy a university could use to reduce impersonation risk in remote exams.",
  },
  {
    id: "q2",
    prompt: "List two candidate behaviors that should be highlighted on a live proctoring dashboard.",
  },
  {
    id: "q3",
    prompt: "Explain how Safe Exam Browser and session monitoring complement each other in this demo.",
  },
]

async function postJson<T>(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = (await response.json()) as T & { error?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed")
  }

  return payload
}

function getInitialSecondsRemaining() {
  return DEMO_EXAM_DURATION_MINUTES * 60
}

export function CandidateExam({
  examCode,
  examTitle = DEMO_EXAM_TITLE,
}: CandidateExamProps) {
  const [candidateName, setCandidateName] = useState("")
  const [candidateEmailOrId, setCandidateEmailOrId] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(getInitialSecondsRemaining)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const heartbeatRef = useRef<number | null>(null)
  const lastShortcutEventRef = useRef<{
    type:
      | "shortcut_tab_switch_attempt"
      | "shortcut_window_switch_attempt"
      | "shortcut_shutdown_attempt"
      | null
    timestamp: number
  }>({ type: null, timestamp: 0 })

  const session = sessionState?.session ?? null
  const isSubmitted = session?.status === "submitted"
  const isSessionClosed = session?.status === "browser_exited"

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(secondsRemaining / 60)
    const seconds = secondsRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [secondsRemaining])

  function syncSession(nextSession: ExamSession) {
    setSessionState({ session: nextSession })
  }

  const logSessionEvent = useEffectEvent(async (event: SessionEventInput) => {
    if (!session) {
      return
    }

    try {
      const payload = await postJson<{ session: ExamSession }>(
        `/api/demo/session/${session.id}/event`,
        event
      )

      syncSession(payload.session)
      if (event.severity !== "info") {
        setWarning(event.message)
      }
    } catch (requestError) {
      console.error(requestError)
    }
  })

  const sendHeartbeat = useEffectEvent(async () => {
    if (!session || isSessionClosed) {
      return
    }

    const isFullscreen = Boolean(document.fullscreenElement)
    const isVisible = document.visibilityState === "visible"

    try {
      const payload = await postJson<{ session: ExamSession }>(
        `/api/demo/session/${session.id}/heartbeat`,
        {
          isFullscreen,
          isVisible,
        }
      )

      syncSession(payload.session)
    } catch (requestError) {
      console.error(requestError)
    }
  })

  useEffect(() => {
    if (!session || isSessionClosed) {
      return
    }

    heartbeatRef.current = window.setInterval(() => {
      void sendHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current)
      }
    }
  }, [isSessionClosed, session])

  useEffect(() => {
    if (!session || isSubmitted || isSessionClosed) {
      return
    }

    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isSessionClosed, isSubmitted, session])

  useEffect(() => {
    if (!session || isSessionClosed) {
      return
    }

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        const recentShortcut =
          Date.now() - lastShortcutEventRef.current.timestamp < 1_200
            ? lastShortcutEventRef.current.type
            : null

        if (recentShortcut) {
          void logSessionEvent({
            type: recentShortcut,
            severity: "critical",
            message:
              recentShortcut === "shortcut_tab_switch_attempt"
                ? "Likely tab switch attempt inferred from keyboard shortcut and hidden document state."
                : recentShortcut === "shortcut_window_switch_attempt"
                  ? "Likely window or application switch attempt inferred from keyboard shortcut and hidden document state."
                  : "Likely shutdown or browser close attempt inferred from keyboard shortcut and hidden document state.",
          })
        }

        void logSessionEvent({
          type: "visibility_hidden",
          severity: "critical",
          message: "Candidate moved away from the exam tab or application.",
        })
      } else {
        void logSessionEvent({
          type: "window_focus",
          severity: "info",
          message: "Candidate returned focus to the exam window.",
        })
      }
    }

    const handleBlur = () => {
      const recentShortcut =
        Date.now() - lastShortcutEventRef.current.timestamp < 1_200
          ? lastShortcutEventRef.current.type
          : null

      if (recentShortcut) {
        void logSessionEvent({
          type: recentShortcut,
          severity: "critical",
          message:
            recentShortcut === "shortcut_tab_switch_attempt"
              ? "Likely tab switch attempt inferred from keyboard shortcut and window blur."
              : recentShortcut === "shortcut_window_switch_attempt"
                ? "Likely window or application switch attempt inferred from keyboard shortcut and window blur."
                : "Likely shutdown or browser close attempt inferred from keyboard shortcut and window blur.",
        })
      }

      void logSessionEvent({
        type: "window_blur",
        severity: "warning",
        message: "Exam window lost focus.",
      })
    }

    const handleCopy = () => {
      void logSessionEvent({
        type: "copy_attempt",
        severity: "warning",
        message: "Copy attempt detected inside the exam.",
      })
    }

    const handlePaste = () => {
      void logSessionEvent({
        type: "paste_attempt",
        severity: "warning",
        message: "Paste attempt detected inside the exam.",
      })
    }

    const handleCut = () => {
      void logSessionEvent({
        type: "cut_attempt",
        severity: "warning",
        message: "Cut attempt detected inside the exam.",
      })
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      void logSessionEvent({
        type: "context_menu",
        severity: "warning",
        message: "Context menu attempt blocked.",
      })
    }

    const handleFullscreenChange = () => {
      const type = document.fullscreenElement
        ? "fullscreen_restored"
        : "fullscreen_exit"

      void logSessionEvent({
        type,
        severity: document.fullscreenElement ? "info" : "critical",
        message: document.fullscreenElement
          ? "Fullscreen mode restored."
          : "Fullscreen mode exited during exam.",
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const metaOrCtrl = event.metaKey || event.ctrlKey
      const lowerKey = event.key.toLowerCase()

      if (metaOrCtrl && lowerKey === "c") {
        void logSessionEvent({
          type: "shortcut_copy_attempt",
          severity: "warning",
          message: "Copy keyboard shortcut detected during the exam.",
        })
        return
      }

      if (metaOrCtrl && lowerKey === "v") {
        void logSessionEvent({
          type: "shortcut_paste_attempt",
          severity: "warning",
          message: "Paste keyboard shortcut detected during the exam.",
        })
        return
      }

      if (metaOrCtrl && lowerKey === "x") {
        void logSessionEvent({
          type: "shortcut_cut_attempt",
          severity: "warning",
          message: "Cut keyboard shortcut detected during the exam.",
        })
        return
      }

      if (metaOrCtrl && lowerKey === "p") {
        event.preventDefault()
        void logSessionEvent({
          type: "shortcut_print_attempt",
          severity: "warning",
          message: "Print shortcut detected during the exam.",
        })
        return
      }

      if (event.key === "F12" || (metaOrCtrl && event.shiftKey && lowerKey === "i")) {
        event.preventDefault()
        void logSessionEvent({
          type: "shortcut_devtools_attempt",
          severity: "warning",
          message: "Developer tools shortcut detected during the exam.",
        })
        return
      }

      if (event.key === "Escape") {
        void logSessionEvent({
          type: "escape_key_attempt",
          severity: "warning",
          message: "Escape key pressed during the exam.",
        })
        return
      }

      if (event.altKey && event.key === "Tab") {
        lastShortcutEventRef.current = {
          type: "shortcut_tab_switch_attempt",
          timestamp: Date.now(),
        }
        void logSessionEvent({
          type: "shortcut_tab_switch_attempt",
          severity: "critical",
          message: "Likely Windows tab or app switch shortcut attempted during the exam.",
        })
        return
      }

      if (event.metaKey && event.key === "Tab") {
        lastShortcutEventRef.current = {
          type: "shortcut_window_switch_attempt",
          timestamp: Date.now(),
        }
        void logSessionEvent({
          type: "shortcut_window_switch_attempt",
          severity: "critical",
          message: "Likely macOS app switch shortcut attempted during the exam.",
        })
        return
      }

      if ((event.altKey && event.key === "F4") || (event.metaKey && lowerKey === "q")) {
        lastShortcutEventRef.current = {
          type: "shortcut_shutdown_attempt",
          timestamp: Date.now(),
        }
        void logSessionEvent({
          type: "shortcut_shutdown_attempt",
          severity: "critical",
          message: "Likely shutdown or browser close shortcut attempted during the exam.",
        })
        return
      }

      if ((metaOrCtrl && lowerKey === "w") || (metaOrCtrl && event.shiftKey && lowerKey === "w")) {
        lastShortcutEventRef.current = {
          type: "shortcut_window_switch_attempt",
          timestamp: Date.now(),
        }
        void logSessionEvent({
          type: "shortcut_window_switch_attempt",
          severity: "critical",
          message: "Likely browser close or window switch shortcut attempted during the exam.",
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("blur", handleBlur)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    document.addEventListener("cut", handleCut)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    window.addEventListener("keydown", handleKeyDown, true)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("blur", handleBlur)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
      document.removeEventListener("cut", handleCut)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [isSessionClosed, session])

  async function handleStartExam() {
    setError(null)
    setWarning(null)

    if (!candidateName.trim() || !candidateEmailOrId.trim()) {
      setError("Provide candidate name and ID before commencing.")
      return
    }

    setIsStarting(true)

    try {
      const payload = await postJson<{ session: ExamSession }>(
        "/api/demo/session/start",
        {
          candidateName: candidateName.trim(),
          candidateEmailOrId: candidateEmailOrId.trim(),
          examCode,
        }
      )

      setSecondsRemaining(getInitialSecondsRemaining())
      syncSession(payload.session)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "System failed to initialize session."
      )
    } finally {
      setIsStarting(false)
    }
  }

  async function handleSubmitExam() {
    if (!session) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload = await postJson<{ session: ExamSession }>(
        `/api/demo/session/${session.id}/submit`
      )

      syncSession(payload.session)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "System failed to submit examination."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const latestEvent = session?.latestEvent ?? null

  return (
    <div className="mx-auto flex min-h-screen w-full flex-col bg-slate-50 font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="hidden h-4 w-1 bg-primary sm:block" />
            <h1 className="text-lg font-medium text-slate-900 tracking-tight">
              {examTitle}
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            {session && (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700">
                <Activity className="size-3.5" />
                <span className="uppercase tracking-widest text-[10px]">{session.status.replaceAll("_", " ")}</span>
              </div>
            )}
            <div className="font-mono text-slate-900 tabular-nums">
              {timerLabel}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 lg:px-12 lg:py-16">
        
        {error && (
          <div className="mb-8 border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="size-4" /> System Error
            </div>
            {error}
          </div>
        )}

        {warning && (
          <div className="mb-8 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
             <div className="flex items-center gap-2 font-medium mb-1">
              <ShieldAlert className="size-4" /> Security Notice
            </div>
            {warning}
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px]">
          
          <section className="bg-white p-8 sm:p-12 border border-slate-200 shadow-sm">
            {!session ? (
              <div className="mx-auto max-w-lg space-y-10 py-10">
                <div className="space-y-3">
                  <h2 className="text-3xl font-light text-slate-900">Identity Verification</h2>
                  <p className="text-slate-500 font-light leading-relaxed">
                    Please provide your credentials. The environment will lock into fullscreen mode upon commencement.
                  </p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="candidate-name" className="uppercase text-xs tracking-widest text-slate-400">Legal Name</Label>
                    <Input
                      id="candidate-name"
                      value={candidateName}
                      onChange={(event) => setCandidateName(event.target.value)}
                      className="h-12 rounded-none border-slate-200 border-x-0 border-t-0 border-b-2 bg-transparent px-0 focus-visible:border-primary focus-visible:ring-0 text-base shadow-none text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="candidate-id" className="uppercase text-xs tracking-widest text-slate-400">Identification Number</Label>
                    <Input
                      id="candidate-id"
                      value={candidateEmailOrId}
                      onChange={(event) => setCandidateEmailOrId(event.target.value)}
                      className="h-12 rounded-none border-slate-200 border-x-0 border-t-0 border-b-2 bg-transparent px-0 focus-visible:border-primary focus-visible:ring-0 text-base shadow-none text-slate-900"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleStartExam} 
                  disabled={isStarting}
                  className="w-full h-14 rounded-none bg-primary text-white hover:bg-primary/90 font-medium uppercase tracking-widest text-sm"
                >
                  {isStarting ? "Initializing..." : "Commence Examination"}
                  {!isStarting && <ArrowRight className="ml-3 size-4" />}
                </Button>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="border-b border-slate-100 pb-6">
                  <h2 className="text-2xl font-light text-slate-900">Assessment Questionnaire</h2>
                </div>
                
                <div className="space-y-10">
                  {questions.map((question, index) => (
                    <div key={question.id} className="space-y-4">
                      <Label htmlFor={question.id} className="text-sm font-medium text-slate-900">
                        <span className="text-primary mr-2">{String(index + 1).padStart(2, '0')}</span>
                        {question.prompt}
                      </Label>
                      <textarea
                        id={question.id}
                        value={answers[question.id] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        disabled={isSubmitted}
                        className="min-h-[160px] w-full resize-y rounded-none border border-slate-200 bg-slate-50 p-4 text-base font-light outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter response..."
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-slate-100">
                  {!isSubmitted ? (
                    <Button 
                      onClick={handleSubmitExam} 
                      disabled={isSubmitting}
                      className="h-14 px-8 rounded-none bg-slate-900 text-white hover:bg-slate-800 font-medium uppercase tracking-widest text-sm"
                    >
                      {isSubmitting ? "Processing..." : "Conclude Assessment"}
                    </Button>
                  ) : (
                     <div className="inline-flex items-center gap-3 bg-green-50 text-green-800 px-6 py-4 border border-green-200">
                       <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-sm font-medium uppercase tracking-widest">Submission Recorded</span>
                     </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-8">
            <div className="bg-white border border-slate-200 p-6">
              <h3 className="text-xs font-medium uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                <Terminal className="size-4 text-primary" /> Telemetry
              </h3>
              
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wider mb-1">Subject</dt>
                  <dd className="font-medium text-slate-900">{candidateName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wider mb-1">Identifier</dt>
                  <dd className="font-mono text-slate-700">{candidateEmailOrId || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wider mb-1">Environment</dt>
                  <dd className="text-slate-700">
                    {session ? (session.isFullscreen ? "Secured (Fullscreen)" : "Compromised (Windowed)") : "Pending"}
                  </dd>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <dt className="text-xs text-slate-400 uppercase tracking-wider mb-1">Latest Log</dt>
                  <dd className="text-slate-600 font-light text-xs leading-relaxed">
                    {latestEvent ? latestEvent.message : "Awaiting events..."}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-slate-900 p-6 text-slate-300 border border-slate-800">
               <h3 className="text-xs font-medium uppercase tracking-widest text-white mb-4">
                Protocols
              </h3>
              <ul className="space-y-3 text-xs font-light leading-relaxed">
                <li className="flex gap-3">
                  <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  Maintain fullscreen continuously.
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  Clipboard actions are monitored and logged.
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  Loss of focus generates a critical alert.
                </li>
              </ul>
            </div>
          </aside>

        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest">
          Diagnostics <Link href="/admin" className="text-slate-900 hover:text-primary transition-colors underline underline-offset-4">Monitor Console</Link>
        </p>
      </footer>
    </div>
  )
}
