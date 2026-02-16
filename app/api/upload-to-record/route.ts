import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

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
