// ניהול נסיעות קבועות (תבניות) ב-localStorage

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

export function loadRecurringRides(tenantId: string): RecurringRide[] {
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

export function saveRecurringRides(tenantId: string, rides: RecurringRide[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY(tenantId), JSON.stringify(rides))
}

export function addRecurringRide(tenantId: string, ride: Omit<RecurringRide, "id" | "createdAt" | "updatedAt">): RecurringRide {
  const rides = loadRecurringRides(tenantId)
  const newRide: RecurringRide = {
    ...ride, id: crypto.randomUUID(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  rides.push(newRide)
  saveRecurringRides(tenantId, rides)
  return newRide
}

export function updateRecurringRide(tenantId: string, id: string, updates: Partial<RecurringRide>): void {
  const rides = loadRecurringRides(tenantId)
  const idx = rides.findIndex(r => r.id === id)
  if (idx === -1) return
  rides[idx] = { ...rides[idx], ...updates, updatedAt: new Date().toISOString() }
  saveRecurringRides(tenantId, rides)
}

export function deleteRecurringRide(tenantId: string, id: string): void {
  const rides = loadRecurringRides(tenantId).filter(r => r.id !== id)
  saveRecurringRides(tenantId, rides)
}

export function getActiveRidesForDay(tenantId: string, dayOfWeek: number): RecurringRide[] {
  return loadRecurringRides(tenantId).filter(r => r.active && r.activeDays.includes(dayOfWeek))
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
