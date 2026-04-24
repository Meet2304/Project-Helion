import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/browser/socket-config
 *
 * Compatibility endpoint for native browser clients expecting
 * a real-time transport configuration payload.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  return NextResponse.json({
    ok: true,
    transport: "sse",
    websocket: {
      enabled: false,
      reason:
        "WebSocket transport is disabled for this deployment profile. Use HTTP telemetry ingestion.",
    },
    endpoints: {
      session: `${origin}/api/browser/session`,
      telemetry: `${origin}/api/browser/telemetry`,
      adminStream: `${origin}/api/admin/stream`,
    },
    heartbeatIntervalMs: 5000,
  })
}
