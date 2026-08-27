// app/api/recurring-rides/route.ts
// נסיעות קבועות (תבניות) — נשמרות בטאב "נסיעות קבועות" בגוגל שיטס (לפי טננט).
// GET    ?tenant=X            -> { rides: RecurringRide[] }
// POST   { ride } | { rides } -> { rides: RecurringRide[] }  (יחיד או bulk — למיגרציה מ-localStorage)
// PATCH  { recordId, updates } -> { ride }
// DELETE ?id=X                -> { success: true }

import { NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"
import { createSheetsClient, tenantUsesSheets, type SheetsTenantConfig } from "@/lib/sheets-client-tenant"
import { getSheetsApi } from "@/lib/sheets/google-sheets"
import type { RecurringRide, DaySettings } from "@/lib/recurring-rides"
import { EMPTY_DAY_SETTINGS } from "@/lib/recurring-rides"
import schemaJson from "@/config/sheets-schema.json"

export const dynamic = "force-dynamic"

const TABLE_KEY = "recurring-rides"
type Ctx = Exclude<Awaited<ReturnType<typeof getTenantFromRequest>>, NextResponse>

/* ---------- וידוא כותרות בטאב (פעם אחת לכל spreadsheet לכל תהליך) ---------- */

const headersEnsured = new Set<string>()

async function ensureHeaders(spreadsheetId: string): Promise<void> {
  if (headersEnsured.has(spreadsheetId)) return
  const schema = (schemaJson as any).tables[TABLE_KEY]
  const sysHeaders = (schemaJson as any).systemColumns.map((c: any) => c.header)
  const expected: string[] = [...sysHeaders, ...schema.columns.map((c: any) => c.header)]
  const api = getSheetsApi()
  const row1 = await api.getValues(spreadsheetId, `'${schema.sheetName}'!A1:A1`)
  const a1 = String(row1?.[0]?.[0] ?? "").trim()
  if (a1 !== "_id") {
    await api.batchUpdateValues(spreadsheetId, [
      { range: `'${schema.sheetName}'!A1`, values: [expected] },
    ])
    console.log(`[recurring-rides] headers written to ${spreadsheetId}`)
  }
  headersEnsured.add(spreadsheetId)
}

/* ---------- מיפוי RecurringRide <-> שדות בשיטס ---------- */

function safeParse<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined || v === "") return fallback
  if (typeof v === "object") return v as T
  try {
    const parsed = JSON.parse(String(v))
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function rideToFields(ride: Partial<RecurringRide>, isUpdate = false): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const set = (header: string, v: unknown) => { out[header] = v }
  if (!isUpdate || ride.customerId !== undefined) set("מזהה לקוח", ride.customerId ?? "")
  if (!isUpdate || ride.customerName !== undefined) set("שם לקוח", ride.customerName ?? "")
  if (!isUpdate || ride.description !== undefined) set("מסלול", ride.description ?? "")
  if (!isUpdate || ride.orderName !== undefined) set("שם מזמין", ride.orderName ?? "")
  if (!isUpdate || ride.mobile !== undefined) set("נייד", ride.mobile ?? "")
  if (!isUpdate || ride.idNum !== undefined) set("ת.ז", ride.idNum ?? "")
  if (!isUpdate || ride.lineStartDate !== undefined) set("תאריך התחלה", ride.lineStartDate ?? "")
  if (!isUpdate || ride.lineEndDate !== undefined) set("תאריך סיום", ride.lineEndDate ?? "")
  if (!isUpdate || ride.activeDays !== undefined) set("ימים פעילים (JSON)", JSON.stringify(ride.activeDays ?? []))
  if (!isUpdate || ride.defaults !== undefined) set("ברירת מחדל (JSON)", JSON.stringify(ride.defaults ?? EMPTY_DAY_SETTINGS))
  if (!isUpdate || ride.dayOverrides !== undefined) set("חריגות לפי יום (JSON)", JSON.stringify(ride.dayOverrides ?? {}))
  if (!isUpdate || ride.active !== undefined) set("פעיל", ride.active ?? true)
  if (!isUpdate) set("נוצר בתאריך", ride.createdAt || new Date().toISOString())
  set("עודכן בתאריך", new Date().toISOString())
  return out
}

function fieldsToRide(id: string, fields: Record<string, unknown>): RecurringRide {
  const str = (h: string) => String(fields[h] ?? "")
  const defaults: DaySettings = { ...EMPTY_DAY_SETTINGS, ...safeParse<Partial<DaySettings>>(fields["ברירת מחדל (JSON)"], {}) }
  return {
    id,
    customerId: str("מזהה לקוח"),
    customerName: str("שם לקוח"),
    description: str("מסלול"),
    orderName: str("שם מזמין"),
    mobile: str("נייד"),
    idNum: str("ת.ז"),
    lineStartDate: str("תאריך התחלה"),
    lineEndDate: str("תאריך סיום"),
    defaults,
    dayOverrides: safeParse<{ [day: number]: Partial<DaySettings> }>(fields["חריגות לפי יום (JSON)"], {}),
    activeDays: safeParse<number[]>(fields["ימים פעילים (JSON)"], []),
    active: fields["פעיל"] === true || fields["פעיל"] === "TRUE",
    createdAt: str("נוצר בתאריך"),
    updatedAt: str("עודכן בתאריך"),
  }
}

async function getClient(ctx: Ctx) {
  const config = ctx.config as SheetsTenantConfig
  if (!tenantUsesSheets(config)) {
    return null
  }
  const sheets = createSheetsClient(config, ctx.tenantId)
  await ensureHeaders(sheets.spreadsheetId)
  return sheets
}

/* ---------- Handlers ---------- */

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const sheets = await getClient(ctx)
    if (!sheets) return NextResponse.json({ error: "Tenant not on Sheets" }, { status: 501 })
    const { records } = await sheets.getRecords(TABLE_KEY)
    const rides = records.map((r: { id: string; fields: Record<string, unknown> }) => fieldsToRide(r.id, r.fields))
    return NextResponse.json({ rides })
  } catch (error) {
    console.error("[recurring-rides] GET error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const sheets = await getClient(ctx)
    if (!sheets) return NextResponse.json({ error: "Tenant not on Sheets" }, { status: 501 })
    const body = await request.json()

    // bulk (מיגרציה מ-localStorage) או יחיד
    const ridesIn: Partial<RecurringRide>[] = Array.isArray(body.rides)
      ? body.rides
      : [body.ride ?? body]

    const created = await sheets.createRecords(TABLE_KEY, ridesIn.map((r) => rideToFields(r)))
    const rides = created.map((r: { id: string; fields: Record<string, unknown> }) => fieldsToRide(r.id, r.fields))
    return NextResponse.json({ rides })
  } catch (error) {
    console.error("[recurring-rides] POST error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const sheets = await getClient(ctx)
    if (!sheets) return NextResponse.json({ error: "Tenant not on Sheets" }, { status: 501 })
    const body = await request.json()
    const { recordId, updates } = body
    if (!recordId) return NextResponse.json({ error: "Missing recordId" }, { status: 400 })
    const record = await sheets.updateRecord(TABLE_KEY, recordId, rideToFields(updates || {}, true))
    return NextResponse.json({ ride: fieldsToRide(record.id, record.fields) })
  } catch (error) {
    console.error("[recurring-rides] PATCH error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getTenantFromRequest(request)
    if (isTenantError(ctx)) return ctx
    const sheets = await getClient(ctx)
    if (!sheets) return NextResponse.json({ error: "Tenant not on Sheets" }, { status: 501 })
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const ok = await sheets.deleteRecord(TABLE_KEY, id)
    if (!ok) return NextResponse.json({ error: "Record not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[recurring-rides] DELETE error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
