import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;
    const API_URL = config.apiUrl;
    const BASE_ID = config.baseId;

    const formData = await request.formData()
    const file = formData.get("file") as File
    const tableId = formData.get("tableId") as string
    const recordId = formData.get("recordId") as string | null
    const fieldId = formData.get("fieldId") as string

    if (!file || !tableId || !fieldId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Step 1: Get upload signature
    const signatureResponse = await fetch(`${API_URL}/api/attachments/signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, contentLength: file.size, type: 1, baseId: BASE_ID }),
    })

    if (!signatureResponse.ok) {
      const errorText = await signatureResponse.text()
      throw new Error(`Failed to get upload signature: ${errorText}`)
    }
    const signature = await signatureResponse.json()

    // Step 2: Upload file to storage
    const fileBuffer = await file.arrayBuffer()
    const uploadHeaders = { ...signature.requestHeaders }
    delete uploadHeaders["Content-Length"]

    const uploadResponse = await fetch(signature.url, {
      method: signature.uploadMethod,
      headers: uploadHeaders,
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(`Failed to upload file: ${errorText}`)
    }
    await uploadResponse.text()

    // Step 3: Notify Teable
    const notifyUrl = `${API_URL}/api/attachments/notify/${signature.token}?filename=${encodeURIComponent(file.name)}`
    const notifyResponse = await fetch(notifyUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    if (!notifyResponse.ok) {
      const errorText = await notifyResponse.text()
      throw new Error(`Failed to notify Teable: ${errorText}`)
    }

    const attachmentData = await notifyResponse.json()
    return NextResponse.json({
      name: file.name,
      token: attachmentData.token,
      size: attachmentData.size,
      mimetype: attachmentData.mimetype,
      presignedUrl: attachmentData.presignedUrl,
    })
  } catch (error) {
    console.error("Error uploading attachment:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
