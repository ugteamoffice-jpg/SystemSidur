// app/api/customers/route.ts — היברידי: Sheets אם מוגדר, אחרת Teable
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';
type Ctx = Exclude<Awaited<ReturnType<typeof getTenantFromRequest>>, NextResponse>;

async function teableAll(ctx: Ctx) {
  const { config, apiKey } = ctx;
  let allRecords: unknown[] = [];
  let skip = 0;
  const take = 1000;
  let hasMore = true;
  while (hasMore) {
    const endpoint = `${config.apiUrl}/api/table/${config.tables.CUSTOMERS}/record?take=${take}&skip=${skip}&fieldKeyType=name`;
    const response = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Teable API error: ${response.status}`);
    const data = await response.json();
    const records = data.records || [];
    if (records.length === 0) { hasMore = false; }
    else {
      allRecords = [...allRecords, ...records];
      skip += records.length;
      if (records.length < take) hasMore = false;
    }
  }
  return allRecords;
}

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const { records } = await sheets.getRecords(ctx.config.tables.CUSTOMERS);
      return NextResponse.json({ records, nextCursor: null });
    }
    const records = await teableAll(ctx);
    return NextResponse.json({ records, nextCursor: null });
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const body = await request.json();
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.createRecord(ctx.config.tables.CUSTOMERS, body.fields);
      return NextResponse.json({ records: [record] });
    }
    const { config, apiKey } = ctx;
    const endpoint = `${config.apiUrl}/api/table/${config.tables.CUSTOMERS}/record?fieldKeyType=name`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: body.fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const body = await request.json();
    const { recordId, fields } = body;
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.updateRecord(ctx.config.tables.CUSTOMERS, recordId, fields);
      return NextResponse.json({ records: [record] });
    }
    const { config, apiKey } = ctx;
    const endpoint = `${config.apiUrl}/api/table/${config.tables.CUSTOMERS}/record?fieldKeyType=name`;
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ id: recordId, fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}
