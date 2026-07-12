// app/api/drivers/[id]/route.ts — היברידי
import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { createSheetsClient, tenantUsesSheets } from "@/lib/sheets-client-tenant"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { fields } = await request.json()

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.updateRecord(ctx.config.tables.DRIVERS, id, fields);
      return NextResponse.json(record);
    }

    const data = await ctx.client.updateRecord(ctx.config.tables.DRIVERS, id, fields)
    return NextResponse.json(data)
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed to update driver" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      await sheets.deleteRecord(ctx.config.tables.DRIVERS, id);
      return NextResponse.json({ success: true });
    }

    await ctx.client.deleteRecord(ctx.config.tables.DRIVERS, id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: "Failed to delete driver" }, { status: 500 })
  }
}
