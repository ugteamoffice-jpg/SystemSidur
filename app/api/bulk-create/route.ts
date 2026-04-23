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
    const errors: string[] = [];

    // יצירה סדרתית — נסיעה אחת בכל פעם
    for (let i = 0; i < rides.length; i++) {
      try {
        const res = await fetch(`${API_URL}/api/table/${TABLE_ID}/record?fieldKeyType=name`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fieldKeyType: "name", typecast: true, records: [{ fields: rides[i].fields }] }),
        });

        if (res.ok) {
          created++;
        } else {
          const errText = await res.text().catch(() => '');
          console.error(`bulk-create: ride ${i} failed ${res.status}:`, errText);
          failed++;
          // אם 429 (rate limit) — חכה יותר
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      } catch (err: any) {
        failed++;
        errors.push(err.message);
      }

      // השהיה קצרה בין כל יצירה
      if (i < rides.length - 1) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    return NextResponse.json({ created, failed, total: rides.length });
  } catch (error) {
    console.error('bulk-create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
