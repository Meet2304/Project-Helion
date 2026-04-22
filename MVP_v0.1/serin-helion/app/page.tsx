import Link from "next/link"
import { ArrowRight, ShieldCheck, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DEMO_EXAM_CODE } from "@/lib/demo-config"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <section className="space-y-4 rounded-3xl border bg-card p-8 shadow-sm">
        <Badge variant="outline">Serin-Helion demo</Badge>
        <div className="space-y-3">
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            Safe Exam Browser demo for candidate monitoring
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Minimal demo surface for a proctored exam workflow. The candidate
            flow is intended to run inside Safe Exam Browser, while the admin
            flow shows live session monitoring in a normal browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/exam/${DEMO_EXAM_CODE}`}>
              Open candidate demo
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">Open admin dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Candidate experience
            </CardTitle>
            <CardDescription>
              Start exam, answer the mock questions, trigger a few monitored
              events, submit, then validate the quit password.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use this route in Safe Exam Browser:
            <div className="mt-3 rounded-xl border bg-muted/40 p-3 font-mono text-xs text-foreground">
              /exam/{DEMO_EXAM_CODE}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Admin experience
            </CardTitle>
            <CardDescription>
              Watch live session status, last heartbeat, fullscreen state, and
              browser activity from the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open the admin dashboard in a normal browser tab on a second screen
            during the client demo.
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
