import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.DRIVERS;
    const API_URL = config.apiUrl;

    let allRecords: any[] = [];
    let skip = 0;
    const take = 1000;
    let hasMore = true;

    while (hasMore) {
      const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?take=${take}&skip=${skip}&fieldKeyType=id`;
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
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.DRIVERS;
    const API_URL = config.apiUrl;

    const body = await request.json();
    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ fields: body.fields }] }),
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.DRIVERS;
    const API_URL = config.apiUrl;

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    if (!recordId) return NextResponse.json({ error: 'Missing recordId' }, { status: 400 });

    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`;
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [recordId] }),
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.DRIVERS;
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
    if (!response.ok) return NextResponse.json({ error: "Error" }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}
