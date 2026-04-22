import { AdminDashboard } from "@/components/demo/admin-dashboard"
import { getSnapshot } from "@/lib/demo-store"

export const dynamic = "force-dynamic"

export default function AdminPage() {
  const snapshot = getSnapshot()

  return <AdminDashboard initialSnapshot={snapshot} />
}
