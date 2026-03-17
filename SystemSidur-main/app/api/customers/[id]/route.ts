import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';

export const dynamic = 'force-dynamic';

async function safeJsonParse(response: Response) {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.CUSTOMERS;
    const API_URL = config.apiUrl;

    const { id } = params;
    const body = await request.json();
    const endpoint = `${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=id`;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "id", typecast: true, records: [{ id, fields: body.fields }] }),
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
