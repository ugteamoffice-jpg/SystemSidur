import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const TABLE_ID = config.tables.WORK_SCHEDULE;
    const API_URL = config.apiUrl;

    const { operations } = await request.json();
    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json({ error: 'No operations provided' }, { status: 400 });
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
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
          } else {
            failed++;
            ok = true;
            continue;
          }

          if (res.ok) {
            success++;
            ok = true;
          } else {
            const errText = await res.text().catch(() => '');
            console.error(`bulk-update: op ${i} (${op.type}) attempt ${attempt + 1} failed ${res.status}:`, errText);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          }
        } catch (err: any) {
          console.error(`bulk-update: op ${i} attempt ${attempt + 1} error:`, err.message);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      if (!ok) failed++;

      // השהיה בין פעולות
      if (i < operations.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return NextResponse.json({ success, failed, total: operations.length });
  } catch (error) {
    console.error('bulk-update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
