// lib/tenant-config.ts
// מיפוי מרכזי של כל שדות ה-Teable לפי tenant

export interface TenantConfig {
  id: string
  name: string
  apiUrl: string
  baseId: string
  tables: {
    WORK_SCHEDULE: string
    WORK_SCHEDULE_VIEW: string
    DRIVERS: string
    CUSTOMERS: string
    VEHICLES: string
    VEHICLE_TYPES: string
  }
  fields: {
    workSchedule: {
      DATE: string
      CUSTOMER: string
      PICKUP_TIME: string
      DESCRIPTION: string
      DROPOFF_TIME: string
      VEHICLE_TYPE: string
      DRIVER: string
      VEHICLE_NUM: string
      SENT: string
      APPROVED: string
      PRICE_CLIENT_EXCL: string
      PRICE_CLIENT_INCL: string
      PRICE_DRIVER_EXCL: string
      PRICE_DRIVER_INCL: string
      PROFIT: string
      DRIVER_NOTES: string
      MANAGER_NOTES: string
      ORDER_NAME: string
      MOBILE: string
      ID_NUM: string
      ORDER_FORM: string
      ORDER_FORM_DATE: string
      DRIVER_LINK_SYMMETRIC: string
      SENT_RESET: string
      ORDER_FORM_ATTACHMENT: string
    }
    drivers: {
      FIRST_NAME: string
      LAST_NAME: string
      PHONE: string
      DRIVER_TYPE: string
      CAR_NUMBER: string
      STATUS: string
    }
    customers: {
      NAME: string
      HP: string
      CONTACT_NAME: string
      PHONE: string
      EMAIL: string
      PAYMENT_METHOD: string
      ONGOING_PAYMENT: string
      ACCOUNTING_KEY: string
      CREATED_IN_ACCOUNTING: string
      STATUS: string
    }
    vehicles: {
      VEHICLE_TYPE: string
    }
  }
}

// cache לקונפיגים שכבר נטענו
const configCache: Record<string, TenantConfig> = {}

/**
 * טעינת config בצד שרת (API routes, middleware)
 * ה-API key נשלף מ-env variable: TEABLE_API_KEY_{TENANT_ID}
 */
export async function loadTenantConfigServer(tenantId: string): Promise<TenantConfig | null> {
  if (configCache[tenantId]) return configCache[tenantId]

  try {
    const fs = await import("fs/promises")
    const path = await import("path")
    const filePath = path.join(process.cwd(), "config", "tenants", `${tenantId}.json`)
    const data = await fs.readFile(filePath, "utf-8")
    const config = JSON.parse(data) as TenantConfig
    configCache[tenantId] = config
    return config
  } catch (err) {
    console.error(`[Tenant] Failed to load config for "${tenantId}":`, err)
    return null
  }
}

/**
 * שליפת API key עבור tenant מ-env variables
 * מחפש: TEABLE_API_KEY_{TENANT_ID} → TEABLE_API_KEY
 */
export function getTenantApiKey(tenantId: string): string {
  const specificKey = process.env[`TEABLE_API_KEY_${tenantId.toUpperCase()}`]
  if (specificKey) return specificKey
  // fallback ל-default keys (שני שמות אפשריים)
  return process.env.TEABLE_API_KEY || process.env.TEABLE_APP_TOKEN || ""
}

/**
 * רשימת כל ה-tenants הזמינים (לדף כניסה או admin)
 */
export async function listTenants(): Promise<string[]> {
  try {
    const fs = await import("fs/promises")
    const path = await import("path")
    const dir = path.join(process.cwd(), "config", "tenants")
    const files = await fs.readdir(dir)
    return files
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => f.replace(".json", ""))
  } catch {
    return []
  }
}

/**
 * שמירה ב-cache בצד client (אחרי שנטען מ-API)
 */
export function cacheTenantConfig(config: TenantConfig) {
  configCache[config.id] = config
}

/**
 * שליפה מ-cache
 */
export function getCachedConfig(tenantId: string): TenantConfig | null {
  return configCache[tenantId] || null
}
