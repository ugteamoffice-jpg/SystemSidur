// lib/field-resolver.ts
// Auto-discovers field IDs from Teable by matching Hebrew field names
// This means tenant JSON files only need table IDs — field IDs are resolved automatically

import { getTenantApiKey } from '@/lib/tenant-config'

// Cache: tenantId -> tableKey -> { fieldKey -> fieldId }
const fieldCache: Record<string, Record<string, Record<string, string>>> = {}

/**
 * Fetch all fields for a table from Teable and return name->id map
 */
async function fetchTableFields(apiUrl: string, tableId: string, apiKey: string): Promise<Record<string, string>> {
  if (!tableId) return {}
  try {
    const res = await fetch(`${apiUrl}/api/table/${tableId}/field`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store'
    })
    if (!res.ok) return {}
    const data = await res.json()
    const fields = data?.fields || data || []
    const map: Record<string, string> = {}
    for (const f of fields) {
      if (f.name && f.id) map[f.name] = f.id
    }
    return map
  } catch {
    return {}
  }
}

/**
 * Resolve field IDs for a tenant by matching Hebrew field names.
 * Falls back to hardcoded IDs from config if available.
 * Caches results per tenant.
 */
export async function resolveFields(
  tenantId: string,
  config: any
): Promise<any> {
  // Return cached if available
  if (fieldCache[tenantId]) {
    return buildFieldsFromCache(tenantId, config)
  }

  const apiKey = getTenantApiKey(tenantId)
  const apiUrl = config.apiUrl
  const tables = config.tables

  // Load field name map
  let fieldNames: any = {}
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const p = path.join(process.cwd(), 'config', 'field-names.json')
    fieldNames = JSON.parse(await fs.readFile(p, 'utf-8'))
  } catch {
    console.error('[FieldResolver] Could not load field-names.json')
    return config.fields
  }

  // Fetch fields for each table in parallel
  const tableKeys: Record<string, string> = {
    workSchedule: tables.WORK_SCHEDULE || tables.WORK_SCHEDULE_VIEW,
    drivers: tables.DRIVERS,
    customers: tables.CUSTOMERS,
    companyVehicles: tables.COMPANY_VEHICLES,
    driverHours: tables.DRIVER_HOURS,
  }

  const cache: Record<string, Record<string, string>> = {}
  await Promise.all(
    Object.entries(tableKeys).map(async ([key, tableId]) => {
      if (!tableId) return
      cache[key] = await fetchTableFields(apiUrl, tableId, apiKey)
    })
  )
  fieldCache[tenantId] = cache

  return buildFieldsFromCache(tenantId, config, fieldNames)
}

function buildFieldsFromCache(tenantId: string, config: any, fieldNames?: any): any {
  const cache = fieldCache[tenantId]
  if (!cache || !fieldNames) return config.fields

  const resolved: any = {}

  for (const [tableKey, nameMap] of Object.entries(fieldNames) as [string, any][]) {
    const tableCache = cache[tableKey] || {}
    const existingFields = config.fields?.[tableKey] || {}
    resolved[tableKey] = {}

    for (const [fieldKey, hebrewName] of Object.entries(nameMap) as [string, string][]) {
      // Priority: 1) resolved from Teable by name, 2) existing hardcoded ID
      const resolvedId = tableCache[hebrewName]
      const fallbackId = existingFields[fieldKey] || ''
      resolved[tableKey][fieldKey] = resolvedId || fallbackId
    }
  }

  return resolved
}

/**
 * Clear cache for a tenant (useful after config changes)
 */
export function clearFieldCache(tenantId?: string) {
  if (tenantId) {
    delete fieldCache[tenantId]
  } else {
    Object.keys(fieldCache).forEach(k => delete fieldCache[k])
  }
}
