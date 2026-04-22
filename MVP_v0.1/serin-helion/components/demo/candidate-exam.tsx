"use client"

import Link from "next/link"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Fullscreen,
  Shield,
} from "lucide-react"

import {
  DEMO_EXAM_DURATION_MINUTES,
  DEMO_EXAM_TITLE,
  HEARTBEAT_INTERVAL_MS,
} from "@/lib/demo-config"
import { formatTimestamp, getStatusTone } from "@/lib/demo-helpers"
import { type ExamSession, type SessionEventInput } from "@/lib/demo-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

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
  const [quitPassword, setQuitPassword] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState(getInitialSecondsRemaining)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingQuitPassword, setIsCheckingQuitPassword] = useState(false)
  const heartbeatRef = useRef<number | null>(null)

  const session = sessionState?.session ?? null
  const isSubmitted = session?.status === "submitted" || session?.status === "ready_to_quit"
  const isReadyToQuit = session?.status === "ready_to_quit"

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
    if (!session || isSubmitted) {
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
    if (!session || isSubmitted) {
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
  }, [isSubmitted, session])

  useEffect(() => {
    if (!session || isSubmitted || isReadyToQuit) {
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
  }, [isReadyToQuit, isSubmitted, session])

  useEffect(() => {
    if (!session || isSubmitted) {
      return
    }

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
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

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("blur", handleBlur)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    document.addEventListener("cut", handleCut)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("blur", handleBlur)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
      document.removeEventListener("cut", handleCut)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [isSubmitted, session])

  async function handleStartExam() {
    setError(null)
    setWarning(null)

    if (!candidateName.trim() || !candidateEmailOrId.trim()) {
      setError("Enter the candidate name and email or ID before starting.")
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

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.()
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not start the exam session."
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
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current)
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not submit the exam."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleQuitPasswordCheck() {
    if (!session) {
      return
    }

    setIsCheckingQuitPassword(true)
    setError(null)

    try {
      const payload = await postJson<{
        session: ExamSession
        success: boolean
      }>(`/api/demo/session/${session.id}/quit-check`, {
        password: quitPassword,
      })

      syncSession(payload.session)

      if (!payload.success) {
        setError("Quit password is incorrect.")
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not verify the quit password."
      )
    } finally {
      setIsCheckingQuitPassword(false)
    }
  }

  const latestEvent = session?.latestEvent ?? null

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit">
            Safe Exam Browser demo
          </Badge>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {examTitle}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Candidate session demo for Serin-Helion. SEB handles lockdown, while
            this page logs exam activity for the admin dashboard.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={session ? getStatusTone(session.status) : "outline"}>
            {session ? session.status.replaceAll("_", " ") : "not started"}
          </Badge>
          <Badge variant="outline">{timerLabel} remaining</Badge>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Action needed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {warning ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Monitoring alert</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Candidate exam workspace</CardTitle>
            <CardDescription>
              Keep the session in fullscreen and complete the mock assessment
              before requesting the quit password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!session ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="candidate-name">Candidate name</Label>
                  <Input
                    id="candidate-name"
                    value={candidateName}
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="Aarav Mehta"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="candidate-id">Email or candidate ID</Label>
                  <Input
                    id="candidate-id"
                    value={candidateEmailOrId}
                    onChange={(event) => setCandidateEmailOrId(event.target.value)}
                    placeholder="aarav@example.edu or HELION-1024"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((question, index) => (
                  <div key={question.id} className="space-y-2">
                    <Label htmlFor={question.id}>
                      Question {index + 1}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {question.prompt}
                    </p>
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
                      className="border-input bg-background min-h-28 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Type a concise response for the demo..."
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            {!session ? (
              <Button onClick={handleStartExam} disabled={isStarting}>
                <Shield className="size-4" />
                {isStarting ? "Starting session..." : "Start exam"}
              </Button>
            ) : !isSubmitted ? (
              <Button onClick={handleSubmitExam} disabled={isSubmitting}>
                <ClipboardList className="size-4" />
                {isSubmitting ? "Submitting..." : "Submit exam"}
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                Exam submitted. Request the quit password to close SEB.
              </span>
            )}
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session summary</CardTitle>
              <CardDescription>
                Live candidate context that mirrors what the admin sees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Exam code</span>
                <span className="font-medium">{examCode}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Candidate</span>
                <span className="text-right font-medium">
                  {candidateName || "Pending"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Identity</span>
                <span className="text-right font-medium">
                  {candidateEmailOrId || "Pending"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Fullscreen</span>
                <span className="font-medium">
                  {session ? (session.isFullscreen ? "Yes" : "No") : "Pending"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Last event</span>
                <span className="text-right font-medium">
                  {latestEvent ? latestEvent.message : "No activity yet"}
                </span>
              </div>
              {session ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Started</span>
                    <span className="text-right font-medium">
                      {formatTimestamp(session.startedAt)}
                    </span>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exam instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 size-4" />
                <p>Stay within Safe Exam Browser and remain in fullscreen.</p>
              </div>
              <div className="flex items-start gap-3">
                <Copy className="mt-0.5 size-4" />
                <p>Copy, paste, and context-menu attempts are recorded.</p>
              </div>
              <div className="flex items-start gap-3">
                <Fullscreen className="mt-0.5 size-4" />
                <p>Leaving fullscreen raises an immediate warning for admins.</p>
              </div>
              <div className="flex items-start gap-3">
                <ExternalLink className="mt-0.5 size-4" />
                <p>After submission, enter the hardcoded quit password to exit.</p>
              </div>
            </CardContent>
          </Card>

          {isSubmitted ? (
            <Card>
              <CardHeader>
                <CardTitle>Quit password check</CardTitle>
                <CardDescription>
                  SEB should only be closed after the exam is complete.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="quit-password">Quit password</Label>
                  <Input
                    id="quit-password"
                    type="password"
                    value={quitPassword}
                    onChange={(event) => setQuitPassword(event.target.value)}
                    placeholder="Enter the quit password"
                    disabled={isReadyToQuit}
                  />
                </div>
                <Button
                  onClick={handleQuitPasswordCheck}
                  disabled={isCheckingQuitPassword || isReadyToQuit}
                >
                  {isCheckingQuitPassword ? "Checking..." : "Validate password"}
                </Button>
                {isReadyToQuit ? (
                  <Alert>
                    <CheckCircle2 className="size-4" />
                    <AlertTitle>Candidate may now close SEB</AlertTitle>
                    <AlertDescription>
                      Quit access granted at {formatTimestamp(session?.lastHeartbeatAt ?? null)}.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Admin monitor available at{" "}
        <Link href="/admin" className="underline underline-offset-4">
          /admin
        </Link>
      </div>
    </div>
  )
}
