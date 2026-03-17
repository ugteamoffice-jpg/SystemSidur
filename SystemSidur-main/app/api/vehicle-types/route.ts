import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { client, config } = ctx;

    const data = await client.getRecords(config.tables.VEHICLE_TYPES, {
      fieldKeyType: "id",
      take: 1000,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching vehicle types:", error)
    return NextResponse.json({ error: "Failed to fetch vehicle types" }, { status: 500 })
  }
}
