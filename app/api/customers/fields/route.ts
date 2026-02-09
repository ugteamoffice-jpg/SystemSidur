import { NextResponse } from "next/server"

const TEABLE_API_URL = process.env.TEABLE_API_URL
const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN
const TABLE_ID = "tbl4dSxUqAf6vsuGCsM"

export async function GET() {
  try {
    const response = await fetch(`${TEABLE_API_URL}/api/table/${TABLE_ID}/field`, {
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch fields")
    }

    const fields = await response.json()

    // מצא את השדה "סטטוס לקוח"
    const statusField = fields.find((field: any) => field.name === "סטטוס לקוח")

    return NextResponse.json({
      statusFieldId: statusField?.id || null,
      statusFieldName: statusField?.name || null,
      allFields: fields,
    })
  } catch (error: any) {
    console.error("Error fetching fields:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
