"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Activity,
  ShieldAlert,
  Terminal,
  Filter,
  Keyboard,
  Clipboard,
  Eye,
  Maximize,
  Cpu,
  Settings,
  Globe,
  BarChart3,
  AlertTriangle,
  Info,
  Zap,
  MonitorSmartphone,
  Clock,
} from "lucide-react"

import {
  formatPreciseTimestamp,
  formatRelativeSeconds,
  formatTimestamp,
  getEventCategoryColor,
  getEventCategoryLabel,
  getSeverityColor,
  getSeverityTone,
  getSourceColor,
  getSourceLabel,
  getStatusTone,
  inferEventCategory,
  inferEventSource,
} from "@/lib/demo-helpers"
import {
  type AdminSnapshot,
  type EventCategory,
  type EventSeverity,
  type EventSource,
  type ExamSession,
} from "@/lib/demo-types"
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

const CATEGORY_ICONS: Record<EventCategory, React.ElementType> = {
  keyboard: Keyboard,
  clipboard: Clipboard,
  focus: Eye,
  fullscreen: Maximize,
  process: Cpu,
  system: Settings,
  network: Globe,
  session: Activity,
}

const SEVERITY_ICONS: Record<EventSeverity, React.ElementType> = {
  critical: AlertTriangle,
  warning: Zap,
  info: Info,
}

export function AdminSessionDetail({
  sessionId,
  initialSession,
}: AdminSessionDetailProps) {
  const [session, setSession] = useState(initialSession)
  const [notFound, setNotFound] = useState(false)
  const [activeFilters, setActiveFilters] = useState<{
    severity: EventSeverity | null
    category: EventCategory | null
    source: EventSource | null
  }>({ severity: null, category: null, source: null })

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

  const filteredEvents = useMemo(() => {
    if (!resolvedSession) return []

    return resolvedSession.events.filter((event) => {
      const category = event.category ?? inferEventCategory(event.type)
      const source = event.source ?? inferEventSource(event.type)

      if (activeFilters.severity && event.severity !== activeFilters.severity) {
        return false
      }
      if (activeFilters.category && category !== activeFilters.category) {
        return false
      }
      if (activeFilters.source && source !== activeFilters.source) {
        return false
      }
      return true
    })
  }, [resolvedSession, activeFilters])

  const eventBreakdown = useMemo(() => {
    if (!resolvedSession) {
      return { byCategory: {} as Record<string, number>, bySeverity: {} as Record<string, number>, bySource: {} as Record<string, number> }
    }

    const byCategory: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    const bySource: Record<string, number> = {}

    for (const event of resolvedSession.events) {
      const category = event.category ?? inferEventCategory(event.type)
      const source = event.source ?? inferEventSource(event.type)

      byCategory[category] = (byCategory[category] ?? 0) + 1
      bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1
      bySource[source] = (bySource[source] ?? 0) + 1
    }

    return { byCategory, bySeverity, bySource }
  }, [resolvedSession])

  function toggleFilter<K extends keyof typeof activeFilters>(
    key: K,
    value: (typeof activeFilters)[K]
  ) {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }))
  }

  function clearFilters() {
    setActiveFilters({ severity: null, category: null, source: null })
  }

  const hasActiveFilters =
    activeFilters.severity !== null ||
    activeFilters.category !== null ||
    activeFilters.source !== null

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
            
            <div className="flex items-center gap-3">
              <Badge variant={getStatusTone(resolvedSession.status)} className="rounded-sm font-medium uppercase tracking-wider text-xs px-4 py-1.5 h-auto">
                {resolvedSession.status.replaceAll("_", " ")}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="size-3.5" />
                <span>{formatRelativeSeconds(resolvedSession.lastHeartbeatAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 sm:px-12 mt-12 space-y-12">
        
        {/* Top row: Session Variables + Event Breakdown */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr]">
          
          <aside className="space-y-6">
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

          {/* Event Breakdown Analytics */}
          <section className="bg-white border border-slate-200">
            <div className="border-b border-slate-200 p-6 bg-slate-50/50">
              <h2 className="text-sm font-medium uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> Event Breakdown
              </h2>
              <p className="text-xs text-slate-500 mt-2 font-light">
                Real-time analytics of intercepted events. Click to filter the event log below.
              </p>
            </div>
            
            <div className="p-6 space-y-8">
              {/* By Severity */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-4">By Severity</h3>
                <div className="flex flex-wrap gap-2">
                  {(["critical", "warning", "info"] as EventSeverity[]).map((severity) => {
                    const count = eventBreakdown.bySeverity[severity] ?? 0
                    const isActive = activeFilters.severity === severity
                    const SeverityIcon = SEVERITY_ICONS[severity]
                    return (
                      <button
                        key={severity}
                        onClick={() => toggleFilter("severity", severity)}
                        className={`
                          flex items-center gap-2 px-3 py-2 border text-xs font-medium uppercase tracking-wider transition-all
                          ${isActive
                            ? getSeverityColor(severity) + " ring-2 ring-offset-1 ring-slate-300"
                            : count > 0
                              ? getSeverityColor(severity) + " opacity-80 hover:opacity-100"
                              : "bg-slate-50 text-slate-400 border-slate-200 cursor-default"
                          }
                        `}
                        disabled={count === 0}
                      >
                        <SeverityIcon className="size-3.5" />
                        <span>{severity}</span>
                        <span className="ml-1 font-mono tabular-nums">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* By Category */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-4">By Category</h3>
                <div className="flex flex-wrap gap-2">
                  {(["keyboard", "clipboard", "focus", "fullscreen", "process", "system", "session"] as EventCategory[]).map((category) => {
                    const count = eventBreakdown.byCategory[category] ?? 0
                    const isActive = activeFilters.category === category
                    const CategoryIcon = CATEGORY_ICONS[category]
                    return (
                      <button
                        key={category}
                        onClick={() => toggleFilter("category", category)}
                        className={`
                          flex items-center gap-2 px-3 py-2 border text-xs font-medium tracking-wider transition-all
                          ${isActive
                            ? getEventCategoryColor(category) + " ring-2 ring-offset-1 ring-slate-300"
                            : count > 0
                              ? getEventCategoryColor(category) + " opacity-80 hover:opacity-100"
                              : "bg-slate-50 text-slate-400 border-slate-200 cursor-default"
                          }
                        `}
                        disabled={count === 0}
                      >
                        <CategoryIcon className="size-3.5" />
                        <span>{getEventCategoryLabel(category)}</span>
                        <span className="ml-1 font-mono tabular-nums">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* By Source */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-4">By Source</h3>
                <div className="flex flex-wrap gap-2">
                  {(["web", "browser", "system"] as EventSource[]).map((source) => {
                    const count = eventBreakdown.bySource[source] ?? 0
                    const isActive = activeFilters.source === source
                    const SourceIcon = source === "browser" ? MonitorSmartphone : source === "web" ? Globe : Settings
                    return (
                      <button
                        key={source}
                        onClick={() => toggleFilter("source", source)}
                        className={`
                          flex items-center gap-2 px-3 py-2 border text-xs font-medium uppercase tracking-wider transition-all
                          ${isActive
                            ? getSourceColor(source) + " ring-2 ring-offset-1 ring-slate-300"
                            : count > 0
                              ? getSourceColor(source) + " opacity-80 hover:opacity-100"
                              : "bg-slate-50 text-slate-400 border-slate-200 cursor-default"
                          }
                        `}
                        disabled={count === 0}
                      >
                        <SourceIcon className="size-3.5" />
                        <span>{getSourceLabel(source)}</span>
                        <span className="ml-1 font-mono tabular-nums">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Event Log */}
        <section className="bg-white border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 p-6 bg-slate-50/50">
             <div>
              <h2 className="text-sm font-medium uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <Terminal className="size-4 text-primary" /> Event Log
              </h2>
              <p className="text-xs text-slate-500 mt-2 font-light">
                Chronological record of all browser interactions, keyboard interceptions, and system anomalies.
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors uppercase tracking-widest font-medium"
                >
                  <Filter className="size-3.5" />
                  Clear Filters
                </button>
              )}
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {filteredEvents.length} / {resolvedSession.events.length} events
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 hover:bg-transparent bg-white">
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs pl-6 w-[140px]">Timestamp</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs w-[80px]">Level</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs w-[100px]">Category</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs w-[80px]">Source</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs">Action</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs pr-6">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length > 0 ? (
                  [...filteredEvents].reverse().map((event) => {
                    const category = event.category ?? inferEventCategory(event.type)
                    const source = event.source ?? inferEventSource(event.type)
                    const CategoryIcon = CATEGORY_ICONS[category]

                    return (
                      <TableRow key={event.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                        <TableCell className="pl-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                          {formatPreciseTimestamp(event.timestamp)}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={getSeverityTone(event.severity)} className="rounded-sm font-medium uppercase tracking-wider text-[10px] px-2 py-0.5">
                            {event.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-medium uppercase tracking-wider ${getEventCategoryColor(category)}`}>
                            <CategoryIcon className="size-3" />
                            {getEventCategoryLabel(category)}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-medium uppercase tracking-wider ${getSourceColor(source)}`}>
                            {getSourceLabel(source)}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-medium text-slate-900">
                          {event.type.replaceAll("_", " ")}
                        </TableCell>
                        <TableCell className="pr-6 py-4">
                          <div className="space-y-1">
                            <p className="text-sm text-slate-600 font-light leading-relaxed">
                              {event.message}
                            </p>
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <div className="hidden group-hover:flex flex-wrap gap-1.5 pt-1">
                                {Object.entries(event.metadata).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px] font-mono border border-slate-200"
                                  >
                                    <span className="text-slate-400">{key}:</span>
                                    <span>{String(value)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-500">
                      {hasActiveFilters
                        ? "No events match the active filters."
                        : "Awaiting telemetry events..."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Violation Timeline Visualization */}
        {resolvedSession.events.length > 0 && (
          <section className="bg-white border border-slate-200">
            <div className="border-b border-slate-200 p-6 bg-slate-50/50">
              <h2 className="text-sm font-medium uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Violation Timeline
              </h2>
              <p className="text-xs text-slate-500 mt-2 font-light">
                Temporal density of security events across the session duration.
              </p>
            </div>
            <div className="p-6">
              <ViolationTimeline events={resolvedSession.events} startedAt={resolvedSession.startedAt} />
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

/**
 * Visual timeline showing when violations occurred during the session.
 */
function ViolationTimeline({
  events,
  startedAt,
}: {
  events: ExamSession["events"]
  startedAt: string
}) {
  const startTime = new Date(startedAt).getTime()
  const now = Date.now()
  const duration = now - startTime

  const violationEvents = events.filter((e) => e.severity !== "info")
  if (violationEvents.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-slate-400">
        No violations detected in this session.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Timeline bar */}
      <div className="relative h-12 bg-slate-100 border border-slate-200 overflow-hidden">
        {violationEvents.map((event) => {
          const eventTime = new Date(event.timestamp).getTime()
          const position = Math.max(0, Math.min(100, ((eventTime - startTime) / duration) * 100))
          const color =
            event.severity === "critical"
              ? "bg-red-500"
              : "bg-amber-400"

          return (
            <div
              key={event.id}
              className={`absolute top-0 bottom-0 w-0.5 ${color}`}
              style={{ left: `${position}%` }}
              title={`${event.type.replaceAll("_", " ")} — ${event.message}`}
            >
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full ${color} ring-2 ring-white`}
              />
            </div>
          )
        })}
      </div>

      {/* Time axis labels */}
      <div className="flex justify-between text-[10px] text-slate-400 font-mono uppercase tracking-wider">
        <span>Session Start</span>
        <span>
          {Math.floor(duration / 60000)}m elapsed
        </span>
        <span>Now</span>
      </div>

      {/* Legend */}
      <div className="flex gap-6 pt-2">
        <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
          <div className="size-2 rounded-full bg-red-500" />
          Critical ({violationEvents.filter((e) => e.severity === "critical").length})
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
          <div className="size-2 rounded-full bg-amber-400" />
          Warning ({violationEvents.filter((e) => e.severity === "warning").length})
        </div>
      </div>
    </div>
  )
}
