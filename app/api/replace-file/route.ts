import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { validateFile } from "@/lib/file-validation"

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const formData = await request.formData()
    const file = formData.get("file") as File
    const recordId = formData.get("recordId") as string
    if (!file || !recordId) {
      return NextResponse.json({ error: "Missing file or recordId" }, { status: 400 })
    }

    const validation = validateFile(file)
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 })

    const TABLE_ID = config.tables.WORK_SCHEDULE
    const FIELD_ID = config.fields.workSchedule.ORDER_FORM
    const API_URL = config.apiUrl

    const uploadUrl = `${API_URL}/api/table/${TABLE_ID}/record/${recordId}/${FIELD_ID}/uploadAttachment`
    const uploadFormData = new FormData()
    uploadFormData.append("file", file)

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      return NextResponse.json({ error: "Upload failed" }, { status: uploadResponse.status })
    }
    return NextResponse.json({ success: true, data: await uploadResponse.json() })
  } catch (error: any) {
    console.error("Replace file error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
