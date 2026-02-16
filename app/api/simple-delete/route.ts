import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const { recordId } = await request.json()
    if (!recordId) return NextResponse.json({ error: "Missing recordId" }, { status: 400 })

    const TABLE_ID = config.tables.WORK_SCHEDULE_VIEW
    const FIELD_ID = config.fields.workSchedule.ORDER_FORM_ATTACHMENT
    const API_URL = config.apiUrl

    const response = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ id: recordId, fields: { [FIELD_ID]: null } }] }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: "Failed", details: errorText }, { status: response.status })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Simple delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
