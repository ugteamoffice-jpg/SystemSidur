// lib/api-tenant-helper.ts
// Helper לשימוש ב-API routes — שולף tenant מ-query/header ומחזיר config + client

import { NextResponse } from "next/server"
import { loadTenantConfigServer, getTenantApiKey } from "@/lib/tenant-config"
import { createTeableClient } from "@/lib/teable-client-tenant"
import { checkRateLimit } from "@/lib/rate-limit"
import type { TenantConfig } from "@/lib/tenant-config"

interface TenantContext {
  tenantId: string
  config: TenantConfig
  client: ReturnType<typeof createTeableClient>
  apiKey: string
}

export async function getTenantFromRequest(
  request: Request
): Promise<TenantContext | NextResponse> {
  const url = new URL(request.url)

  // Rate limiting לפי IP
  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    (request.headers.get("x-real-ip") || "") ||
    "unknown"

  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Remaining": "0",
      },
    })
  }

  // 1. tenant מ-header (מוגדר ע"י middleware)
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

export function isTenantError(
  result: TenantContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
