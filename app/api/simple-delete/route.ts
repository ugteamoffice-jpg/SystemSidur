// app/api/simple-delete/route.ts — היברידי (ניקוי שדה "קובץ הזמנה")
import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { createSheetsClient, tenantUsesSheets } from "@/lib/sheets-client-tenant"

const ATTACHMENT_FIELD = "קובץ הזמנה"

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { recordId } = await request.json()
    if (!recordId) return NextResponse.json({ error: "Missing recordId" }, { status: 400 })

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      await sheets.updateRecord(ctx.config.tables.WORK_SCHEDULE, recordId, { [ATTACHMENT_FIELD]: null })
      return NextResponse.json({ success: true })
    }

    // --- Teable (מקורי) ---
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE_VIEW
    const FIELD_ID = config.fields.workSchedule.ORDER_FORM_ATTACHMENT
    const response = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record?fieldKeyType=name`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ id: recordId, fields: { [FIELD_ID]: null } }] }),
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
