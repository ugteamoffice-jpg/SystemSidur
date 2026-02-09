import { NextResponse } from "next/server"

const TABLE_ID = "tblUgEhLuyCwEK2yWG4"
const FIELD_ID = "fldKkq5oyBm8CwcAIvH" // ID מעודכן לשדה טופס הזמנה

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const recordId = formData.get("recordId") as string

    if (!file || !recordId) {
      return NextResponse.json({ error: "Missing file or recordId" }, { status: 400 })
    }

    const apiUrl = process.env.TEABLE_API_URL
    const token = process.env.TEABLE_APP_TOKEN

    const uploadUrl = `${apiUrl}/api/table/${TABLE_ID}/record/${recordId}/${FIELD_ID}/uploadAttachment`

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
      console.error("[v0] Upload failed:", uploadResponse.status, errorText)
      return NextResponse.json({ error: "Upload failed", details: errorText }, { status: uploadResponse.status })
    }

    const result = await uploadResponse.json()
    console.log("[v0] File uploaded successfully")

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error("[v0] Replace file error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
