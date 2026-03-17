import { loadTenantConfigServer } from "@/lib/tenant-config"
import { TenantProvider } from "@/lib/tenant-context"
import { notFound } from "next/navigation"
import { auth, clerkClient } from "@clerk/nextjs/server"

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const config = await loadTenantConfigServer(tenant)

  if (!config) {
    notFound()
  }

  // בדיקת גישה לפי Clerk Organization
  if (config.clerkOrgId) {
    const { userId } = await auth()
    if (!userId) {
      notFound()
    }

    try {
      const client = await clerkClient()
      const memberships = await client.users.getOrganizationMembershipList({ userId })
      const hasAccess = memberships.data.some(
        (m: any) => m.organization.id === config.clerkOrgId
      )

      if (!hasAccess) {
        return (
          <div className="flex items-center justify-center h-screen" dir="rtl">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">אין גישה</h1>
              <p className="text-gray-500">אין לך הרשאה לגשת למערכת זו.</p>
              <p className="text-gray-400 text-sm mt-2">פנה למנהל המערכת להוספת הרשאה.</p>
            </div>
          </div>
        )
      }
    } catch (error) {
      console.error("Failed to check org membership:", error)
      // אם הבדיקה נכשלת, ממשיכים (כדי לא לחסום)
    }
  }

  return (
    <TenantProvider tenantId={tenant} initialConfig={config}>
      {children}
    </TenantProvider>
  )
}
