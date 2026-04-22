"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  MonitorSmartphone,
  ShieldAlert,
} from "lucide-react"

import { DEMO_ADMIN_PASSCODE } from "@/lib/demo-config"
import {
  formatRelativeSeconds,
  formatTimestamp,
  getSeverityTone,
  getStatusTone,
} from "@/lib/demo-helpers"
import { type AdminSnapshot, type ExamSession } from "@/lib/demo-types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AdminDashboardProps = {
  initialSnapshot: AdminSnapshot
}

function getMetrics(sessions: ExamSession[]) {
  return {
    active: sessions.filter((session) => session.status === "active").length,
    warning: sessions.filter((session) => session.status === "warning").length,
    submitted: sessions.filter(
      (session) =>
        session.status === "submitted" || session.status === "ready_to_quit"
    ).length,
    disconnected: sessions.filter((session) => session.status === "disconnected")
      .length,
  }
}

export function AdminDashboard({ initialSnapshot }: AdminDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSnapshot.sessions[0]?.id ?? null
  )
  const [passcode, setPasscode] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  useEffect(() => {
    const eventSource = new EventSource("/api/admin/stream")

    eventSource.onmessage = (event) => {
      const nextSnapshot = JSON.parse(event.data) as AdminSnapshot
      setSnapshot(nextSnapshot)
      setSelectedSessionId((current) => current ?? nextSnapshot.sessions[0]?.id ?? null)
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const filteredGroups = useMemo(() => {
    return {
      live: snapshot.sessions.filter((session) =>
        ["active", "warning"].includes(session.status)
      ),
      submitted: snapshot.sessions.filter((session) =>
        ["submitted", "ready_to_quit"].includes(session.status)
      ),
      disconnected: snapshot.sessions.filter(
        (session) => session.status === "disconnected"
      ),
    }
  }, [snapshot.sessions])

  const selectedSession =
    snapshot.sessions.find((session) => session.id === selectedSessionId) ?? null

  const metrics = useMemo(() => getMetrics(snapshot.sessions), [snapshot.sessions])

  function handleUnlock() {
    if (passcode !== DEMO_ADMIN_PASSCODE) {
      setAccessError("Admin passcode is incorrect.")
      return
    }

    setIsUnlocked(true)
    setAccessError(null)
  }

  if (!isUnlocked) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Admin monitor</CardTitle>
            <CardDescription>
              This demo uses a simple hardcoded passcode instead of authentication.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-passcode">Admin passcode</Label>
              <Input
                id="admin-passcode"
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="Enter the demo admin passcode"
              />
            </div>
            {accessError ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Access denied</AlertTitle>
                <AlertDescription>{accessError}</AlertDescription>
              </Alert>
            ) : null}
            <Button onClick={handleUnlock}>Open admin dashboard</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Badge variant="outline">Serin-Helion admin monitor</Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Live exam session overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time view of candidate session status, browser activity, and
          submission progress for the SEB demo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active sessions</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Activity className="size-5" />
              {metrics.active}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Warning sessions</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldAlert className="size-5" />
              {metrics.warning}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Submitted</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="size-5" />
              {metrics.submitted}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Disconnected</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MonitorSmartphone className="size-5" />
              {metrics.disconnected}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Session list</CardTitle>
            <CardDescription>
              Last refresh: {formatTimestamp(snapshot.generatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="live">
              <TabsList>
                <TabsTrigger value="live">Live</TabsTrigger>
                <TabsTrigger value="submitted">Submitted</TabsTrigger>
                <TabsTrigger value="disconnected">Disconnected</TabsTrigger>
              </TabsList>
              <TabsContent value="live">
                <SessionTable
                  sessions={filteredGroups.live}
                  selectedSessionId={selectedSessionId}
                  onSelect={setSelectedSessionId}
                />
              </TabsContent>
              <TabsContent value="submitted">
                <SessionTable
                  sessions={filteredGroups.submitted}
                  selectedSessionId={selectedSessionId}
                  onSelect={setSelectedSessionId}
                />
              </TabsContent>
              <TabsContent value="disconnected">
                <SessionTable
                  sessions={filteredGroups.disconnected}
                  selectedSessionId={selectedSessionId}
                  onSelect={setSelectedSessionId}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Selected session</CardTitle>
              <CardDescription>
                Detailed candidate state and latest status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {selectedSession ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Candidate</span>
                    <span className="font-medium">{selectedSession.candidateName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Email or ID</span>
                    <span className="font-medium">
                      {selectedSession.candidateEmailOrId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={getStatusTone(selectedSession.status)}>
                      {selectedSession.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Fullscreen</span>
                    <span className="font-medium">
                      {selectedSession.isFullscreen ? "Locked" : "Exited"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Visible</span>
                    <span className="font-medium">
                      {selectedSession.isVisible ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Last heartbeat</span>
                    <span className="font-medium">
                      {formatRelativeSeconds(selectedSession.lastHeartbeatAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Violations</span>
                    <span className="font-medium">
                      {selectedSession.violationCount}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No session selected yet. Start a candidate session to populate
                  the dashboard.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event timeline</CardTitle>
              <CardDescription>
                Most recent browser and exam events for the selected session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedSession ? (
                <ScrollArea className="h-96 rounded-xl border">
                  <div className="space-y-3 p-4">
                    {selectedSession.events.length > 0 ? (
                      selectedSession.events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-xl border p-3 text-sm"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <Badge variant={getSeverityTone(event.severity)}>
                              {event.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          <p className="font-medium">{event.message}</p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {event.type.replaceAll("_", " ")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No session events yet.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a session to view the timeline.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

type SessionTableProps = {
  sessions: ExamSession[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
}

function SessionTable({
  sessions,
  selectedSessionId,
  onSelect,
}: SessionTableProps) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No sessions in this view yet.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Candidate</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last heartbeat</TableHead>
          <TableHead>Violations</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow
            key={session.id}
            className={
              selectedSessionId === session.id ? "bg-muted/60" : undefined
            }
            onClick={() => onSelect(session.id)}
          >
            <TableCell>
              <div className="space-y-1">
                <div className="font-medium">{session.candidateName}</div>
                <div className="text-xs text-muted-foreground">
                  {session.candidateEmailOrId}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusTone(session.status)}>
                {session.status.replaceAll("_", " ")}
              </Badge>
            </TableCell>
            <TableCell>{formatRelativeSeconds(session.lastHeartbeatAt)}</TableCell>
            <TableCell>{session.violationCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
