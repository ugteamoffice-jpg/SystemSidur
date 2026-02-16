import { NextResponse } from "next/server"
import { teableClient } from "@/lib/teable-client"

const DRIVERS_TABLE_ID = "tblsMGUyHILuKGGASix"

export async function GET() {
  try {
    const data = await teableClient.getRecords(DRIVERS_TABLE_ID, {
      take: 1,
    })

    return NextResponse.json({ total: data.total || 0 })
  } catch (error) {
    console.error("Failed to get drivers count:", error)
    return NextResponse.json({ total: 0 }, { status: 500 })
  }
}
