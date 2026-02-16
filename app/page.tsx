import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { listTenants, loadTenantConfigServer } from "@/lib/tenant-config"

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  try {
    const client = await clerkClient()
    
    // שליפת כל ה-Organizations של המשתמש
    const memberships = await client.users.getOrganizationMembershipList({ userId })
    
    console.log("=== AUTO REDIRECT DEBUG ===")
    console.log("userId:", userId)
    console.log("memberships count:", memberships.data?.length || 0)
    console.log("memberships:", JSON.stringify(memberships.data?.map((m: any) => ({
      orgId: m.organization?.id || m.publicOrganizationData?.id,
      orgName: m.organization?.name || m.publicOrganizationData?.name,
    }))))

    // שליפת org IDs — Clerk יכול להחזיר במבנים שונים
    const userOrgIds: string[] = []
    if (memberships.data) {
      for (const m of memberships.data) {
        const orgId = m.organization?.id || (m as any).publicOrganizationData?.id
        if (orgId) userOrgIds.push(orgId)
      }
    }
    console.log("userOrgIds:", userOrgIds)

    // חיפוש tenant מתאים
    const tenants = await listTenants()
    console.log("available tenants:", tenants)

    for (const tenantId of tenants) {
      const config = await loadTenantConfigServer(tenantId)
      console.log(`tenant ${tenantId}: clerkOrgId=${config?.clerkOrgId}`)
      if (config?.clerkOrgId && userOrgIds.includes(config.clerkOrgId)) {
        console.log(`MATCH! Redirecting to /${tenantId}`)
        redirect(`/${tenantId}`)
      }
    }

    console.log("No org match found, showing error page")
  } catch (error) {
    console.error("Auto-redirect error:", error)
  }

  // אם אין התאמה — לא מפנים ל-default, מציגים הודעה
  return (
    <div className="flex items-center justify-center h-screen" dir="rtl">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">לא נמצאה מערכת</h1>
        <p className="text-gray-500">המשתמש שלך לא משויך לאף ארגון.</p>
        <p className="text-gray-400 text-sm mt-2">פנה למנהל המערכת לשיוך לארגון.</p>
      </div>
    </div>
  )
}
