import { NextResponse } from "next/server";
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper";

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
    const { client, config } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;

    const body = await request.json();
    if (!id || id === 'undefined') {
      return NextResponse.json({ error: "Record ID is missing" }, { status: 400 });
    }

    const result = await client.updateRecord(TABLE_ID, id, body.fields);

    let finalResponse = result;
    if (result && result.records && Array.isArray(result.records)) {
      finalResponse = result.records[0];
    } else if (Array.isArray(result)) {
      finalResponse = result[0];
    }

    return NextResponse.json(finalResponse);
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: "Update Failed", details: error.message || "Unknown error" }, { status: 500 });
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
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;

    const res = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?recordIds[]=${id}`, {
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
