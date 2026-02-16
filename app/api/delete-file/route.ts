import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const body = await request.json()
    let recordId = body.recordId
    const recordIdRegex = /^rec[a-zA-Z0-9]+$/
    if (!recordIdRegex.test(String(recordId))) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }
    recordId = String(recordId).trim()

    const BASE_ID = config.baseId
    const TABLE_ID = config.tables.WORK_SCHEDULE
    const FIELD_ID = config.fields.workSchedule.ORDER_FORM
    const API_URL = config.apiUrl

    const patchUrl = `${API_URL}/api/base/${BASE_ID}/table/${TABLE_ID}/record/${recordId}`

    const response = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ fields: { [FIELD_ID]: null } }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Failed to delete file: ${errorText}` }, { status: response.status })
    }
    return NextResponse.json({ success: true, data: await response.json() })
  } catch (error) {
    console.error("Delete file error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
