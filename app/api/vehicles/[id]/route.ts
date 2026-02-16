import { NextResponse } from "next/server"
import { teableClient } from "@/lib/teable-client"

const TABLE_ID = "tblbRTqAuL4OMkNnUu7" // אותו ID

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const data = await teableClient.updateRecord(TABLE_ID, params.id, body.fields)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        await teableClient.deleteRecord(TABLE_ID, params.id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
