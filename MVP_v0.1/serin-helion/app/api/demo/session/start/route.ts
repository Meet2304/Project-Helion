import { NextResponse } from "next/server"

import { DEMO_EXAM_CODE } from "@/lib/demo-config"
import { createSession } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    candidateName?: string
    candidateEmailOrId?: string
    examCode?: string
  }

  if (
    !body.candidateName?.trim() ||
    !body.candidateEmailOrId?.trim() ||
    !body.examCode?.trim()
  ) {
    return NextResponse.json(
      { error: "Candidate name, email or ID, and exam code are required." },
      { status: 400 }
    )
  }

  if (body.examCode !== DEMO_EXAM_CODE) {
    return NextResponse.json({ error: "Invalid exam code." }, { status: 403 })
  }

  const session = createSession({
    candidateName: body.candidateName.trim(),
    candidateEmailOrId: body.candidateEmailOrId.trim(),
    examCode: body.examCode,
  })

  return NextResponse.json({ session })
}
