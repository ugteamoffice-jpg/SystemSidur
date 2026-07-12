// lib/sheets/store.ts
// ה-cache בזיכרון = מקור האמת. כתיבות מתעדכנות מיד ב-cache ונדחפות
// לגוגל שיטס ברקע (write-behind) כל 3 שניות ב-batch אחד.
//
// עקרונות:
//  - השרת הוא הכותב היחיד לשיטס => ה-cache תמיד נכון
//  - soft delete: עמודת _deleted, שורות לא זזות לעולם
//  - כל שינוי = כתיבת השורה המלאה מחדש (אידמפוטנטי ופשוט)

import { getSheetsApi } from "./google-sheets"
import { randomUUID } from "node:crypto"
import schemaJson from "@/config/sheets-schema.json"

type ColumnDef = { key: string; header: string; type: string }
type TableSchema = { sheetName: string; columns: ColumnDef[] }
const SCHEMA = schemaJson as unknown as {
  systemColumns: { key: string; header: string }[]
  tables: Record<string, TableSchema>
}
const SYS = SCHEMA.systemColumns.length // 3: _id, _deleted, _updatedAt

export type RecordFields = Record<string, unknown>
export interface StoredRecord {
  id: string
  fields: RecordFields
  rowIndex: number // שורה פיזית ב-sheet (1-based, כולל כותרת)
  deleted: boolean
  updatedAt: string
}

/* ---------- המרות ערכים ---------- */

function toCell(type: string, v: unknown): unknown {
  if (v === undefined || v === null) return ""
  switch (type) {
    case "boolean":
      return v === true || v === "TRUE" || v === "true" ? "TRUE" : ""
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v))
      return Number.isFinite(n) ? n : String(v)
    }
    default:
      return typeof v === "object" ? JSON.stringify(v) : v
  }
}

function fromCell(type: string, v: unknown): unknown {
  if (v === "" || v === undefined || v === null) return null
  switch (type) {
    case "boolean":
      return v === "TRUE" || v === true || v === "true"
    case "number": {
      const n = typeof v === "number" ? v : Number(String(v))
      return Number.isFinite(n) ? n : v
    }
    default:
      return v
  }
}

function colLetter(idx0: number): string {
  let s = ""
  let n = idx0 + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/* ---------- טבלה אחת בזיכרון ---------- */

class TableStore {
  rows = new Map<string, StoredRecord>()
  private byRow = new Map<number, string>()
  private nextRow = 2 // שורה 1 = כותרות
  private dirty = new Set<string>() // ids שממתינים לכתיבה לשיטס
  private loadPromise: Promise<void> | null = null
  private lastCol: string

  constructor(
    public readonly spreadsheetId: string,
    private schema: TableSchema
  ) {
    this.lastCol = colLetter(SYS + schema.columns.length - 1)
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.load()
    return this.loadPromise
  }

  private async load(): Promise<void> {
    const api = getSheetsApi()
    const values = await api.getValues(
      this.spreadsheetId,
      `'${this.schema.sheetName}'!A2:${this.lastCol}`
    )
    values.forEach((row, i) => {
      const rowIndex = i + 2
      const id = String(row[0] ?? "").trim()
      if (!id) return // שורה ריקה
      const fields: RecordFields = {}
      this.schema.columns.forEach((col, c) => {
        fields[col.header] = fromCell(col.type, row[SYS + c])
      })
      const rec: StoredRecord = {
        id,
        fields,
        rowIndex,
        deleted: row[1] === "TRUE" || row[1] === true,
        updatedAt: String(row[2] ?? ""),
      }
      this.rows.set(id, rec)
      this.byRow.set(rowIndex, id)
    })
    this.nextRow = values.length + 2
    console.log(
      `[sheets-store] loaded "${this.schema.sheetName}": ${this.rows.size} records (next row ${this.nextRow})`
    )
  }

  list(): StoredRecord[] {
    return [...this.rows.values()].filter((r) => !r.deleted)
  }

  get(id: string): StoredRecord | null {
    const r = this.rows.get(id)
    return r && !r.deleted ? r : null
  }

  create(fields: RecordFields, id?: string): StoredRecord {
    const rec: StoredRecord = {
      id: id || randomUUID(),
      fields: { ...fields },
      rowIndex: this.nextRow++,
      deleted: false,
      updatedAt: new Date().toISOString(),
    }
    this.rows.set(rec.id, rec)
    this.byRow.set(rec.rowIndex, rec.id)
    this.dirty.add(rec.id)
    return rec
  }

  update(id: string, fields: RecordFields): StoredRecord | null {
    const rec = this.rows.get(id)
    if (!rec || rec.deleted) return null
    Object.assign(rec.fields, fields)
    rec.updatedAt = new Date().toISOString()
    this.dirty.add(id)
    return rec
  }

  softDelete(id: string): boolean {
    const rec = this.rows.get(id)
    if (!rec || rec.deleted) return false
    rec.deleted = true
    rec.updatedAt = new Date().toISOString()
    this.dirty.add(id)
    return true
  }

  /** אוסף את כל השורות המלוכלכות לכתיבה — כל שורה נכתבת במלואה */
  drainDirty(): Array<{ range: string; values: unknown[][] }> {
    const out: Array<{ range: string; values: unknown[][] }> = []
    for (const id of this.dirty) {
      const rec = this.rows.get(id)
      if (!rec) continue
      const row: unknown[] = [
        rec.id,
        rec.deleted ? "TRUE" : "",
        rec.updatedAt,
        ...this.schema.columns.map((c) => toCell(c.type, rec.fields[c.header])),
      ]
      out.push({
        range: `'${this.schema.sheetName}'!A${rec.rowIndex}:${this.lastCol}${rec.rowIndex}`,
        values: [row],
      })
    }
    this.dirty.clear()
    return out
  }

  markDirty(ids: string[]) {
    ids.forEach((id) => this.dirty.add(id))
  }

  get hasDirty(): boolean {
    return this.dirty.size > 0
  }
}

/* ---------- Store גלובלי לכל הטננטים ---------- */

class SheetsStore {
  private tables = new Map<string, TableStore>() // key: `${tenantId}:${tableKey}`
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private flushing = false

  getTable(tenantId: string, spreadsheetId: string, tableKey: string): TableStore {
    const key = `${tenantId}:${tableKey}`
    let t = this.tables.get(key)
    if (!t) {
      const schema = SCHEMA.tables[tableKey]
      if (!schema) throw new Error(`Unknown table key: ${tableKey}`)
      t = new TableStore(spreadsheetId, schema)
      this.tables.set(key, t)
      this.startFlushLoop()
    }
    return t
  }

  private startFlushLoop() {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => void this.flush(), 3000)
    // ריקון התור לפני כיבוי (Railway redeploy)
    process.once("SIGTERM", () => void this.flush())
    process.once("SIGINT", () => void this.flush())
  }

  /** דוחף את כל השינויים הממתינים — batchUpdate אחד לכל spreadsheet */
  async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    try {
      // קיבוץ לפי spreadsheet
      const bySpreadsheet = new Map<
        string,
        { data: Array<{ range: string; values: unknown[][] }>; tables: TableStore[]; ids: string[][] }
      >()
      for (const t of this.tables.values()) {
        if (!t.hasDirty) continue
        const sid = t.spreadsheetId
        const entry = bySpreadsheet.get(sid) || { data: [], tables: [], ids: [] }
        const drained = t.drainDirty()
        // שומרים אילו ids נוקזו כדי להחזירם ל-dirty אם הכתיבה נכשלת
        entry.data.push(...drained)
        entry.tables.push(t)
        entry.ids.push(drained.map((d) => String(d.values[0][0])))
        bySpreadsheet.set(sid, entry)
      }

      const api = getSheetsApi()
      for (const [sid, entry] of bySpreadsheet) {
        try {
          await api.batchUpdateValues(sid, entry.data)
        } catch (e) {
          console.error(`[sheets-store] flush failed for ${sid}, re-queueing:`, e)
          entry.tables.forEach((t, i) => t.markDirty(entry.ids[i]))
        }
      }
    } finally {
      this.flushing = false
    }
  }
}

type G = typeof globalThis & { __luzSheetsStore?: SheetsStore }
export function getSheetsStore(): SheetsStore {
  const g = globalThis as G
  if (!g.__luzSheetsStore) g.__luzSheetsStore = new SheetsStore()
  return g.__luzSheetsStore
}
