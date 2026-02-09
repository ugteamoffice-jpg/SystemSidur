import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const tableId = formData.get("tableId") as string
    const recordId = formData.get("recordId") as string
    const fieldId = formData.get("fieldId") as string

    console.log("[v0] Upload to existing record:", {
      fileName: file?.name,
      fileSize: file?.size,
      tableId,
      recordId,
      fieldId,
    })

    if (!file || !tableId || !recordId || !fieldId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const TEABLE_API_URL = process.env.TEABLE_API_URL
    const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN

    const uploadFormData = new FormData()
    uploadFormData.append("file", file)

    const uploadUrl = `${TEABLE_API_URL}/api/table/${tableId}/record/${recordId}/${fieldId}/uploadAttachment`
    console.log("[v0] Uploading to:", uploadUrl)

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
      body: uploadFormData,
    })

    console.log("[v0] Upload response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Upload failed:", errorText)
      return NextResponse.json({ error: `Upload failed: ${errorText}` }, { status: response.status })
    }

    const result = await response.json()
    console.log("[v0] Upload successful:", result)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("[v0] Error uploading to record:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
