import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let recordId = body.recordId

    // Strict regex check
    const recordIdRegex = /^rec[a-zA-Z0-9]+$/
    const recordIdString = typeof recordId === "string" ? recordId : String(recordId)

    if (!recordIdRegex.test(recordIdString)) {
      return new Response(
        JSON.stringify({ error: "Invalid ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    recordId = String(recordId).trim()

    const BASE_ID = "bse1pHIESYWysl2D4VR" // שים לב שזה נשאר כפי שהיה אלא אם השתנה לך גם ה-BASE
    const TABLE_ID = "tblUgEhLuyCwEK2yWG4"
    const FIELD_ID = "fldKkq5oyBm8CwcAIvH"

    const patchUrl = `${process.env.TEABLE_API_URL}/api/base/${BASE_ID}/table/${TABLE_ID}/record/${recordId}`

    const response = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TEABLE_APP_TOKEN}`,
      },
      body: JSON.stringify({
        fields: {
          [FIELD_ID]: null,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Failed to delete file: ${errorText}` }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("[v0] Delete file error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
