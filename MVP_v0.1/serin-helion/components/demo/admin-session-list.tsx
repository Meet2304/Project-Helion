"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Lock,
  Search,
  Unlock,
  Activity,
  ShieldAlert,
  MonitorSmartphone,
  Globe,
  AlertTriangle,
} from "lucide-react"

import { DEMO_ADMIN_PASSCODE } from "@/lib/demo-config"
import {
  formatRelativeSeconds,
  formatTimestamp,
  getStatusTone,
  inferEventSource,
} from "@/lib/demo-helpers"
import { type AdminSnapshot } from "@/lib/demo-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AdminSessionListProps = {
  initialSnapshot: AdminSnapshot
}

export function AdminSessionList({ initialSnapshot }: AdminSessionListProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [passcode, setPasscode] = useState("")
  const [search, setSearch] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  useEffect(() => {
    if (!isUnlocked) {
      return
    }

    const eventSource = new EventSource("/api/admin/stream")

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data && Array.isArray(data.sessions)) {
          setSnapshot(data as AdminSnapshot)
        }
      } catch {
        // ignore malformed messages
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [isUnlocked])

  const PLACEHOLDER_NAMES = ["seb candidate", "shb candidate", "shb_candidate", "seb_candidate"]

  const visibleSessions = useMemo(() => {
    return snapshot.sessions.filter(
      (session) => !PLACEHOLDER_NAMES.includes(session.candidateName.toLowerCase())
    )
  }, [snapshot.sessions])

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return visibleSessions
    }

    return visibleSessions.filter((session) =>
      [session.candidateName, session.candidateEmailOrId, session.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [search, visibleSessions])

  const metrics = useMemo(() => {
    const browserEvents = visibleSessions.reduce((acc, session) => {
      return acc + session.events.filter((e) => {
        const source = e.source ?? inferEventSource(e.type)
        return source === "browser"
      }).length
    }, 0)

    return {
      total: visibleSessions.length,
      live: visibleSessions.filter((session) =>
        ["active", "warning", "submitted"].includes(session.status)
      ).length,
      flagged: visibleSessions.filter(
        (session) => session.status === "warning" || session.violationCount > 0
      ).length,
      completed: visibleSessions.filter(
        (session) => session.status === "browser_exited"
      ).length,
      browserEvents,
    }
  }, [visibleSessions])

  function handleUnlock() {
    if (passcode !== DEMO_ADMIN_PASSCODE) {
      setAccessError("Admin passcode is incorrect.")
      return
    }

    setIsUnlocked(true)
    setAccessError(null)
  }

  function cacheSessionForDetail(session: AdminSnapshot["sessions"][number]) {
    if (typeof window === "undefined") {
      return
    }

    window.sessionStorage.setItem(
      `serin-admin-session:${session.id}`,
      JSON.stringify(session)
    )
  }

  if (!isUnlocked) {
    return (
      <div className="mx-auto flex min-h-screen w-full items-center justify-center bg-white p-6">
        <div className="w-full max-w-md space-y-12">
          <div className="space-y-4">
            <Lock className="size-6 text-primary" strokeWidth={1.5} />
            <h1 className="text-4xl font-light tracking-tight text-slate-900">
              Admin Gateway
            </h1>
            <p className="text-sm font-light leading-relaxed text-slate-500">
              Restricted access. Please enter your administrative passcode to access live candidate monitoring.
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="admin-passcode" className="uppercase text-xs tracking-wider text-slate-400">Security Passcode</Label>
              <Input
                id="admin-passcode"
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleUnlock()
                }}
                placeholder="Enter passcode"
                className="h-14 rounded-none border-slate-200 border-x-0 border-t-0 border-b-2 bg-transparent px-0 focus-visible:border-primary focus-visible:ring-0 text-lg shadow-none text-slate-900"
              />
            </div>

            {accessError ? (
              <div className="text-sm text-red-600 bg-red-50 p-4 border border-red-100">
                {accessError}
              </div>
            ) : null}

            <Button 
              onClick={handleUnlock} 
              size="lg" 
              className="w-full rounded-none bg-primary hover:bg-primary/90 text-white font-medium uppercase tracking-widest text-xs h-14"
            >
              Authenticate <Unlock className="ml-2 size-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-8 sm:px-12 lg:py-12">
        <div className="mx-auto max-w-7xl flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center text-xs font-medium text-primary uppercase tracking-widest">
              Live Monitor
            </div>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-slate-900">
              Session Overview
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-px bg-slate-200 border border-slate-200">
            <MetricChip label="Live" value={metrics.live} />
            <MetricChip label="Flagged" value={metrics.flagged} highlight={metrics.flagged > 0} />
            <MetricChip label="Completed" value={metrics.completed} />
            <MetricChip label="Browser Events" value={metrics.browserEvents} icon={<MonitorSmartphone className="size-3 text-violet-500" />} />
            <MetricChip label="Total" value={metrics.total} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 sm:px-12 mt-12">
        <div className="bg-white border border-slate-200">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Candidate Records</h2>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
                Sync {formatTimestamp(snapshot.generatedAt)}
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search index..."
                className="h-10 pl-10 rounded-none border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary shadow-none"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 hover:bg-transparent bg-white">
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs pl-6">Candidate</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs">Status</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs">Heartbeat</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs text-center">Violations</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs text-center">Sources</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs">Latest Event</TableHead>
                  <TableHead className="h-14 font-medium text-slate-500 uppercase tracking-wider text-xs pr-6">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.length > 0 ? (
                  filteredSessions.map((session) => {
                    const browserEventCount = session.events.filter(
                      (e) => (e.source ?? inferEventSource(e.type)) === "browser"
                    ).length
                    const webEventCount = session.events.filter(
                      (e) => (e.source ?? inferEventSource(e.type)) === "web"
                    ).length

                    return (
                      <TableRow key={session.id} className="group border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                        <TableCell className="pl-6 py-4">
                          <Link
                            href={`/admin/sessions/${session.id}`}
                            onClick={() => cacheSessionForDetail(session)}
                            className="flex flex-col gap-1"
                          >
                            <span className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                              {session.candidateName}
                            </span>
                            <span className="text-xs text-slate-500">
                              {session.candidateEmailOrId}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge variant={getStatusTone(session.status)} className="rounded-sm font-medium uppercase tracking-wider text-[10px] px-2 py-0.5">
                            {session.status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-sm text-slate-600">
                          {formatRelativeSeconds(session.lastHeartbeatAt)}
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <span className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-medium ${session.violationCount > 0 ? 'bg-red-50 text-red-700' : 'text-slate-400'}`}>
                            {session.violationCount}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {webEventCount > 0 && (
                              <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-1.5 py-0.5 text-[10px] font-medium border border-sky-200">
                                <Globe className="size-2.5" />
                                {webEventCount}
                              </span>
                            )}
                            {browserEventCount > 0 && (
                              <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[10px] font-medium border border-violet-200">
                                <MonitorSmartphone className="size-2.5" />
                                {browserEventCount}
                              </span>
                            )}
                            {webEventCount === 0 && browserEventCount === 0 && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {session.latestEvent ? (
                            <div className="max-w-[200px]">
                              <p className="text-xs text-slate-600 truncate">
                                {session.latestEvent.message}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {session.latestEvent.type.replaceAll("_", " ")}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-sm text-slate-600">
                          {session.browserExitedAt
                            ? "Browser exited"
                            : session.submittedAt
                              ? "Submitted"
                              : "In progress"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-sm text-slate-500">
                      No records match your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  )
}

function MetricChip({
  label,
  value,
  highlight,
  icon,
}: {
  label: string
  value: number
  highlight?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-white px-6 py-4 min-w-[120px]">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</span>
      </div>
      <p className={`text-3xl font-light ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
