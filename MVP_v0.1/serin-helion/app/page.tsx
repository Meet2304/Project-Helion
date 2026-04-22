import Link from "next/link"
import { ArrowRight, ShieldCheck, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DEMO_EXAM_CODE } from "@/lib/demo-config"

export default function Page() {
  return (
    <main className="flex min-h-screen w-full flex-col bg-white text-slate-900">
      <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col justify-center px-6 py-20 lg:px-12">
        <div className="max-w-4xl space-y-12">
          
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-sm border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary uppercase tracking-widest">
              Serin-Helion Demo
            </div>
            <h1 className="text-5xl font-light tracking-tight text-slate-900 sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.1]">
              Live Proctoring <br />
              <span className="text-primary font-medium">Simplified.</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-slate-500 font-light">
              Minimal demo surface for a proctored exam workflow. The candidate flow runs inside Safe Exam Browser, while the admin flow provides live session monitoring with uncompromising clarity.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" className="rounded-none px-8 py-6 text-sm font-medium uppercase tracking-wider bg-primary hover:bg-primary/90 text-white">
              <Link href={`/exam/${DEMO_EXAM_CODE}`}>
                Open Candidate Demo
                <ArrowRight className="ml-3 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-none px-8 py-6 text-sm font-medium uppercase tracking-wider border-slate-200 text-slate-900 hover:bg-slate-50">
              <Link href="/admin">Open Admin Dashboard</Link>
            </Button>
          </div>

        </div>

        <div className="mt-32 grid gap-px bg-slate-200 sm:grid-cols-2 border border-slate-200">
          <div className="bg-white p-10 lg:p-12 space-y-6">
            <ShieldCheck className="size-8 text-primary" strokeWidth={1.5} />
            <div>
              <h2 className="text-xl font-medium text-slate-900 mb-2">Candidate Experience</h2>
              <p className="text-slate-500 font-light leading-relaxed">
                Start the exam, answer mock questions, and trigger monitored events. Built for Safe Exam Browser integration to control exit behavior seamlessly.
              </p>
            </div>
            <div className="pt-4">
              <div className="inline-block bg-slate-50 border border-slate-100 px-4 py-2 font-mono text-sm text-slate-800">
                /exam/{DEMO_EXAM_CODE}
              </div>
            </div>
          </div>

          <div className="bg-white p-10 lg:p-12 space-y-6">
            <Users className="size-8 text-primary" strokeWidth={1.5} />
            <div>
              <h2 className="text-xl font-medium text-slate-900 mb-2">Admin Dashboard</h2>
              <p className="text-slate-500 font-light leading-relaxed">
                Watch live session status, last heartbeat, fullscreen state, and browser activity. Real-time telemetry presented without noise.
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}


