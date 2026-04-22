"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"

import {
  formatRelativeSeconds,
  formatTimestamp,
  getSeverityTone,
  getStatusTone,
} from "@/lib/demo-helpers"
import { type AdminSnapshot, type ExamSession } from "@/lib/demo-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AdminSessionDetailProps = {
  sessionId: string
  initialSession: ExamSession | null
}

export function AdminSessionDetail({
  sessionId,
  initialSession,
}: AdminSessionDetailProps) {
  const [session, setSession] = useState(initialSession)
  const [notFound, setNotFound] = useState(false)
  const cachedSession = useMemo(() => {
    if (typeof window === "undefined") {
      return null
    }

    const cached = window.sessionStorage.getItem(
      `serin-admin-session:${sessionId}`
    )

    if (!cached) {
      return null
    }

    try {
      return JSON.parse(cached) as ExamSession
    } catch {
      window.sessionStorage.removeItem(`serin-admin-session:${sessionId}`)
      return null
    }
  }, [sessionId])

  const resolvedSession = session ?? cachedSession

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      try {
        const response = await fetch(`/api/admin/sessions/${sessionId}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          if (response.status === 404 && !resolvedSession && !cancelled) {
            setNotFound(true)
          }
          return
        }

        const payload = (await response.json()) as { session: ExamSession }

        if (!cancelled) {
          setSession(payload.session)
          setNotFound(false)

          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
              `serin-admin-session:${sessionId}`,
              JSON.stringify(payload.session)
            )
          }
        }
      } catch {
        if (!resolvedSession && !cancelled) {
          setNotFound(true)
        }
      }
    }

    void loadSession()

    const eventSource = new EventSource("/api/admin/stream")

    eventSource.onmessage = (event) => {
      const snapshot = JSON.parse(event.data) as AdminSnapshot
      const nextSession = snapshot.sessions.find(
        (candidateSession) => candidateSession.id === sessionId
      )

      if (nextSession) {
        setSession(nextSession)
        setNotFound(false)

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            `serin-admin-session:${sessionId}`,
            JSON.stringify(nextSession)
          )
        }
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      cancelled = true
      eventSource.close()
    }
  }, [resolvedSession, sessionId])

  const facts = useMemo(
    () =>
      resolvedSession
        ? [
            ["Candidate", resolvedSession.candidateName],
            ["Email or ID", resolvedSession.candidateEmailOrId],
            ["Status", resolvedSession.status.replaceAll("_", " ")],
            ["Last heartbeat", formatRelativeSeconds(resolvedSession.lastHeartbeatAt)],
            ["Submitted at", formatTimestamp(resolvedSession.submittedAt)],
            ["Browser exited at", formatTimestamp(resolvedSession.browserExitedAt)],
            ["Violations", String(resolvedSession.violationCount)],
            ["Fullscreen", resolvedSession.isFullscreen ? "Locked" : "Exited"],
            ["Visibility", resolvedSession.isVisible ? "Visible" : "Hidden"],
          ]
        : [],
    [resolvedSession]
  )

  if (!resolvedSession && notFound) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="rounded-[2rem] border border-primary/10 bg-white/92 p-6 shadow-sm">
          <Button asChild variant="ghost" className="h-auto w-fit px-0 text-primary hover:bg-transparent">
            <Link href="/admin">
              <ArrowLeft className="size-4" />
              Back to sessions
            </Link>
          </Button>
          <div className="mt-6 space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-950">
              Session not found
            </h1>
            <p className="text-sm text-slate-600">
              This demo keeps sessions in memory, so the detail view can disappear
              after a server reload. Open the session again from the admin dashboard
              after starting a fresh candidate session.
            </p>
          </div>
        </section>
      </div>
    )
  }

  if (!resolvedSession) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <section className="rounded-[2rem] border border-primary/10 bg-white/92 p-6 shadow-sm">
          <p className="text-sm text-slate-600">Loading session details...</p>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-[2rem] border border-primary/10 bg-white/92 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" className="h-auto px-0 text-primary hover:bg-transparent">
              <Link href="/admin">
                <ArrowLeft className="size-4" />
                Back to sessions
              </Link>
            </Button>
            <Badge variant="outline" className="border-primary/15 bg-primary/5 text-primary">
              Session detail
            </Badge>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-slate-950">
              {resolvedSession.candidateName}
            </h1>
            <p className="text-sm text-slate-600">
              Session-specific monitoring timeline and current exam state.
            </p>
          </div>
          <Badge variant={getStatusTone(resolvedSession.status)}>
            {resolvedSession.status.replaceAll("_", " ")}
          </Badge>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-primary/10 bg-white/94 p-4 shadow-sm">
        <div className="mb-4 border-b border-primary/10 pb-4">
          <p className="text-sm font-medium text-slate-900">Session facts</p>
        </div>
        <Table>
          <TableBody>
            {facts.map(([label, value]) => (
              <TableRow key={label}>
                <TableHead className="w-56">{label}</TableHead>
                <TableCell>{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-[1.75rem] border border-primary/10 bg-white/94 p-4 shadow-sm">
        <div className="mb-4 border-b border-primary/10 pb-4">
          <p className="text-sm font-medium text-slate-900">Event timeline</p>
          <p className="text-xs text-slate-500">
            All browser-observable actions and best-effort inferred shortcut attempts.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolvedSession.events.length > 0 ? (
              resolvedSession.events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {formatTimestamp(event.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityTone(event.severity)}>
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-slate-500">
                    {event.type.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell className="text-slate-700">{event.message}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                  No session events yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
