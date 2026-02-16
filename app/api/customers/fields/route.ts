import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { client, config } = ctx;

    const TABLE_ID = config.tables.CUSTOMERS;
    const res = await client.fetchWithAuth(`/table/${TABLE_ID}/field`)

    if (!res.ok) throw new Error("Failed to fetch fields")
    const fields = await res.json()

    const statusField = fields.find((field: any) => field.name === "סטטוס לקוח")

    return NextResponse.json({
      statusFieldId: statusField?.id || null,
      statusFieldName: statusField?.name || null,
      allFields: fields,
    })
  } catch (error: any) {
    console.error("Error fetching fields:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
