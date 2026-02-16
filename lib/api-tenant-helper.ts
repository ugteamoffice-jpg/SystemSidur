// lib/api-tenant-helper.ts
// Helper לשימוש ב-API routes — שולף tenant מ-query/header ומחזיר config + client

import { NextResponse } from "next/server"
import { loadTenantConfigServer, getTenantApiKey } from "@/lib/tenant-config"
import { createTeableClient } from "@/lib/teable-client-tenant"
import type { TenantConfig } from "@/lib/tenant-config"

interface TenantContext {
  tenantId: string
  config: TenantConfig
  client: ReturnType<typeof createTeableClient>
  apiKey: string
}

/**
 * שולף tenant מהבקשה (header או query param)
 * ה-middleware שם header, אבל גם אפשר לשלוח כ-query param
 */
export async function getTenantFromRequest(
  request: Request
): Promise<TenantContext | NextResponse> {
  const url = new URL(request.url)

  // 1. ננסה מ-header (מוגדר ע"י middleware)
  let tenantId = request.headers.get("x-tenant-id") || ""

  // 2. fallback ל-query param
  if (!tenantId) {
    tenantId = url.searchParams.get("tenant") || ""
  }

  // 3. fallback ל-default
  if (!tenantId) {
    tenantId = "UrbanTours"
  }

  const config = await loadTenantConfigServer(tenantId)
  if (!config) {
    return NextResponse.json(
      { error: `Tenant "${tenantId}" not found` },
      { status: 404 }
    )
  }

  const client = createTeableClient(config, tenantId)
  const apiKey = getTenantApiKey(tenantId)

  return { tenantId, config, client, apiKey }
}

/**
 * בדיקה אם התוצאה היא שגיאה (NextResponse) או context תקין
 */
export function isTenantError(
  result: TenantContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
