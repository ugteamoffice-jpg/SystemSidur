import { NextResponse } from "next/server"
import { teableClient } from "@/lib/teable-client"

const CUSTOMERS_TABLE_ID = "tbl4dSxUqAf6vsuGCsM"

export async function GET() {
  try {
    const data = await teableClient.getRecords(CUSTOMERS_TABLE_ID, {
      take: 1,
    })

    return NextResponse.json({ total: data.total || 0 })
  } catch (error) {
    console.error("Failed to get customers count:", error)
    return NextResponse.json({ total: 0 }, { status: 500 })
  }
}
