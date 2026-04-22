"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Activity, ShieldAlert, Terminal } from "lucide-react"

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
  
  // Need to read cache conditionally to avoid hydration mismatch, but it's simpler to just let useEffect handle the fetch.
  // We'll trust initialSession if present, else fallback to fetch.
  const resolvedSession = session

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
        }
      } catch {
        if (!resolvedSession && !cancelled) {
          setNotFound(true)
        }
      }
    }

    if (!initialSession) {
       void loadSession()
    }

    const eventSource = new EventSource("/api/admin/stream")

    eventSource.onmessage = (event) => {
      const snapshot = JSON.parse(event.data) as AdminSnapshot
      const nextSession = snapshot.sessions.find(
        (candidateSession) => candidateSession.id === sessionId
      )

      if (nextSession) {
        setSession(nextSession)
        setNotFound(false)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      cancelled = true
      eventSource.close()
    }
  }, [resolvedSession, sessionId, initialSession])

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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 p-8 sm:p-12 space-y-6 text-center">
           <ShieldAlert className="size-10 text-slate-300 mx-auto" strokeWidth={1.5} />
           <div className="space-y-2">
            <h1 className="text-2xl font-light tracking-tight text-slate-900">
              Session Not Found
            </h1>
            <p className="text-sm font-light text-slate-500 leading-relaxed">
              This demo keeps sessions in memory. Open a session from the admin dashboard after starting a fresh candidate session.
            </p>
          </div>
          <div className="pt-4">
             <Button asChild variant="outline" className="w-full rounded-none h-12 uppercase tracking-widest text-xs font-medium border-slate-200 hover:bg-slate-50">
              <Link href="/admin">
                <ArrowLeft className="mr-2 size-4" />
                Return to Monitor
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!resolvedSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-slate-400">
           <Activity className="size-6 animate-pulse" />
           <p className="text-xs uppercase tracking-widest font-medium">Synchronizing Data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      <header className="bg-white border-b border-slate-200 px-6 py-8 sm:px-12 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
             <Button asChild variant="ghost" className="h-auto px-0 text-slate-500 hover:text-slate-900 hover:bg-transparent uppercase tracking-widest text-xs font-medium transition-colors">
              <Link href="/admin">
                <ArrowLeft className="mr-2 size-4" />
                Back to Session Overview
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center text-xs font-medium text-primary uppercase tracking-widest">
                Target Telemetry
              </div>
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-slate-900">
                {resolvedSession.candidateName}
              </h1>
              <p className="text-slate-500 font-light max-w-xl">
                 Detailed monitoring timeline and environmental state analysis for the current assessment window.
              </p>
            </div>
            
            <div className="flex items-center">
              <Badge variant={getStatusTone(resolvedSession.status)} className="rounded-sm font-medium uppercase tracking-wider text-xs px-4 py-1.5 h-auto">
                {resolvedSession.status.replaceAll("_", " ")}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 sm:px-12 mt-12 grid gap-12 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr]">
        
        <aside className="space-y-8">
           <section className="bg-white border border-slate-200">
            <div className="border-b border-slate-200 p-6 bg-slate-50/50">
              <h2 className="text-sm font-medium uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Session Variables
              </h2>
            </div>
            <div className="p-6">
              <dl className="space-y-5 text-sm">
                {facts.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <dt className="text-xs text-slate-400 uppercase tracking-wider">{label}</dt>
                    <dd className="font-medium text-slate-900">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </aside>

        <section className="bg-white border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 p-6 bg-slate-50/50">
             <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <Terminal className="size-4 text-primary" /> Event Log
              </h2>
              <p className="text-xs text-slate-500 mt-2 font-light">
                Chronological record of browser interactions and inferred shortcut anomalies.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 hover:bg-transparent bg-white">
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs pl-6">Timestamp</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs">Level</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs">Action</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs pr-6">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedSession.events.length > 0 ? (
                  [...resolvedSession.events].reverse().map((event) => (
                    <TableRow key={event.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <TableCell className="pl-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {formatTimestamp(event.timestamp)}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={getSeverityTone(event.severity)} className="rounded-sm font-medium uppercase tracking-wider text-[10px] px-2 py-0.5">
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs font-medium text-slate-900">
                        {event.type.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell className="pr-6 py-4 text-sm text-slate-600 font-light leading-relaxed">
                        {event.message}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-sm text-slate-500">
                      Awaiting telemetry events...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

      </main>
    </div>
  )
}

