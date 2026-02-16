import { type NextRequest, NextResponse } from "next/server"
import { teableClient } from "@/lib/teable-client"

const DRIVERS_TABLE_ID = "tbl39DxszH3whkjzovd" // אותו ID

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { fields } = await request.json()
    const data = await teableClient.updateRecord(DRIVERS_TABLE_ID, params.id, fields)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update driver" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await teableClient.deleteRecord(DRIVERS_TABLE_ID, params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete driver" }, { status: 500 })
  }
}
