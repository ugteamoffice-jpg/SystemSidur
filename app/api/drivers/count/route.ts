import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { client, config } = ctx;

    const data = await client.getRecords(config.tables.DRIVERS, { take: 1 })
    return NextResponse.json({ total: data.total || 0 })
  } catch (error) {
    console.error("Failed to get drivers count:", error)
    return NextResponse.json({ total: 0 }, { status: 500 })
  }
}
