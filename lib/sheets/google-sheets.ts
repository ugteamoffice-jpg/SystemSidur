// lib/sheets/google-sheets.ts
// גישה ל-Google Sheets API: אימות service account + throttler 50 בקשות/דקה (חלון הזזה)
//
// אימות — אחד משניים:
//   GOOGLE_SA_KEY      = תוכן ה-JSON המלא של המפתח (ל-Railway env var)
//   GOOGLE_SA_KEY_FILE = נתיב לקובץ המפתח (לפיתוח מקומי)

import { JWT } from "google-auth-library"
import { readFileSync } from "node:fs"

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets"

/* ---------- Throttler: חלון הזזה, מקס' 50 בקשות ב-60 שניות, FIFO ---------- */

class SlidingWindowThrottler {
  private timestamps: number[] = []
  private chain: Promise<void> = Promise.resolve()
  constructor(private limit = 50, private windowMs = 60_000) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    // שרשור מבטיח FIFO — כל בקשה ממתינה לקודמות
    const run = this.chain.then(async () => {
      await this.waitForSlot()
      this.timestamps.push(Date.now())
    })
    this.chain = run.catch(() => {})
    return run.then(fn)
  }

  private async waitForSlot() {
    for (;;) {
      const cutoff = Date.now() - this.windowMs
      this.timestamps = this.timestamps.filter((t) => t > cutoff)
      if (this.timestamps.length < this.limit) return
      const waitMs = this.timestamps[0] + this.windowMs - Date.now() + 50
      await new Promise((r) => setTimeout(r, Math.max(waitMs, 50)))
    }
  }
}

/* ---------- Singleton (שורד hot-reload של Next.js) ---------- */

type G = typeof globalThis & { __luzSheetsApi?: SheetsApi }

export class SheetsApi {
  private jwt: JWT
  private throttler = new SlidingWindowThrottler(50, 60_000)

  constructor() {
    const raw =
      process.env.GOOGLE_SA_KEY ||
      (process.env.GOOGLE_SA_KEY_FILE
        ? readFileSync(process.env.GOOGLE_SA_KEY_FILE, "utf8")
        : null)
    if (!raw) throw new Error("Missing GOOGLE_SA_KEY / GOOGLE_SA_KEY_FILE env var")
    const key = JSON.parse(raw)
    this.jwt = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
  }

  private async request<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
    return this.throttler.schedule(async () => {
      let lastErr: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await this.jwt.request<T>({
            url,
            method: (init?.method || "GET") as "GET" | "POST" | "PUT",
            data: init?.body,
          })
          return res.data
        } catch (e: unknown) {
          const status = (e as { response?: { status?: number } })?.response?.status
          lastErr = e
          if (status === 429 || (status && status >= 500)) {
            // גיבוי: המתנה וניסיון חוזר (הפעולה לא הולכת לאיבוד)
            await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)))
            continue
          }
          throw e
        }
      }
      throw lastErr
    })
  }

  /** קריאת טווח ערכים */
  async getValues(spreadsheetId: string, range: string): Promise<unknown[][]> {
    const data = await this.request<{ values?: unknown[][] }>(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`
    )
    return data.values || []
  }

  /** מטא-דאטה של הקובץ: גיליונות ומידות הגריד (לניטור קיבולת מול מגבלת 10M תאים) */
  async getSpreadsheetMeta(spreadsheetId: string): Promise<{
    sheets?: Array<{ properties?: { title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }>
  }> {
    return this.request(
      `${SHEETS_BASE}/${spreadsheetId}?fields=${encodeURIComponent("sheets(properties(title,gridProperties(rowCount,columnCount)))")}`
    )
  }

  /** כתיבת מספר טווחים בבקשה אחת (RAW) */
  async batchUpdateValues(
    spreadsheetId: string,
    data: Array<{ range: string; values: unknown[][] }>
  ): Promise<void> {
    if (data.length === 0) return
    await this.request(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      body: { valueInputOption: "RAW", data },
    })
  }
}

export function getSheetsApi(): SheetsApi {
  const g = globalThis as G
  if (!g.__luzSheetsApi) g.__luzSheetsApi = new SheetsApi()
  return g.__luzSheetsApi
}
