// app/api/work-schedule/[id]/route.ts — היברידי
import { NextResponse } from "next/server";
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper";
import { createSheetsClient, tenantUsesSheets } from "@/lib/sheets-client-tenant";

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getTenantFromRequest(request);
  if (isTenantError(ctx)) return ctx;
  return NextResponse.json({ message: "Work schedule API is active", recordId: id });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const body = await request.json();
    if (!id || id === 'undefined') {
      return NextResponse.json({ error: "Record ID is missing" }, { status: 400 });
    }

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.updateRecord(ctx.config.tables.WORK_SCHEDULE, id, body.fields);
      return NextResponse.json(record);
    }

    const { client, config } = ctx;
    const result = await client.updateRecord(config.tables.WORK_SCHEDULE, id, body.fields);
    let finalResponse = result;
    if (result && result.records && Array.isArray(result.records)) {
      finalResponse = result.records[0];
    } else if (Array.isArray(result)) {
      finalResponse = result[0];
    }
    return NextResponse.json(finalResponse);
  } catch (error: unknown) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: "Update Failed", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      await sheets.deleteRecord(ctx.config.tables.WORK_SCHEDULE, id);
      return NextResponse.json({ success: true });
    }

    const { config, apiKey } = ctx;
    const res = await fetch(`${config.apiUrl}/api/table/${config.tables.WORK_SCHEDULE}/record?recordIds[]=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store"
    });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete Failed" }, { status: 500 });
  }
}
