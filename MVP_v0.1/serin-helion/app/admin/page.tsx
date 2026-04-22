import { AdminSessionList } from "@/components/demo/admin-session-list"
import { getSnapshot } from "@/lib/demo-store"

export const dynamic = "force-dynamic"

export default function AdminPage() {
  const snapshot = getSnapshot()

  return <AdminSessionList initialSnapshot={snapshot} />
}
