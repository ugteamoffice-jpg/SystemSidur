// app/api/vehicles/[id]/route.ts — היברידי (סוגי רכבים)
import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { createSheetsClient, tenantUsesSheets } from "@/lib/sheets-client-tenant"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const body = await request.json()

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.updateRecord(ctx.config.tables.VEHICLE_TYPES, id, body.fields);
      return NextResponse.json({ records: [record] });
    }

    const { config, apiKey } = ctx;
    const response = await fetch(`${config.apiUrl}/api/table/${config.tables.VEHICLE_TYPES}/record`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ id, fields: body.fields }] })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('PATCH vehicle error:', err);
      return NextResponse.json({ error: err }, { status: response.status });
    }
    return NextResponse.json(await response.json())
  } catch (error: unknown) {
    console.error('PATCH vehicle exception:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      await sheets.deleteRecord(ctx.config.tables.VEHICLE_TYPES, id);
      return NextResponse.json({ success: true });
    }

    const { config, apiKey } = ctx;
    const response = await fetch(`${config.apiUrl}/api/table/${config.tables.VEHICLE_TYPES}/record/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed to delete' }, { status: response.status });
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
