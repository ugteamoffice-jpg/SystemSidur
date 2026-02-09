import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { recordId } = await request.json()

    const cleanId = typeof recordId === "string" ? recordId.match(/rec[a-zA-Z0-9]+/)?.[0] : undefined

    if (!cleanId || cleanId.length < 10) {
      return NextResponse.json({ error: "Invalid record ID format" }, { status: 400 })
    }

    const TEABLE_API_URL = process.env.TEABLE_API_URL
    const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN
    const BASE_ID = "bse1pHIESYWysl2D4VR"
    const TABLE_ID = "tblVAQGlYOLfvCZdqgj"
    const FIELD_ID = "fldf2FIOvHqALxULqrs"

    const baseUrl = TEABLE_API_URL?.replace(/\/$/, "")
    const url = `${baseUrl}/api/base/${BASE_ID}/table/${TABLE_ID}/record/${cleanId}`

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fieldKeyType: "id",
        record: {
          fields: {
            [FIELD_ID]: null,
          },
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: "Failed to delete file", details: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
