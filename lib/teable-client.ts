const TEABLE_API_URL = process.env.TEABLE_API_URL
const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN

if (!TEABLE_API_URL || !TEABLE_APP_TOKEN) {
  throw new Error("Missing TEABLE_API_URL or TEABLE_APP_TOKEN")
}

export const teableClient = {
  async getRecords(
    tableId: string,
    options?: {
      fieldKeyType?: "id" | "name"
      cellFormat?: "json" | "text"
      take?: number
      skip?: number
      filter?: object
      orderBy?: object
    },
  ) {
    const params = new URLSearchParams({
      fieldKeyType: options?.fieldKeyType || "id",
      ...(options?.cellFormat && { cellFormat: options.cellFormat }),
      ...(options?.take && { take: options.take.toString() }),
      ...(options?.skip && { skip: options.skip.toString() }),
      ...(options?.filter && { filter: JSON.stringify(options.filter) }),
      ...(options?.orderBy && { orderBy: JSON.stringify(options.orderBy) }),
    })

    const response = await fetch(`${TEABLE_API_URL}/api/table/${tableId}/record?${params}`, {
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch records: ${response.statusText}`)
    }

    return response.json()
  },

  async fetchTableSchema(tableId: string) {
    const response = await fetch(`${TEABLE_API_URL}/api/table/${tableId}/field`, {
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`)
    }

    return response.json()
  },

  async updateRecord(tableId: string, recordId: string, fields: Record<string, any>) {
    const response = await fetch(`${TEABLE_API_URL}/api/table/${tableId}/record/${recordId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fieldKeyType: "id",
        typecast: true,
        record: {
          fields,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update record: ${response.statusText}`)
    }

    return response.json()
  },

  async createRecord(tableId: string, fields: Record<string, any>) {
    console.log("[v0] teableClient.createRecord: fields received:", JSON.stringify(fields, null, 2))
    console.log("[v0] teableClient.createRecord: fldf2FIOvHqALxULqrs field:", fields.fldf2FIOvHqALxULqrs)

    const payload = {
      fieldKeyType: "id",
      typecast: true,
      records: [{ fields }],
    }

    console.log("[v0] teableClient.createRecord: payload to send:", JSON.stringify(payload, null, 2))

    const response = await fetch(`${TEABLE_API_URL}/api/table/${tableId}/record`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] teableClient.createRecord: error response:", errorText)
      let errorDetails
      try {
        errorDetails = JSON.parse(errorText)
      } catch {
        errorDetails = errorText
      }
      const error = new Error(`Failed to create record: ${response.statusText}`)
      ;(error as any).details = errorDetails
      ;(error as any).status = response.status
      throw error
    }

    const result = await response.json()
    console.log("[v0] teableClient.createRecord: success response:", JSON.stringify(result, null, 2))
    return result
  },

  async deleteRecord(tableId: string, recordId: string) {
    const response = await fetch(`${TEABLE_API_URL}/api/table/${tableId}/record/${recordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete record: ${response.statusText}`)
    }

    return response.json()
  },
}
