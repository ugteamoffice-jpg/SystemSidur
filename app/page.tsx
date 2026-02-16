import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { listTenants, loadTenantConfigServer } from "@/lib/tenant-config"

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // שליפת כל ה-Organizations של המשתמש מ-Clerk
  try {
    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({ userId })
    const userOrgIds = memberships.data.map((m: any) => m.organization.id)

    // חיפוש tenant שמתאים ל-Organization של המשתמש
    const tenants = await listTenants()

    for (const tenantId of tenants) {
      const config = await loadTenantConfigServer(tenantId)
      if (config?.clerkOrgId && userOrgIds.includes(config.clerkOrgId)) {
        redirect(`/${tenantId}`)
      }
    }
  } catch (error) {
    console.error("Failed to check org memberships:", error)
  }

  // fallback — אם אין org מתאים, הפנה ל-default
  redirect("/default")
}
