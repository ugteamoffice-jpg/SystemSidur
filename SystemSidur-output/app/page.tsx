import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { listTenants, loadTenantConfigServer } from "@/lib/tenant-config"
import { SignOutBtn } from "@/components/sign-out-btn"

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  // חיפוש tenant מתאים
  let matchedTenant: string | null = null

  try {
    const client = await clerkClient()
    const memberships = await client.users.getOrganizationMembershipList({ userId })
    
    console.log("=== AUTO REDIRECT DEBUG ===")
    console.log("userId:", userId)
    console.log("raw memberships:", JSON.stringify(memberships))

    const userOrgIds: string[] = []
    if (memberships.data) {
      for (const m of memberships.data as any[]) {
        const orgId = m.organization?.id || m.publicOrganizationData?.id
        if (orgId) userOrgIds.push(orgId)
      }
    }
    console.log("userOrgIds:", userOrgIds)

    const tenants = await listTenants()
    console.log("available tenants:", tenants)

    for (const tenantId of tenants) {
      const config = await loadTenantConfigServer(tenantId)
      console.log(`tenant ${tenantId}: clerkOrgId=${config?.clerkOrgId}`)
      if (config?.clerkOrgId && userOrgIds.includes(config.clerkOrgId)) {
        matchedTenant = tenantId
        break
      }
    }
  } catch (error) {
    console.error("Auto-redirect error:", error)
  }

  // redirect מחוץ ל-try/catch כי Next.js זורק exception פנימית
  if (matchedTenant) {
    redirect(`/${matchedTenant}`)
  }

  return (
    <div className="flex items-center justify-center h-screen" dir="rtl">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">לא נמצאה מערכת</h1>
        <p className="text-gray-500 mb-1">המשתמש שלך לא משויך לאף ארגון.</p>
        <p className="text-gray-400 text-sm mb-6">פנה למנהל המערכת לשיוך לארגון.</p>
        <SignOutBtn />
      </div>
    </div>
  )
}
