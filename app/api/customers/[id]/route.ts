// app/api/customers/[id]/route.ts — היברידי
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';

async function safeJsonParse(response: Response) {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try { return JSON.parse(text); } catch { return null; }
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

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.updateRecord(ctx.config.tables.CUSTOMERS, id, body.fields);
      return NextResponse.json({ records: [record] });
    }

    const { config, apiKey } = ctx;
    const endpoint = `${config.apiUrl}/api/table/${config.tables.CUSTOMERS}/record?fieldKeyType=name`;
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ id, fields: body.fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const errorData = await safeJsonParse(response);
      return NextResponse.json({ error: "Update Failed", details: errorData }, { status: response.status });
    }
    return NextResponse.json(await safeJsonParse(response) || { success: true });
  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
