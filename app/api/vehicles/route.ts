import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.VEHICLES;
    const API_URL = config.apiUrl;

    const response = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?take=1000&fieldKeyType=id`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: response.status });
    const data = await response.json();
    // Debug: log first record fields
    if (data.records && data.records.length > 0) {
      console.log('=== VEHICLES DEBUG ===');
      console.log('Table ID:', TABLE_ID);
      console.log('First record fields:', JSON.stringify(data.records[0].fields));
      console.log('Expected field:', config.fields.vehicles?.VEHICLE_TYPE);
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
