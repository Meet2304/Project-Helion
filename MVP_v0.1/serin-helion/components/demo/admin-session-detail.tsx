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
  initialSession: ExamSession
}

export function AdminSessionDetail({
  initialSession,
}: AdminSessionDetailProps) {
  const [session, setSession] = useState(initialSession)

  useEffect(() => {
    const eventSource = new EventSource("/api/admin/stream")

    eventSource.onmessage = (event) => {
      const snapshot = JSON.parse(event.data) as AdminSnapshot
      const nextSession = snapshot.sessions.find(
        (candidateSession) => candidateSession.id === initialSession.id
      )

      if (nextSession) {
        setSession(nextSession)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [initialSession.id])

  const facts = useMemo(
    () => [
      ["Candidate", session.candidateName],
      ["Email or ID", session.candidateEmailOrId],
      ["Status", session.status.replaceAll("_", " ")],
      ["Last heartbeat", formatRelativeSeconds(session.lastHeartbeatAt)],
      ["Submitted at", formatTimestamp(session.submittedAt)],
      ["Browser exited at", formatTimestamp(session.browserExitedAt)],
      ["Violations", String(session.violationCount)],
      ["Fullscreen", session.isFullscreen ? "Locked" : "Exited"],
      ["Visibility", session.isVisible ? "Visible" : "Hidden"],
    ],
    [session]
  )

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
              {session.candidateName}
            </h1>
            <p className="text-sm text-slate-600">
              Session-specific monitoring timeline and current exam state.
            </p>
          </div>
          <Badge variant={getStatusTone(session.status)}>
            {session.status.replaceAll("_", " ")}
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
            {session.events.length > 0 ? (
              session.events.map((event) => (
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
