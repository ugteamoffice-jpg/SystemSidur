// app/api/drivers/route.ts — היברידי: Sheets אם מוגדר, אחרת Teable (הקוד המקורי)
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';
type Ctx = Exclude<Awaited<ReturnType<typeof getTenantFromRequest>>, NextResponse>;

/* ==== Sheets ==== */
async function sheetsGET(ctx: Ctx) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const { records } = await sheets.getRecords(ctx.config.tables.DRIVERS);
  return NextResponse.json({ records, nextCursor: null });
}
async function sheetsPOST(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const body = await request.json();
  const record = await sheets.createRecord(ctx.config.tables.DRIVERS, body.fields);
  return NextResponse.json({ records: [record] });
}
async function sheetsDELETE(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  if (!recordId) return NextResponse.json({ error: 'Missing recordId' }, { status: 400 });
  await sheets.deleteRecord(ctx.config.tables.DRIVERS, recordId);
  return NextResponse.json({ success: true });
}
async function sheetsPATCH(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const body = await request.json();
  const { recordId, fields } = body;
  if (!recordId) return NextResponse.json({ error: 'Missing recordId' }, { status: 400 });
  const record = await sheets.updateRecord(ctx.config.tables.DRIVERS, recordId, fields);
  return NextResponse.json({ records: [record] });
}

/* ==== Teable (מקורי) ==== */
async function teableGET(ctx: Ctx) {
  const { config, apiKey } = ctx;
  const TABLE_ID = config.tables.DRIVERS;
  const API_URL = config.apiUrl;
  let allRecords: unknown[] = [];
  let skip = 0;
  const take = 1000;
  let hasMore = true;
  while (hasMore) {
    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?take=${take}&skip=${skip}&fieldKeyType=name`;
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
  return NextResponse.json({ records: allRecords, nextCursor: null });
}
async function teablePOST(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const body = await request.json();
  const endpoint = `${config.apiUrl}/api/table/${config.tables.DRIVERS}/record?fieldKeyType=name`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: body.fields }] }),
    cache: 'no-store'
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error('POST drivers error:', response.status, errText);
    return NextResponse.json({ error: "Create failed", detail: errText }, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
async function teableDELETE(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  if (!recordId) return NextResponse.json({ error: 'Missing recordId' }, { status: 400 });
  const endpoint = `${config.apiUrl}/api/table/${config.tables.DRIVERS}/record?recordIds[]=${recordId}`;
  const response = await fetch(endpoint, { method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' });
  if (!response.ok) {
    const errText = await response.text();
    console.error('DELETE drivers error:', response.status, errText);
    return NextResponse.json({ error: "Delete failed", detail: errText }, { status: response.status });
  }
  return NextResponse.json({ success: true });
}
async function teablePATCH(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const body = await request.json();
  const { recordId, fields } = body;
  if (!recordId) return NextResponse.json({ error: 'Missing recordId' }, { status: 400 });
  const endpoint = `${config.apiUrl}/api/table/${config.tables.DRIVERS}/record?fieldKeyType=name`;
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ id: recordId, fields }] }),
    cache: 'no-store'
  });
  if (!response.ok) {
    const errText = await response.text();
    console.error('PATCH drivers error:', response.status, errText);
    return NextResponse.json({ error: "Update failed", detail: errText }, { status: response.status });
  }
  return NextResponse.json(await response.json());
}

/* ==== Dispatchers ==== */
export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsGET(ctx) : teableGET(ctx);
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsPOST(ctx, request) : teablePOST(ctx, request);
  } catch (error: unknown) {
    console.error('POST drivers exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsDELETE(ctx, request) : teableDELETE(ctx, request);
  } catch (error: unknown) {
    console.error('DELETE drivers exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsPATCH(ctx, request) : teablePATCH(ctx, request);
  } catch (error: unknown) {
    console.error('PATCH drivers exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
