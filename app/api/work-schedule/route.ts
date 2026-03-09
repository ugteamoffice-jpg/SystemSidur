import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';

export const dynamic = 'force-dynamic';

async function safeJsonParse(response: Response) {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;
    const DATE_FIELD_ID = config.fields.workSchedule.DATE;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const driverIdParam = searchParams.get('driverId');
    const takeRaw = parseInt(searchParams.get('take') || '1000', 10)
    const skipRaw = parseInt(searchParams.get('skip') || '0', 10)
    const take = Math.min(Math.max(isNaN(takeRaw) ? 1000 : takeRaw, 1), 2000)
    const skip = Math.max(isNaN(skipRaw) ? 0 : skipRaw, 0)

    const filterSet: any[] = [];

    if (dateParam) {
      filterSet.push({
        fieldId: DATE_FIELD_ID,
        operator: "is",
        value: { mode: "exactDate", exactDate: `${dateParam}T00:00:00.000Z`, timeZone: "Asia/Jerusalem" }
      });
    }
    if (dateFrom) {
      filterSet.push({
        fieldId: DATE_FIELD_ID,
        operator: "isAfter",
        value: { mode: "exactDate", exactDate: `${dateFrom}T00:00:00.000Z`, timeZone: "Asia/Jerusalem" }
      });
    }
    if (dateTo) {
      filterSet.push({
        fieldId: DATE_FIELD_ID,
        operator: "isBefore",
        value: { mode: "exactDate", exactDate: `${dateTo}T23:59:59.000Z`, timeZone: "Asia/Jerusalem" }
      });
    }
    // Driver filter is handled client-side (link fields don't support contains filter)

    let endpoint = `${API_URL}/api/table/${TABLE_ID}/record?take=${take}&skip=${skip}&fieldKeyType=id`;
    if (filterSet.length > 0) {
      endpoint += `&filter=${encodeURIComponent(JSON.stringify({ conjunction: "and", filterSet }))}`;
    }

    const response = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' });
    if (!response.ok) {
      const errText = await response.text();
      console.error('work-schedule GET failed:', response.status, errText);
      return NextResponse.json({ error: 'Failed' }, { status: response.status });
    }
    const data = await safeJsonParse(response);
    console.log(`[work-schedule GET] tenant=${ctx.tenantId}, records=${data?.records?.length ?? 'N/A'}, date=${dateParam || 'all'}`)
    return NextResponse.json(data || { records: [] }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;

    const body = await request.json();
    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ fields: body.fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const errorData = await safeJsonParse(response);
      console.error(`[work-schedule POST] FAILED tenant=${ctx.tenantId}, status=${response.status}`, errorData);
      return NextResponse.json({ error: "Request failed" }, { status: response.status });
    }
    const postResult = await safeJsonParse(response);
    const newId = postResult?.records?.[0]?.id || postResult?.id || 'unknown'
    console.log(`[work-schedule POST] OK tenant=${ctx.tenantId}, table=${TABLE_ID}, newRecordId=${newId}`)
    return NextResponse.json(postResult || { success: true });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;

    const body = await request.json();
    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`;

    // תמיכה ב-bulk: אם body.records קיים, שולחים כמה records בבת אחת
    const records = body.records
      ? body.records
      : [{ id: body.recordId, fields: body.fields }]

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records }),
      cache: 'no-store'
    });
    if (!response.ok) {
      await safeJsonParse(response);
      return NextResponse.json({ error: "Update failed" }, { status: response.status });
    }
    return NextResponse.json(await safeJsonParse(response) || { success: true });
  } catch (error) {
    console.error('PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;

    const { searchParams } = new URL(request.url);
    const ids = searchParams.getAll('id');
    if (ids.length === 0) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const teableUrl = new URL(`${API_URL}/api/table/${TABLE_ID}/record`);
    ids.forEach(id => teableUrl.searchParams.append('recordIds[]', id));

    const response = await fetch(teableUrl.toString(), {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store'
    });
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "Delete failed" }, { status: response.status });
    }
    return NextResponse.json(await safeJsonParse(response) || { success: true, deletedIds: ids });
  } catch (error) {
    console.error("DELETE Exception:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
