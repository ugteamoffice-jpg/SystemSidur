// ניהול נסיעות קבועות (תבניות) — נשמרות בשרת (Google Sheets, טאב "נסיעות קבועות")
// כולל מיגרציה חד-פעמית אוטומטית מ-localStorage לשרת.

export interface DaySettings {
  pickupTime: string
  dropoffTime: string
  driverId: string
  driverName: string
  vehicleTypeId: string
  vehicleTypeName: string
  vehicleNum: string
  driverNotes: string
  managerNotes: string
  clientExcl: string
  clientIncl: string
  driverExcl: string
  driverIncl: string
}

export interface RecurringRide {
  id: string
  // פרטים משותפים (לא משתנים לפי יום)
  customerId: string
  customerName: string
  description: string
  orderName: string
  mobile: string
  idNum: string
  // תוקף הקו (אופציונלי, yyyy-MM-dd; ריק = ללא הגבלה)
  lineStartDate?: string
  lineEndDate?: string
  // ברירת מחדל (לימים ללא הגדרה ספציפית)
  defaults: DaySettings
  // הגדרות ספציפיות ליום (0=ראשון..6=שבת) — רק שדות שונים מברירת מחדל
  dayOverrides: { [day: number]: Partial<DaySettings> }
  // ימים פעילים
  activeDays: number[]
  // מצב
  active: boolean
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = (tenantId: string) => `recurring-rides-${tenantId}`
const MIGRATED_KEY = (tenantId: string) => `recurring-rides-migrated-${tenantId}`
const API = (tenantId: string) => `/api/recurring-rides?tenant=${encodeURIComponent(tenantId)}`

/* ---------- קריאה מ-localStorage (למיגרציה בלבד) ---------- */

function loadLocalRides(tenantId: string): RecurringRide[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(tenantId))
    if (!raw) return []
    const rides = JSON.parse(raw)
    return rides.map((r: any) => {
      if (r.defaults) return r
      // Migration from old format
      return {
        id: r.id, customerId: r.customerId || "", customerName: r.customerName || "",
        description: r.description || "", orderName: r.orderName || "",
        mobile: r.mobile || "", idNum: r.idNum || "",
        defaults: {
          pickupTime: r.pickupTime || "", dropoffTime: r.dropoffTime || "",
          driverId: r.driverId || "", driverName: r.driverName || "",
          vehicleTypeId: r.vehicleTypeId || "", vehicleTypeName: r.vehicleTypeName || "",
          vehicleNum: r.vehicleNum || "", driverNotes: r.driverNotes || "",
          managerNotes: r.managerNotes || "",
          clientExcl: r.defaultPrices?.clientExcl || "", clientIncl: r.defaultPrices?.clientIncl || "",
          driverExcl: r.defaultPrices?.driverExcl || "", driverIncl: r.defaultPrices?.driverIncl || "",
        },
        dayOverrides: {}, activeDays: r.activeDays || [],
        active: r.active ?? true, createdAt: r.createdAt || "", updatedAt: r.updatedAt || "",
      }
    })
  } catch { return [] }
}

/* ---------- API מול השרת ---------- */

export async function loadRecurringRides(tenantId: string): Promise<RecurringRide[]> {
  const res = await fetch(API(tenantId), { cache: "no-store" })
  if (!res.ok) throw new Error(`Failed to load recurring rides: ${res.status}`)
  let rides: RecurringRide[] = (await res.json()).rides || []

  // מיגרציה חד-פעמית: אם לשרת אין תבניות וב-localStorage יש — מעלים לשרת
  if (typeof window !== "undefined" && !localStorage.getItem(MIGRATED_KEY(tenantId))) {
    if (rides.length === 0) {
      const local = loadLocalRides(tenantId)
      if (local.length > 0) {
        const up = await fetch(API(tenantId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rides: local }),
        })
        if (!up.ok) throw new Error(`Migration to server failed: ${up.status}`)
        rides = (await up.json()).rides || []
        console.log(`[recurring-rides] migrated ${rides.length} templates from localStorage to server`)
      }
    }
    // הנתונים המקומיים נשארים כגיבוי — רק מסמנים שהמיגרציה הושלמה
    try { localStorage.setItem(MIGRATED_KEY(tenantId), new Date().toISOString()) } catch {}
  }

  return rides
}

export async function addRecurringRide(
  tenantId: string,
  ride: Omit<RecurringRide, "id" | "createdAt" | "updatedAt">
): Promise<RecurringRide> {
  const res = await fetch(API(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ride }),
  })
  if (!res.ok) throw new Error(`Failed to add recurring ride: ${res.status}`)
  const data = await res.json()
  return data.rides[0]
}

export async function updateRecurringRide(
  tenantId: string,
  id: string,
  updates: Partial<RecurringRide>
): Promise<RecurringRide> {
  const res = await fetch(API(tenantId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId: id, updates }),
  })
  if (!res.ok) throw new Error(`Failed to update recurring ride: ${res.status}`)
  return (await res.json()).ride
}

export async function deleteRecurringRide(tenantId: string, id: string): Promise<void> {
  const res = await fetch(`${API(tenantId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`Failed to delete recurring ride: ${res.status}`)
}

export async function getActiveRidesForDay(tenantId: string, dayOfWeek: number): Promise<RecurringRide[]> {
  const rides = await loadRecurringRides(tenantId)
  return rides.filter(r => r.active && r.activeDays.includes(dayOfWeek))
}

/* ---------- Helpers ---------- */

// האם הקו בתוקף בתאריך נתון (yyyy-MM-dd). שדה ריק = ללא הגבלה מהצד הזה.
export function isRideActiveOnDate(ride: RecurringRide, dateStr: string): boolean {
  if (ride.lineStartDate && dateStr < ride.lineStartDate) return false
  if (ride.lineEndDate && dateStr > ride.lineEndDate) return false
  return true
}

export function getSettingsForDay(ride: RecurringRide, dayOfWeek: number): DaySettings {
  const overrides = ride.dayOverrides[dayOfWeek] || {}
  const merged = { ...ride.defaults }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && v !== "") (merged as any)[k] = v
  }
  return merged
}

export const EMPTY_DAY_SETTINGS: DaySettings = {
  pickupTime: "", dropoffTime: "", driverId: "", driverName: "",
  vehicleTypeId: "", vehicleTypeName: "", vehicleNum: "",
  driverNotes: "", managerNotes: "",
  clientExcl: "", clientIncl: "", driverExcl: "", driverIncl: "",
}

export const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
export const DAY_LETTERS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
