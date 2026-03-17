// lib/teable-client-tenant.ts
// Teable client שמקבל config של tenant במקום hardcoded values

import { type TenantConfig, getTenantApiKey } from "@/lib/tenant-config"

export function createTeableClient(config: TenantConfig, tenantId: string) {
  const BASE_URL = config.apiUrl
  const API_URL = `${BASE_URL}/api`
  const API_KEY = getTenantApiKey(tenantId)

  return {
    async getRecords(tableId: string, query?: any) {
      if (!API_KEY) throw new Error("Missing TEABLE_API_KEY")

      const url = new URL(`${API_URL}/table/${tableId}/record`)
      if (query)
        Object.keys(query).forEach((key) => url.searchParams.append(key, query[key]))

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      })

      if (!res.ok) throw new Error(`Fetch failed: ${await res.text()}`)
      return await res.json()
    },

    async createRecord(tableId: string, fields: any) {
      if (!API_KEY) throw new Error("Missing TEABLE_API_KEY")

      const res = await fetch(`${API_URL}/table/${tableId}/record`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldKeyType: "id",
          typecast: true,
          records: [{ fields }],
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error("Teable Create Error:", err)
        throw new Error(`Teable Create Error: ${err}`)
      }

      const data = await res.json()
      if (data.records && Array.isArray(data.records)) {
        return data.records[0]
      }
      return data
    },

    async updateRecord(tableId: string, recordId: string, fields: any) {
      if (!API_KEY) throw new Error("Missing TEABLE_API_KEY")

      const url = `${API_URL}/table/${tableId}/record`

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldKeyType: "id",
          typecast: true,
          records: [{ id: recordId, fields }],
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.error(`Teable Update Failed.`, errorText)
        throw new Error(`Teable Error: ${errorText}`)
      }

      const data = await res.json()
      if (data.records && Array.isArray(data.records)) {
        return data.records[0]
      }
      return data
    },

    async deleteRecord(tableId: string, recordId: string) {
      if (!API_KEY) throw new Error("Missing TEABLE_API_KEY")

      const res = await fetch(`${API_URL}/table/${tableId}/record/${recordId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_KEY}` },
      })

      if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`)
      return true
    },

    // helper: fetch עם auth (לשימוש ישיר)
    async fetchWithAuth(path: string, options?: RequestInit) {
      if (!API_KEY) throw new Error("Missing TEABLE_API_KEY")

      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          ...options?.headers,
        },
      })
      return res
    },

    // properties
    apiUrl: API_URL,
    baseUrl: BASE_URL,
    baseId: config.baseId,
    apiKey: API_KEY,
  }
}
