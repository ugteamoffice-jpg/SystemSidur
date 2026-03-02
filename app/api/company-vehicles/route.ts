import { NextResponse } from 'next/server'
import { getTenantFromRequest, isTenantError } from '@/lib/api-tenant-helper'

async function safeJson(r: Response) {
  const t = await r.text()
  if (!t.trim()) return null
  try { return JSON.parse(t) } catch { return null }
}

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config, apiKey } = ctx

    const TABLE_ID = config.tables.COMPANY_VEHICLES
    if (!TABLE_ID) return NextResponse.json({ records: [], notConfigured: true })

    const res = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record?take=1000&fieldKeyType=id`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store'
    })
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status })
    return NextResponse.json(await safeJson(res) || { records: [] })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const { config, apiKey } = ctx

    const TABLE_ID = config.tables.COMPANY_VEHICLES
    if (!TABLE_ID) return NextResponse.json({ error: 'לא הוגדרה טבלת רכבי חברה' }, { status: 400 })

    const body = await request.json()
    const res = await fetch(`${config.apiUrl}/api/table/${TABLE_ID}/record`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldKeyType: 'id', typecast: true, records: [{ fields: body.fields }] })
    })
    if (!res.ok) return NextResponse.json({ error: 'Failed' }, { status: res.status })
    return NextResponse.json(await safeJson(res) || { success: true })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
