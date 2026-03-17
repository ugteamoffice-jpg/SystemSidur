import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.VEHICLE_TYPES;

    const response = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record?take=1000&fieldKeyType=name`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      cache: 'no-store'
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('GET vehicles error:', response.status, errText);
      return NextResponse.json({ error: 'Failed to fetch vehicles', status: response.status, detail: errText }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.VEHICLE_TYPES;

    const body = await request.json();
    const response = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fieldKeyType: "name",
        typecast: true,
        records: [{ fields: body.fields }]
      })
    });
    if (!response.ok) {
      const err = await response.text();
      console.error('POST vehicle error:', err);
      return NextResponse.json({ error: err }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
