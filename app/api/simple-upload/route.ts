import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const tableId = formData.get("tableId") as string
    const recordId = formData.get("recordId") as string
    const fieldId = formData.get("fieldId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const apiUrl = process.env.TEABLE_API_URL
    const token = process.env.TEABLE_APP_TOKEN

    const uploadUrl = `${apiUrl}/api/table/${tableId}/record/${recordId}/${fieldId}/uploadAttachment`

    const uploadFormData = new FormData()
    uploadFormData.append("file", file)

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error("Upload failed:", uploadResponse.status, errorText)
      return NextResponse.json({ error: "Upload failed", details: errorText }, { status: uploadResponse.status })
    }

    const result = await uploadResponse.json()

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}
