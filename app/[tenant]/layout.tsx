import { loadTenantConfigServer } from "@/lib/tenant-config"
import { TenantProvider } from "@/lib/tenant-context"
import { notFound } from "next/navigation"

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

  return (
    <TenantProvider tenantId={tenant} initialConfig={config}>
      {children}
    </TenantProvider>
  )
}
