import { NextResponse } from "next/server"
import { loadTenantConfigServer } from "@/lib/tenant-config"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get("tenant") || "default"

  const config = await loadTenantConfigServer(tenantId)
  if (!config) {
    // generic error — לא לחשוף אם tenant קיים או לא
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // חשוף רק מה שהצד הלקוח באמת צריך — בלי table IDs, field IDs, apiUrl, apiKey
  const safeConfig = {
    id: config.id,
    name: config.name,
  }

  return NextResponse.json(safeConfig)
}
