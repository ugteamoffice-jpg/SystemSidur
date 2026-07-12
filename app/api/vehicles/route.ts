// app/api/vehicles/route.ts — היברידי (טבלת סוגי רכבים)
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      return NextResponse.json(await sheets.getRecords(ctx.config.tables.VEHICLE_TYPES));
    }
    const { config, apiKey } = ctx;
    const response = await fetch(`${config.apiUrl}/api/table/${config.tables.VEHICLE_TYPES}/record?take=1000&fieldKeyType=name`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }, cache: 'no-store'
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
    const body = await request.json();
    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const record = await sheets.createRecord(ctx.config.tables.VEHICLE_TYPES, body.fields);
      return NextResponse.json({ records: [record] });
    }
    const { config, apiKey } = ctx;
    const response = await fetch(`${config.apiUrl}/api/table/${config.tables.VEHICLE_TYPES}/record`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: body.fields }] })
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
