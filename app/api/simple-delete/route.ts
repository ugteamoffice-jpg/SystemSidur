import { type NextRequest, NextResponse } from "next/server"
import { teableClient } from "@/lib/teable-client"

const TABLE_ID = "tblVAQgIYOLfvCZdqgj"
const FIELD_ID = "fldf2FIOvHqALxULqrs"

export async function POST(request: NextRequest) {
  try {
    const { recordId } = await request.json()

    if (!recordId) {
      return NextResponse.json({ error: "Missing recordId" }, { status: 400 })
    }

    const cleanRecordId = String(recordId).match(/rec[a-zA-Z0-9]{10,25}/)?.[0]

    if (!cleanRecordId) {
      console.error("[v0] Invalid recordId format:", recordId)
      return NextResponse.json({ error: "Invalid recordId format" }, { status: 400 })
    }

    console.log("[v0] Attempting to delete file for record:", cleanRecordId)

    await teableClient.updateRecord(TABLE_ID, cleanRecordId, {
      [FIELD_ID]: null,
    })

    console.log("[v0] File deleted successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
