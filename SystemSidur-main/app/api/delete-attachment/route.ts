import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const { recordId } = await request.json()
    const cleanId = typeof recordId === "string" ? recordId.match(/rec[a-zA-Z0-9]+/)?.[0] : undefined
    if (!cleanId || cleanId.length < 10) {
      return NextResponse.json({ error: "Invalid record ID format" }, { status: 400 })
    }

    const API_URL = config.apiUrl
    const BASE_ID = config.baseId
    const TABLE_ID = config.tables.WORK_SCHEDULE_VIEW
    const FIELD_ID = config.fields.workSchedule.ORDER_FORM_ATTACHMENT

    const url = `${API_URL}/api/base/${BASE_ID}/table/${TABLE_ID}/record/${cleanId}`

    const response = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fieldKeyType: "id", record: { fields: { [FIELD_ID]: null } } }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: "Failed to delete file", details: errorText }, { status: response.status })
    }
    return NextResponse.json({ success: true, data: await response.json() })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
