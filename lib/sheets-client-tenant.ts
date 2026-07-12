// lib/sheets-client-tenant.ts
// Drop-in replacement ל-createTeableClient — אותן חתימות בדיוק,
// אבל מאחורי הקלעים: cache בזיכרון + Google Sheets כ-persistence.
//
// ה-routes ממשיכים לקרוא עם tableId של Teable (config.tables.WORK_SCHEDULE וכו')
// והמיפוי ל-sheet נעשה כאן. פורמט התשובות זהה ל-Teable:
//   getRecords -> { records: [{ id, fields }], total }
//   createRecord/updateRecord -> { id, fields }
//   deleteRecord -> true
// שמות השדות ב-fields = עברית, בדיוק כמו fieldKeyType=name.

import type { TenantConfig } from "@/lib/tenant-config"
import { getSheetsStore } from "@/lib/sheets/store"

// מיפוי מפתחות הטבלאות בקונפיג הטננט -> מפתחות הסכמה/טאבים
const TABLE_KEY_MAP: Record<string, string> = {
  WORK_SCHEDULE: "work-schedule",
  WORK_SCHEDULE_VIEW: "work-schedule",
  DRIVERS: "drivers",
  CUSTOMERS: "customers",
  VEHICLES: "vehicles",
  VEHICLE_TYPES: "vehicles",
  COMPANY_VEHICLES: "company-vehicles",
  DRIVER_HOURS: "driver-hours",
  RECURRING_RIDES: "recurring-rides",
}

export interface SheetsTenantConfig extends TenantConfig {
  sheets?: { spreadsheetId: string }
}

/** האם הטננט עבר ל-Google Sheets? (יש spreadsheetId בקונפיג) */
export function tenantUsesSheets(config: { sheets?: { spreadsheetId?: string } }): boolean {
  return !!config?.sheets?.spreadsheetId
}

export function createSheetsClient(config: SheetsTenantConfig, tenantId: string) {
  const spreadsheetId: string = config.sheets?.spreadsheetId ?? ""
  if (!spreadsheetId) {
    throw new Error(`Tenant "${tenantId}" missing sheets.spreadsheetId in config`)
  }

  // reverse map: tblXXX (Teable id) -> tableKey, כדי שה-routes לא ישתנו
  const idToKey = new Map<string, string>()
  for (const [confKey, tblId] of Object.entries(config.tables || {})) {
    const tableKey = TABLE_KEY_MAP[confKey]
    if (tableKey && typeof tblId === "string") idToKey.set(tblId, tableKey)
  }

  const store = getSheetsStore()

  function resolve(tableIdOrKey: string) {
    // מקבל גם tblXXX (תאימות לאחור) וגם 'work-schedule' ישירות
    const tableKey = idToKey.get(tableIdOrKey) || tableIdOrKey
    return store.getTable(tenantId, spreadsheetId, tableKey)
  }

  /* ---------- נרמול שדות מקושרים ----------
   * ה-frontend (שנבנה מול Teable) שולח שדות Link כמערכים של recordIds,
   * למשל: { "שם לקוח": ["f07e15c7-..."] }. Teable תרגם את זה לשם עם typecast.
   * כאן אנחנו עושים את אותו הדבר: מחפשים את ה-id בטבלאות ב-cache
   * ושומרים את שם התצוגה (טקסט), בדיוק כמו בנתונים הקיימים.
   */

  const LINK_LOOKUP_TABLES = ["customers", "drivers", "vehicles", "company-vehicles"] as const

  function displayName(tableKey: string, fields: Record<string, unknown>): string {
    switch (tableKey) {
      case "customers":
        return String(fields["שם לקוח"] ?? "")
      case "drivers": {
        const first = String(fields["שם פרטי"] ?? "").trim()
        const last = String(fields["שם משפחה"] ?? "").trim()
        return [first, last].filter(Boolean).join(" ")
      }
      case "vehicles":
        return String(fields["סוג רכב"] ?? "")
      case "company-vehicles":
        return String(fields["מספר רכב"] ?? fields["Label"] ?? "")
      default:
        return ""
    }
  }

  async function resolveLinkItem(item: unknown): Promise<string> {
    // אובייקט בסגנון Teable: { id, title }
    if (item && typeof item === "object") {
      const obj = item as { title?: unknown; id?: unknown; name?: unknown }
      if (obj.title != null) return String(obj.title)
      if (obj.name != null) return String(obj.name)
      if (obj.id != null) return resolveLinkItem(String(obj.id))
      return ""
    }
    const s = String(item ?? "").trim()
    if (!s) return ""
    // חיפוש ה-id בטבלאות המקושרות (מה-cache — מיידי)
    for (const key of LINK_LOOKUP_TABLES) {
      try {
        const t = store.getTable(tenantId, spreadsheetId, key)
        await t.ensureLoaded()
        const rec = t.get(s)
        if (rec) {
          const name = displayName(key, rec.fields)
          if (name) return name
        }
      } catch { /* טבלה לא זמינה — ממשיכים */ }
    }
    return s // לא id מוכר — כנראה כבר שם/טקסט, משאירים
  }

  async function normalizeFields(fields: Record<string, unknown>): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields || {})) {
      if (Array.isArray(value)) {
        const parts = await Promise.all(value.map(resolveLinkItem))
        out[key] = parts.filter(Boolean).join(", ")
      } else if (value && typeof value === "object" && !(value instanceof Date)) {
        const obj = value as { title?: unknown; id?: unknown }
        if (obj.title != null || obj.id != null) {
          out[key] = await resolveLinkItem(value)
        } else {
          out[key] = value
        }
      } else {
        out[key] = value
      }
    }
    return out
  }

  return {
    async getRecords(tableId: string, query?: Record<string, unknown>) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      let records = table.list().map((r) => ({ id: r.id, fields: r.fields }))

      const skip = Number(query?.skip ?? 0) || 0
      const take = Number(query?.take ?? records.length) || records.length
      const total = records.length
      records = records.slice(skip, skip + take)

      return { records, total }
    },

    async getRecord(tableId: string, recordId: string) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      const rec = table.get(recordId)
      if (!rec) return null
      return { id: rec.id, fields: rec.fields }
    },

    async createRecord(tableId: string, fields: Record<string, unknown>) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      const rec = table.create(await normalizeFields(fields))
      return { id: rec.id, fields: rec.fields }
    },

    async createRecords(tableId: string, recordsFields: Record<string, unknown>[]) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      const normalized = await Promise.all(recordsFields.map((f) => normalizeFields(f)))
      return normalized.map((f) => {
        const rec = table.create(f)
        return { id: rec.id, fields: rec.fields }
      })
    },

    async updateRecord(tableId: string, recordId: string, fields: Record<string, unknown>) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      const rec = table.update(recordId, await normalizeFields(fields))
      if (!rec) throw new Error(`Record ${recordId} not found`)
      return { id: rec.id, fields: rec.fields }
    },

    async updateRecords(
      tableId: string,
      records: Array<{ id: string; fields: Record<string, unknown> }>
    ) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      const out: Array<{ id: string; fields: Record<string, unknown> }> = []
      for (const r of records) {
        const rec = table.update(r.id, await normalizeFields(r.fields))
        if (rec) out.push({ id: rec.id, fields: rec.fields })
      }
      return out
    },

    async deleteRecord(tableId: string, recordId: string) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      return table.softDelete(recordId)
    },

    async deleteRecords(tableId: string, recordIds: string[]) {
      const table = resolve(tableId)
      await table.ensureLoaded()
      return recordIds.map((id) => table.softDelete(id))
    },

    // properties (תאימות למה ש-createTeableClient חושף)
    spreadsheetId,
    baseId: config.baseId,
  }
}

export type SheetsClient = ReturnType<typeof createSheetsClient>
