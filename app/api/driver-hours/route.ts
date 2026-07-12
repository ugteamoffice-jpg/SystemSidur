// app/api/driver-hours/route.ts — היברידי
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';
type Ctx = Exclude<Awaited<ReturnType<typeof getTenantFromRequest>>, NextResponse>;

const DRIVER_FIELD = 'נהג';

async function safeJsonParse(response: Response) {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const { records: all } = await sheets.getRecords('driver-hours');
      const records = driverId
        ? all.filter((r) => String(r.fields[DRIVER_FIELD] ?? '').trim() === driverId.trim())
        : all;
      console.log('GET driver-hours/sheets count:', records.length, 'driverId:', driverId);
      return NextResponse.json({ records });
    }

    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as Record<string, string>).DRIVER_HOURS;
    const DH = (config.fields as Record<string, Record<string, string>>).driverHours;
    const DH_DRIVER = DH?.DRIVER;
    let endpoint = `${config.apiUrl}/api/table/${TABLE_ID}/record?take=1000&fieldKeyType=name`;
    if (driverId && DH_DRIVER) {
      const filter = JSON.stringify({ conjunction: "and", filterSet: [{ fieldId: DH_DRIVER, operator: "isAnyOf", value: [driverId] }] });
      endpoint += `&filter=${encodeURIComponent(filter)}`;
    }
    const response = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'Failed' }, { status: response.status });
    const data = await safeJsonParse(response);
    return NextResponse.json(data || { records: [] });
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const body = await request.json();
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.createRecord('driver-hours', body.fields);
      return NextResponse.json({ records: [record] });
    }
    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as Record<string, string>).DRIVER_HOURS;
    const response = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record?fieldKeyType=name`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: body.fields }] }), cache: 'no-store'
    });
    const resultText = await response.text()
    if (!response.ok) return NextResponse.json({ error: 'Failed', details: resultText }, { status: response.status });
    try { return NextResponse.json(JSON.parse(resultText) || { success: true }) } catch { return NextResponse.json({ success: true }) }
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await request.json();
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.updateRecord('driver-hours', id, body.fields);
      return NextResponse.json({ records: [record] });
    }
    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as Record<string, string>).DRIVER_HOURS;
    const response = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record?fieldKeyType=name`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ id, fields: body.fields }] }), cache: 'no-store'
    });
    const resultText = await response.text()
    if (!response.ok) return NextResponse.json({ error: 'Failed', details: resultText }, { status: response.status });
    try { return NextResponse.json(JSON.parse(resultText) || { success: true }) } catch { return NextResponse.json({ success: true }) }
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      await sheets.deleteRecord('driver-hours', id);
      return NextResponse.json({ success: true });
    }
    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as Record<string, string>).DRIVER_HOURS;
    const response = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record?recordIds[]=${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed' }, { status: response.status });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}
