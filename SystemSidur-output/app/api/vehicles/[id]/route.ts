import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const body = await request.json()
    const response = await fetch(`${config.apiUrl}/api/table/${config.tables.VEHICLES}/record`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fieldKeyType: "id",
        typecast: true,
        records: [{ id, fields: body.fields }]
      })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('PATCH vehicle error:', err);
      return NextResponse.json({ error: err }, { status: response.status });
    }
    return NextResponse.json(await response.json())
  } catch (error: any) {
    console.error('PATCH vehicle exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const response = await fetch(`${config.apiUrl}/api/table/${config.tables.VEHICLES}/record/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed to delete' }, { status: response.status });
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
