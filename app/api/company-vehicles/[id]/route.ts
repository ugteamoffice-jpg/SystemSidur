// app/api/company-vehicles/[id]/route.ts — היברידי
import { NextResponse } from 'next/server'
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper'
import { createSheetsClient, tenantUsesSheets } from '@/lib/sheets-client-tenant'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const TABLE_ID = ctx.config.tables.COMPANY_VEHICLES
    if (!TABLE_ID) return NextResponse.json({ error: 'לא הוגדרה טבלת רכבי חברה' }, { status: 400 })
    const body = await request.json()

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId)
      const record = await sheets.updateRecord(TABLE_ID, id, body.fields)
      return NextResponse.json({ records: [record] })
    }

    const res = await fetch(`${ctx.config.apiUrl}/api/table/${TABLE_ID}/record`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: 'name', typecast: true, records: [{ id, fields: body.fields }] })
    })
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status })
    const text = await res.text()
    return NextResponse.json(text ? JSON.parse(text) : { success: true })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const TABLE_ID = ctx.config.tables.COMPANY_VEHICLES
    if (!TABLE_ID) return NextResponse.json({ error: 'לא הוגדרה טבלת רכבי חברה' }, { status: 400 })

    if (tenantUsesSheets(ctx.config)) {
      const sheets = createSheetsClient(ctx.config, ctx.tenantId)
      await sheets.deleteRecord(TABLE_ID, id)
      return NextResponse.json({ success: true })
    }

    const res = await fetch(`${ctx.config.apiUrl}/api/table/${TABLE_ID}/record/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${ctx.apiKey}` }
    })
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
