import { NextResponse } from "next/server"
import { teableClient } from "@/lib/teable-client"

const VEHICLE_TYPES_TABLE_ID = "tblRSYoKFHCaDyivO9k"

export async function GET() {
  try {
    const data = await teableClient.getRecords(VEHICLE_TYPES_TABLE_ID, {
      fieldKeyType: "id",
      take: 1000,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error fetching vehicle types:", error)
    return NextResponse.json({ error: "Failed to fetch vehicle types" }, { status: 500 })
  }
}
