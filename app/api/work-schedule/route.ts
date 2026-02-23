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
    const take = searchParams.get('take') || '1000';
    const dateParam = searchParams.get('date');

    let endpoint = `${API_URL}/api/table/${TABLE_ID}/record?take=${take}&fieldKeyType=id`;
    if (dateParam) {
      const filterObj = {
        conjunction: "and",
        filterSet: [
          { fieldId: DATE_FIELD_ID, operator: "isOnOrAfter", value: dateParam },
          { fieldId: DATE_FIELD_ID, operator: "isOnOrBefore", value: dateParam }
        ]
      };
      endpoint += `&filter=${encodeURIComponent(JSON.stringify(filterObj))}`;
    }

    const response = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store' });
    if (!response.ok) {
      const errText = await response.text();
      console.error('work-schedule GET failed:', response.status, errText);
      return NextResponse.json({ error: 'Failed', details: errText }, { status: response.status });
    }
    const data = await safeJsonParse(response);
    const recordCount = data?.records?.length ?? 'N/A'
    console.log(`[work-schedule GET] tenant=${ctx.tenantId}, table=${TABLE_ID}, records=${recordCount}, date=${dateParam || 'all'}`)
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
      return NextResponse.json({ error: "Teable Error", details: errorData }, { status: response.status });
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
    const { recordId, fields } = body;
    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`;
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ id: recordId, fields }] }),
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

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const teableUrl = new URL(`${API_URL}/api/table/${TABLE_ID}/record`);
    teableUrl.searchParams.append('recordIds[]', id);

    const response = await fetch(teableUrl.toString(), {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store'
    });
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "Delete Failed", details: errorText }, { status: response.status });
    }
    return NextResponse.json(await safeJsonParse(response) || { success: true, deletedId: id });
  } catch (error) {
    console.error("DELETE Exception:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
