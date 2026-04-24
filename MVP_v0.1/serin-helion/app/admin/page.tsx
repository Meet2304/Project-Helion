import { AdminSessionList } from "@/components/demo/admin-session-list"
import { getSnapshot } from "@/lib/demo-store"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const snapshot = await getSnapshot()

  return <AdminSessionList initialSnapshot={snapshot} />
}
