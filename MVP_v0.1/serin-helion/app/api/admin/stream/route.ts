import { subscribeToSessions, getSnapshot } from "@/lib/demo-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createMessage(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function GET() {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let pingInterval: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(createMessage(getSnapshot())))

      unsubscribe = subscribeToSessions((snapshot) => {
        controller.enqueue(encoder.encode(createMessage(snapshot)))
      })

      pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(createMessage(getSnapshot())))
      }, 5_000)
    },
    cancel() {
      if (pingInterval) {
        clearInterval(pingInterval)
      }

      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
