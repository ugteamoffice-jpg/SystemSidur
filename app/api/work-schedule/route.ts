// app/api/work-schedule/route.ts — היברידי
// טננט עם sheets בקונפיג -> Google Sheets (cache) ; בלי -> Teable (הקוד המקורי)
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';

type Ctx = Exclude<Awaited<ReturnType<typeof getTenantFromRequest>>, NextResponse>;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};
const DATE_FIELD = 'תאריך';

async function safeJsonParse(response: Response) {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try { return JSON.parse(text); } catch { return null; }
}

/* ============ Google Sheets ============ */

async function sheetsGET(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const takeRaw = parseInt(searchParams.get('take') || '1000', 10);
  const skipRaw = parseInt(searchParams.get('skip') || '0', 10);
  const take = Math.min(Math.max(isNaN(takeRaw) ? 1000 : takeRaw, 1), 2000);
  const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0);

  const { records: all } = await sheets.getRecords(ctx.config.tables.WORK_SCHEDULE);
  const dateOf = (r: { fields: Record<string, unknown> }) => String(r.fields[DATE_FIELD] ?? '').slice(0, 10);

  let filtered = all;
  if (dateParam) filtered = filtered.filter((r) => dateOf(r) === dateParam);
  if (dateFrom) filtered = filtered.filter((r) => dateOf(r) >= dateFrom);
  if (dateTo) filtered = filtered.filter((r) => dateOf(r) <= dateTo);

  const records = filtered.slice(skip, skip + take);
  console.log(`[work-schedule GET/sheets] tenant=${ctx.tenantId}, records=${records.length}, date=${dateParam || 'all'}`);
  return NextResponse.json({ records, total: filtered.length }, { headers: NO_STORE_HEADERS });
}

async function sheetsPOST(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const body = await request.json();
  const record = await sheets.createRecord(ctx.config.tables.WORK_SCHEDULE, body.fields);
  console.log(`[work-schedule POST/sheets] OK tenant=${ctx.tenantId}, newRecordId=${record.id}`);
  return NextResponse.json({ records: [record] });
}

async function sheetsPATCH(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const body = await request.json();
  const records = body.records ? body.records : [{ id: body.recordId, fields: body.fields }];
  const updated = await sheets.updateRecords(ctx.config.tables.WORK_SCHEDULE, records);
  return NextResponse.json({ records: updated });
}

async function sheetsDELETE(ctx: Ctx, request: Request) {
  const sheets = createSheetsClient(ctx.config, ctx.tenantId);
  const { searchParams } = new URL(request.url);
  const ids = searchParams.getAll('id');
  if (ids.length === 0) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  await sheets.deleteRecords(ctx.config.tables.WORK_SCHEDULE, ids);
  return NextResponse.json({ success: true, deletedIds: ids });
}

/* ============ Teable (הקוד המקורי) ============ */

async function teableGET(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const TABLE_ID = config.tables.WORK_SCHEDULE;
  const API_URL = config.apiUrl;
  const DATE_FIELD_ID = config.fields.workSchedule.DATE;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const takeRaw = parseInt(searchParams.get('take') || '1000', 10)
  const skipRaw = parseInt(searchParams.get('skip') || '0', 10)
  const take = Math.min(Math.max(isNaN(takeRaw) ? 1000 : takeRaw, 1), 2000)
  const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

  const filterSet: unknown[] = [];
  if (dateParam) {
    filterSet.push({
      fieldId: DATE_FIELD_ID,
      operator: "is",
      value: { mode: "exactDate", exactDate: `${dateParam}T00:00:00.000Z`, timeZone: "Asia/Jerusalem" }
    });
  }

  let endpoint = `${API_URL}/api/table/${TABLE_ID}/record?take=${take}&skip=${skip}&fieldKeyType=name`;
  if (filterSet.length > 0) {
    endpoint += `&filter=${encodeURIComponent(JSON.stringify({ conjunction: "and", filterSet }))}`;
  }

  const response = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' });
  if (!response.ok) {
    const errText = await response.text();
    console.error('work-schedule GET failed:', response.status, errText, 'endpoint:', endpoint);
    return NextResponse.json({ error: 'Failed', detail: errText, endpoint }, { status: response.status });
  }
  const data = await safeJsonParse(response);
  console.log(`[work-schedule GET/teable] tenant=${ctx.tenantId}, records=${data?.records?.length ?? 'N/A'}, date=${dateParam || 'all'}`)
  return NextResponse.json(data || { records: [] }, { headers: NO_STORE_HEADERS });
}

async function teablePOST(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const body = await request.json();
  const endpoint = `${config.apiUrl}/api/table/${config.tables.WORK_SCHEDULE}/record?fieldKeyType=name`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: body.fields }] }),
    cache: 'no-store'
  });
  if (!response.ok) {
    const errorData = await safeJsonParse(response);
    console.error(`[work-schedule POST/teable] FAILED tenant=${ctx.tenantId}, status=${response.status}`, errorData);
    return NextResponse.json({ error: "Request failed" }, { status: response.status });
  }
  const postResult = await safeJsonParse(response);
  return NextResponse.json(postResult || { success: true });
}

async function teablePATCH(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const body = await request.json();
  const endpoint = `${config.apiUrl}/api/table/${config.tables.WORK_SCHEDULE}/record?fieldKeyType=name`;
  const records = body.records ? body.records : [{ id: body.recordId, fields: body.fields }]
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fieldKeyType: "name", typecast: true, records }),
    cache: 'no-store'
  });
  if (!response.ok) {
    await safeJsonParse(response);
    return NextResponse.json({ error: "Update failed" }, { status: response.status });
  }
  return NextResponse.json(await safeJsonParse(response) || { success: true });
}

async function teableDELETE(ctx: Ctx, request: Request) {
  const { config, apiKey } = ctx;
  const { searchParams } = new URL(request.url);
  const ids = searchParams.getAll('id');
  if (ids.length === 0) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const teableUrl = new URL(`${config.apiUrl}/api/table/${config.tables.WORK_SCHEDULE}/record`);
  ids.forEach(id => teableUrl.searchParams.append('recordIds[]', id));

  const response = await fetch(teableUrl.toString(), {
    method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store'
  });
  if (!response.ok) {
    await response.text();
    return NextResponse.json({ error: "Delete failed" }, { status: response.status });
  }
  return NextResponse.json(await safeJsonParse(response) || { success: true, deletedIds: ids });
}

/* ============ Dispatchers ============ */

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsGET(ctx, request) : teableGET(ctx, request);
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsPOST(ctx, request) : teablePOST(ctx, request);
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsPATCH(ctx, request) : teablePATCH(ctx, request);
  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    return tenantUsesSheets(ctx.config) ? sheetsDELETE(ctx, request) : teableDELETE(ctx, request);
  } catch (error) {
    console.error("DELETE Exception:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
