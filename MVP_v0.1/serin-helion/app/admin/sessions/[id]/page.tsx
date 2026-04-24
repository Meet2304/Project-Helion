import { AdminSessionDetail } from "@/components/demo/admin-session-detail"
import { getSession } from "@/lib/demo-store"

export const dynamic = "force-dynamic"

export default async function AdminSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession(id)

  return <AdminSessionDetail sessionId={id} initialSession={session} />
}
