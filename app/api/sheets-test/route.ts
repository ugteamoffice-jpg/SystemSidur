// app/api/sheets-test/route.ts
// route בדיקה מקביל — לא נוגע בשום route קיים. Teable ממשיך לשרת את המערכת.
// מאפשר לבדוק את כל שרשרת ה-Sheets (cache -> queue -> throttler -> Google) בפרודקשן בבטחה.
//
// שימוש (מהדפדפן או curl, עם ?tenant=UrbanTours):
//   GET    /api/sheets-test?tenant=UrbanTours                     -> כל הרשומות מסידור עבודה (מה-cache)
//   GET    /api/sheets-test?tenant=UrbanTours&table=drivers       -> טבלה אחרת
//   POST   /api/sheets-test?tenant=UrbanTours   body: {"fields":{"תאריך":"2026-07-15","שם לקוח":"בדיקה"}}
//   PATCH  /api/sheets-test?tenant=UrbanTours   body: {"recordId":"...","fields":{"תיאור":"עודכן"}}
//   DELETE /api/sheets-test?tenant=UrbanTours&id=<recordId>
//
// אחרי שהבדיקות עוברות — מוחקים את הקובץ הזה ומחליפים את ה-routes האמיתיים.

import { NextResponse } from 'next/server';
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper';
import { createSheetsClient } from '@/lib/sheets-client-tenant';

export const dynamic = 'force-dynamic';

const TABLE_PARAM_MAP: Record<string, string> = {
  'work-schedule': 'work-schedule',
  'drivers': 'drivers',
  'customers': 'customers',
  'vehicles': 'vehicles',
  'company-vehicles': 'company-vehicles',
  'driver-hours': 'driver-hours',
  'recurring-rides': 'recurring-rides',
};

function tableKeyFrom(request: Request): string {
  const { searchParams } = new URL(request.url);
  const t = searchParams.get('table') || 'work-schedule';
  return TABLE_PARAM_MAP[t] || 'work-schedule';
}

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const sheets = createSheetsClient(ctx.config, ctx.tenantId);
    const started = Date.now();
    const { records, total } = await sheets.getRecords(tableKeyFrom(request));
    return NextResponse.json({
      ok: true,
      table: tableKeyFrom(request),
      total,
      tookMs: Date.now() - started, // בקריאה ראשונה: טעינת השיטס; אחר כך: ~0
      records,
    });
  } catch (e) {
    console.error('[sheets-test GET]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const sheets = createSheetsClient(ctx.config, ctx.tenantId);
    const body = await request.json();
    const record = await sheets.createRecord(tableKeyFrom(request), body.fields || {});
    return NextResponse.json({ ok: true, record, note: 'נשמר ב-cache מיידית; ייכתב לשיטס תוך ~3 שניות' });
  } catch (e) {
    console.error('[sheets-test POST]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const sheets = createSheetsClient(ctx.config, ctx.tenantId);
    const body = await request.json();
    const record = await sheets.updateRecord(tableKeyFrom(request), body.recordId, body.fields || {});
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    console.error('[sheets-test PATCH]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const sheets = createSheetsClient(ctx.config, ctx.tenantId);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    const deleted = await sheets.deleteRecord(tableKeyFrom(request), id);
    return NextResponse.json({ ok: true, deleted, note: 'soft delete — השורה מסומנת _deleted, לא נמחקת פיזית' });
  } catch (e) {
    console.error('[sheets-test DELETE]', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
