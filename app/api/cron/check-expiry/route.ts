import { NextResponse } from "next/server"
import { Resend } from "resend"
import fs from "fs"
import path from "path"
import { loadTenantConfigServer, getTenantApiKey } from "@/lib/tenant-config"
import { createTeableClient } from "@/lib/teable-client-tenant"

const WARN_DAYS = 7

function getDaysUntilExpiry(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
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

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`
  } catch { return "—" }
}

export async function GET(request: Request) {
  // אימות secret
  const url = new URL(request.url)
  const secret = url.searchParams.get("secret")
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results: { tenant: string; sent: boolean; alerts: number; error?: string }[] = []

  // טען את כל הטננטים
  const tenantsDir = path.join(process.cwd(), "config", "tenants")
  const tenantFiles = fs.readdirSync(tenantsDir).filter(f => f.endsWith(".json"))

  for (const file of tenantFiles) {
    const tenantId = file.replace(".json", "")
    
    try {
      const config = await loadTenantConfigServer(tenantId)
      if (!config || !config.tables.COMPANY_VEHICLES || !config.fields.companyVehicles) {
        results.push({ tenant: tenantId, sent: false, alerts: 0, error: "no company vehicles config" })
        continue
      }

      // בדוק אם יש מייל מוגדר
      const alertEmail = process.env.ALERT_EMAIL
      if (!alertEmail) {
        results.push({ tenant: tenantId, sent: false, alerts: 0, error: "no ALERT_EMAIL env var" })
        continue
      }

      const apiKey = getTenantApiKey(tenantId)
      if (!apiKey) {
        results.push({ tenant: tenantId, sent: false, alerts: 0, error: "no API key" })
        continue
      }

      const client = createTeableClient(config, tenantId)
      const CV = config.fields.companyVehicles

      // שלוף את כל רכבי החברה
      const allRecords: any[] = []
      let offset: string | undefined
      while (true) {
        const res = await client.getRecords(config.tables.COMPANY_VEHICLES, { take: 200, skip: allRecords.length })
        const batch = res.records || []
        if (batch.length === 0) break
        allRecords.push(...batch)
        if (batch.length < 200) break
      }

      // בדוק תוקפים
      const alerts: {
        carNumber: string
        insuranceDays: number | null
        insuranceDate: string
        permitDays: number | null
        permitDate: string
        licenseDays: number | null
        licenseDate: string
      }[] = []

      for (const rec of allRecords) {
        const f = rec.fields
        const carNumber = String(f[CV.CAR_NUMBER] || "—")
        const insDays = getDaysUntilExpiry(f[CV.INSURANCE_EXPIRY])
        const permDays = getDaysUntilExpiry(f[CV.OPERATION_PERMIT_EXPIRY])
        const licDays = getDaysUntilExpiry(f[CV.VEHICLE_LICENSE_EXPIRY])

        const hasAlert = (insDays !== null && insDays <= WARN_DAYS) ||
                         (permDays !== null && permDays <= WARN_DAYS) ||
                         (licDays !== null && licDays <= WARN_DAYS)

        if (hasAlert) {
          alerts.push({
            carNumber,
            insuranceDays: insDays,
            insuranceDate: formatDate(f[CV.INSURANCE_EXPIRY]),
            permitDays: permDays,
            permitDate: formatDate(f[CV.OPERATION_PERMIT_EXPIRY]),
            licenseDays: licDays,
            licenseDate: formatDate(f[CV.VEHICLE_LICENSE_EXPIRY]),
          })
        }
      }

      if (alerts.length === 0) {
        results.push({ tenant: tenantId, sent: false, alerts: 0 })
        continue
      }

      // בנה HTML למייל
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

      results.push({ tenant: tenantId, sent: true, alerts: alerts.length })
    } catch (err: any) {
      results.push({ tenant: tenantId, sent: false, alerts: 0, error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
