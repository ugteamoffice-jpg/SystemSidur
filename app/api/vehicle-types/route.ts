// app/api/vehicle-types/route.ts — היברידי
import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { createSheetsClient, tenantUsesSheets } from "@/lib/sheets-client-tenant"

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      return NextResponse.json(await sheets.getRecords(ctx.config.tables.VEHICLE_TYPES, { take: 1000 }))
    }
    const data = await ctx.client.getRecords(ctx.config.tables.VEHICLE_TYPES, {
      fieldKeyType: "name",
      take: 1000,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching vehicle types:", error)
    return NextResponse.json({ error: "Failed to fetch vehicle types" }, { status: 500 })
  }
}
