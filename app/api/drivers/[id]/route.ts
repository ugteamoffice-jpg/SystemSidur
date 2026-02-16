import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { client, config } = ctx;

    const { fields } = await request.json()
    const data = await client.updateRecord(config.tables.DRIVERS, params.id, fields)
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update driver" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { client, config } = ctx;

    await client.deleteRecord(config.tables.DRIVERS, params.id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete driver" }, { status: 500 })
  }
}
