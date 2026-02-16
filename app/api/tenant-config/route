import { NextResponse } from "next/server"
import { loadTenantConfigServer } from "@/lib/tenant-config"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get("tenant") || "default"

  const config = await loadTenantConfigServer(tenantId)
  if (!config) {
    return NextResponse.json(
      { error: `Tenant "${tenantId}" not found` },
      { status: 404 }
    )
  }

  return NextResponse.json(config)
}
