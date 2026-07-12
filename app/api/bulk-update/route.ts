// app/api/bulk-update/route.ts — היברידי
import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';

interface Operation {
  type: 'update' | 'delete' | 'create';
  recordId?: string;
  fields?: Record<string, unknown>;
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { operations } = await request.json();
    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json({ error: 'No operations provided' }, { status: 400 });
    }

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId);
      const TABLE = ctx.config.tables.WORK_SCHEDULE;
      let success = 0;
      let failed = 0;
      for (const op of operations as Operation[]) {
        try {
          if (op.type === 'update' && op.recordId) { await sheets.updateRecord(TABLE, op.recordId, op.fields || {}); success++; }
          else if (op.type === 'delete' && op.recordId) { await sheets.deleteRecord(TABLE, op.recordId); success++; }
          else if (op.type === 'create') { await sheets.createRecord(TABLE, op.fields || {}); success++; }
          else failed++;
        } catch (err) {
          console.error(`bulk-update: op (${op.type}) failed:`, err);
          failed++;
        }
      }
      return NextResponse.json({ success, failed, total: operations.length });
    }

    // --- Teable (מקורי) ---
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;
    let success = 0;
    let failed = 0;
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i] as Operation;
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          let res: Response;
          if (op.type === 'update') {
            res = await fetch(`${API_URL}/api/table/${TABLE_ID}/record/${op.recordId}?fieldKeyType=name`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fieldKeyType: "name", typecast: true, record: { fields: op.fields } }),
            });
          } else if (op.type === 'delete') {
            res = await fetch(`${API_URL}/api/table/${TABLE_ID}/record/${op.recordId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${apiKey}` },
            });
          } else if (op.type === 'create') {
            res = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=name`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: op.fields }] }),
            });
          } else { failed++; ok = true; continue; }
          if (res.ok) { success++; ok = true; }
          else {
            const errText = await res.text().catch(() => '');
            console.error(`bulk-update: op ${i} (${op.type}) attempt ${attempt + 1} failed ${res.status}:`, errText);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        } catch (err: unknown) {
          console.error(`bulk-update: op ${i} attempt ${attempt + 1} error:`, err instanceof Error ? err.message : err);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      if (!ok) failed++;
      if (i < operations.length - 1) await new Promise(r => setTimeout(r, 200));
    }
    return NextResponse.json({ success, failed, total: operations.length });
  } catch (error) {
    console.error('bulk-update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
