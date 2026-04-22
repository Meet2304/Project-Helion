import { NextResponse } from "next/server"

import { getSnapshot } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(getSnapshot())
}
