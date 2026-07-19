// app/api/cron/check-expiry/route.ts — גרסה היברידית
// טננט עם config.sheets -> קורא מ-Google Sheets; טננט בלי -> ממשיך מ-Teable.
// ככה ההתראות של כל הטננטים עובדות גם באמצע המיגרציה.
import { NextResponse } from "next/server"
import { Resend } from "resend"
import fs from "fs"
import path from "path"
import { loadTenantConfigServer, getTenantApiKey } from "@/lib/tenant-config"
import { createTeableClient } from "@/lib/teable-client-tenant"
import { createSheetsClient } from "@/lib/sheets-client-tenant"

const WARN_DAYS = 7

// שמות השדות בעברית (כמו ב-sheets-schema / field-names)
const F = {
  CAR_NUMBER: "מספר רכב",
  INSURANCE_EXPIRY: "תוקף ביטוח",
  OPERATION_PERMIT_EXPIRY: "תוקף היתר הפעלה",
  VEHICLE_LICENSE_EXPIRY: "תוקף רישיון רכב",
}

function getDaysUntilExpiry(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null
  try {
    const d = new Date(String(dateStr))
    if (isNaN(d.getTime())) return null
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } catch { return null }
}

function statusText(days: number | null): string {
  if (days === null) return ""
  if (days < 0) return `⛔ פג תוקף (לפני ${Math.abs(days)} ימים)`
  if (days === 0) return "⚠️ פג היום!"
  if (days <= WARN_DAYS) return `⚠️ עוד ${days} ימים`
  return ""
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(String(dateStr))
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`
  } catch { return "—" }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get("secret")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results: { tenant: string; source?: string; sent: boolean; alerts: number; error?: string }[] = []

  const tenantsDir = path.join(process.cwd(), "config", "tenants")
  const tenantFiles = fs.readdirSync(tenantsDir).filter(f => f.endsWith(".json"))

  for (const file of tenantFiles) {
    const tenantId = file.replace(".json", "")
    try {
      const config = await loadTenantConfigServer(tenantId)
      if (!config || !config.tables.COMPANY_VEHICLES) {
        results.push({ tenant: tenantId, sent: false, alerts: 0, error: "no company vehicles config" })
        continue
      }

      const rawConfig = JSON.parse(fs.readFileSync(path.join(tenantsDir, file), "utf-8"))
      const alertEmail = rawConfig.alertEmail
      if (!alertEmail) {
        results.push({ tenant: tenantId, sent: false, alerts: 0, error: "no alertEmail in config" })
        continue
      }

      // --- שליפת רכבי החברה: Sheets אם מוגדר, אחרת Teable ---
      const usesSheets = !!rawConfig.sheets?.spreadsheetId
      let allRecords: Array<{ fields: Record<string, unknown> }> = []

      if (usesSheets) {
        const sheets = createSheetsClient(config as never, tenantId)
        const data = await sheets.getRecords(config.tables.COMPANY_VEHICLES)
        allRecords = data.records
      } else {
        const apiKey = getTenantApiKey(tenantId)
        if (!apiKey) {
          results.push({ tenant: tenantId, sent: false, alerts: 0, error: "no API key" })
          continue
        }
        const client = createTeableClient(config, tenantId)
        while (true) {
          const res = await client.getRecords(config.tables.COMPANY_VEHICLES, {
            take: 200, skip: allRecords.length, fieldKeyType: "name",
          })
          const batch = res.records || []
          if (batch.length === 0) break
          allRecords.push(...batch)
          if (batch.length < 200) break
        }
      }

      // --- בדיקת תוקפים (שמות שדות בעברית בשני המקורות) ---
      const alerts: {
        carNumber: string
        insuranceDays: number | null; insuranceDate: string
        permitDays: number | null; permitDate: string
        licenseDays: number | null; licenseDate: string
      }[] = []

      for (const rec of allRecords) {
        const f = rec.fields as Record<string, string | undefined>
        const insDays = getDaysUntilExpiry(f[F.INSURANCE_EXPIRY])
        const permDays = getDaysUntilExpiry(f[F.OPERATION_PERMIT_EXPIRY])
        const licDays = getDaysUntilExpiry(f[F.VEHICLE_LICENSE_EXPIRY])

        const hasAlert = (insDays !== null && insDays <= WARN_DAYS) ||
                         (permDays !== null && permDays <= WARN_DAYS) ||
                         (licDays !== null && licDays <= WARN_DAYS)
        if (hasAlert) {
          alerts.push({
            carNumber: String(f[F.CAR_NUMBER] || "—"),
            insuranceDays: insDays, insuranceDate: formatDate(f[F.INSURANCE_EXPIRY]),
            permitDays: permDays, permitDate: formatDate(f[F.OPERATION_PERMIT_EXPIRY]),
            licenseDays: licDays, licenseDate: formatDate(f[F.VEHICLE_LICENSE_EXPIRY]),
          })
        }
      }

      if (alerts.length === 0) {
        results.push({ tenant: tenantId, source: usesSheets ? "sheets" : "teable", sent: false, alerts: 0 })
        continue
      }

      const rows = alerts.map(a => {
        const insStatus = statusText(a.insuranceDays)
        const permStatus = statusText(a.permitDays)
        const licStatus = statusText(a.licenseDays)
        return `<tr>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600">${a.carNumber}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;${insStatus ? 'color:#dc2626' : ''}">${a.insuranceDate}${insStatus ? `<br><small>${insStatus}</small>` : ''}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;${permStatus ? 'color:#dc2626' : ''}">${a.permitDate}${permStatus ? `<br><small>${permStatus}</small>` : ''}</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;${licStatus ? 'color:#dc2626' : ''}">${a.licenseDate}${licStatus ? `<br><small>${licStatus}</small>` : ''}</td>
        </tr>`
      }).join("")

      const html = `
        <div dir="rtl" style="font-family:'Varela Round',Arial,sans-serif;max-width:700px;margin:0 auto">
          <div style="background:#f97316;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0;font-size:20px">🚨 התראת תוקף רכבים — ${config.name}</h2>
          </div>
          <div style="background:#fff;padding:20px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
            <p style="color:#64748b;margin:0 0 16px">נמצאו <strong>${alerts.length}</strong> רכבים עם תוקף שפג או עומד לפוג בשבוע הקרוב:</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">מספר רכב</th>
                  <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">תוקף ביטוח</th>
                  <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">תוקף היתר הפעלה</th>
                  <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">תוקף רישיון רכב</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">הודעה אוטומטית ממערכת לו״ז — סידור עבודה</p>
          </div>
        </div>
      `

      const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@resend.dev"
      await resend.emails.send({
        from: fromEmail,
        to: alertEmail,
        subject: `🚨 התראת תוקף רכבים — ${alerts.length} רכבים — ${config.name}`,
        html,
      })

      results.push({ tenant: tenantId, source: usesSheets ? "sheets" : "teable", sent: true, alerts: alerts.length })
    } catch (err: unknown) {
      results.push({ tenant: tenantId, sent: false, alerts: 0, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ===== ניטור קיבולת Google Sheets (מגבלת 10M תאים לקובץ) =====
  // התראות טכניות למנהל המערכת בלבד — לא ללקוחות הטננטים
  const CELL_LIMIT = 10_000_000
  const WARN_PCT = 0.70   // 🟡 מתקרב למגבלה
  const CRIT_PCT = 0.90   // 🔴 דחוף
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || "Ugteamoffice@gmail.com"
  const capacity: { tenant: string; cells: number; pct: string; level: string; error?: string }[] = []

  try {
    const { getSheetsApi } = await import("@/lib/sheets/google-sheets")
    const api = getSheetsApi()

    for (const file of tenantFiles) {
      const tenantId = file.replace(".json", "")
      try {
        const rawConfig = JSON.parse(fs.readFileSync(path.join(tenantsDir, file), "utf-8"))
        const sid = rawConfig?.sheets?.spreadsheetId
        if (!sid) continue

        const meta = await api.getSpreadsheetMeta(sid)
        const perSheet = (meta.sheets || []).map(s => ({
          title: s.properties?.title || "?",
          rows: s.properties?.gridProperties?.rowCount || 0,
          cells: (s.properties?.gridProperties?.rowCount || 0) * (s.properties?.gridProperties?.columnCount || 0),
        }))
        const cells = perSheet.reduce((sum, s) => sum + s.cells, 0)
        const pct = cells / CELL_LIMIT
        const level = pct >= CRIT_PCT ? "critical" : pct >= WARN_PCT ? "warning" : "ok"
        capacity.push({ tenant: tenantId, cells, pct: `${(pct * 100).toFixed(1)}%`, level })

        if (level !== "ok") {
          const isCrit = level === "critical"
          const color = isCrit ? "#dc2626" : "#d97706"
          const topSheets = [...perSheet].sort((a, b) => b.cells - a.cells).slice(0, 6)
          const rows = topSheets.map(s => `
            <tr>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">${s.title}</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">${s.rows.toLocaleString()}</td>
              <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${s.cells.toLocaleString()}</td>
            </tr>`).join("")

          const html = `
            <div dir="rtl" style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto">
              <div style="background:${color};color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
                <h2 style="margin:0">${isCrit ? "🔴 דחוף — קיבולת Google Sheets" : "🟡 התראת קיבולת Google Sheets"}</h2>
              </div>
              <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
                <p style="font-size:15px;margin:0 0 8px">
                  הטננט <b>${tenantId}</b> נמצא על <b style="color:${color}">${(pct * 100).toFixed(1)}%</b>
                  ממגבלת התאים של Google Sheets.
                </p>
                <p style="color:#475569;font-size:13px;margin:0 0 16px">
                  ${cells.toLocaleString()} תאים מתוך ${CELL_LIMIT.toLocaleString()}
                  ${isCrit ? "— שמירות עלולות להיכשל בקרוב. נדרש פיצול קובץ או ניקוי גיליונות." : "— מומלץ לתכנן פיצול או ניקוי בחודשים הקרובים."}
                </p>
                <table style="border-collapse:collapse;width:100%;font-size:13px">
                  <thead>
                    <tr style="background:#f8fafc">
                      <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">גיליון</th>
                      <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">שורות</th>
                      <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right">תאים</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
                <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">הודעה אוטומטית ממערכת לו״ז — ניטור קיבולת</p>
              </div>
            </div>
          `
          const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@resend.dev"
          await resend.emails.send({
            from: fromEmail,
            to: adminEmail,
            subject: `${isCrit ? "🔴 דחוף" : "🟡"} קיבולת Sheets — ${tenantId} על ${(pct * 100).toFixed(1)}%`,
            html,
          })
        }
      } catch (err: unknown) {
        capacity.push({ tenant: tenantId, cells: 0, pct: "?", level: "error", error: err instanceof Error ? err.message : String(err) })
      }
    }
  } catch { /* GOOGLE_SA_KEY לא מוגדר — מדלגים על הניטור */ }

  return NextResponse.json({ ok: true, results, sheetsCapacity: capacity })
}
