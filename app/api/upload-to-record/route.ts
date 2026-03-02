import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const formData = await request.formData()
    const file = formData.get("file") as File
    const tableId = formData.get("tableId") as string
    const recordId = formData.get("recordId") as string
    const fieldId = formData.get("fieldId") as string

    if (!file || !tableId || !recordId || !fieldId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // ולידציה על סוג קובץ
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "סוג קובץ לא מורשה" }, { status: 400 })
    }

    // ולידציה על גודל קובץ
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 10MB)" }, { status: 400 })
    }

    const uploadFormData = new FormData()
    uploadFormData.append("file", file)

    const uploadUrl = `${config.apiUrl}/api/table/${tableId}/record/${recordId}/${fieldId}/uploadAttachment`
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Upload failed: ${errorText}` }, { status: response.status })
    }
    return NextResponse.json({ success: true, data: await response.json() })
  } catch (error) {
    console.error("Error uploading to record:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
