import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { validateFile } from "@/lib/file-validation"

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

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const validation = validateFile(file)
    if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 })

    const uploadUrl = `${config.apiUrl}/api/table/${tableId}/record/${recordId}/${fieldId}/uploadAttachment`
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
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
