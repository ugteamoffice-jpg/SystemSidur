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
    const TABLE_ID = (config.tables as any).DRIVER_HOURS;
    const API_URL = config.apiUrl;
    const DH = (config.fields as any).driverHours;
    const { searchParams } = new URL(request.url);
    // No server-side filter — link fields don't support "contains" in Teable. Filter client-side.
    let endpoint = `${API_URL}/api/table/${TABLE_ID}/record?take=1000&fieldKeyType=id`;
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
    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as any).DRIVER_HOURS;
    const API_URL = config.apiUrl;
    const body = await request.json();
    const response = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ fields: body.fields }] }), cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed' }, { status: response.status });
    return NextResponse.json(await safeJsonParse(response) || { success: true });
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as any).DRIVER_HOURS;
    const API_URL = config.apiUrl;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const body = await request.json();
    console.log('PATCH driver-hours id:', id, 'fields:', JSON.stringify(body.fields))
    const response = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`, {
      method: 'PATCH', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ id, fields: body.fields }] }), cache: 'no-store'
    });
    const resultText = await response.text()
    console.log('Teable PATCH response:', response.status, resultText)
    if (!response.ok) return NextResponse.json({ error: 'Failed', details: resultText }, { status: response.status });
    try { return NextResponse.json(JSON.parse(resultText) || { success: true }) } catch { return NextResponse.json({ success: true }) }
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = (config.tables as any).DRIVER_HOURS;
    const API_URL = config.apiUrl;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const response = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?recordIds=${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed' }, { status: response.status });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }); }
}
