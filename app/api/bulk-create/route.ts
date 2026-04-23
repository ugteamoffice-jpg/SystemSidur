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

    const { rides } = await request.json();
    if (!Array.isArray(rides) || rides.length === 0) {
      return NextResponse.json({ error: 'No rides provided' }, { status: 400 });
    }

    let created = 0;
    let failed = 0;

    // יצירת כל הנסיעות בבקשה אחת
    const records = rides.map((r: any) => ({ fields: r.fields }));
    
    let success = false;
    for (let attempt = 0; attempt < 3 && !success; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=name`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fieldKeyType: "name", typecast: true, records }),
        });

        if (res.ok) {
          created = rides.length;
          success = true;
        } else {
          const errText = await res.text().catch(() => '');
          console.error(`bulk-create: attempt ${attempt + 1} failed ${res.status}:`, errText);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      } catch (err: any) {
        console.error(`bulk-create: attempt ${attempt + 1} error:`, err.message);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (!success) failed = rides.length;

    return NextResponse.json({ created, failed, total: rides.length });
  } catch (error) {
    console.error('bulk-create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
