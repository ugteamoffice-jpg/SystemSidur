import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const tableId = formData.get("tableId") as string
    const recordId = formData.get("recordId") as string | null
    const fieldId = formData.get("fieldId") as string

    console.log("[v0] Upload request received:", {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      tableId,
      fieldId,
      recordId,
    })

    if (!file || !tableId || !fieldId) {
      console.error("[v0] Missing required fields:", { file: !!file, tableId: !!tableId, fieldId: !!fieldId })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const TEABLE_API_URL = process.env.TEABLE_API_URL
    const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN

    console.log("[v0] Environment:", {
      hasApiUrl: !!TEABLE_API_URL,
      hasToken: !!TEABLE_APP_TOKEN,
    })

    // Step 1: Get upload signature
    console.log("[v0] Step 1: Getting upload signature...")
    const signatureResponse = await fetch(`${TEABLE_API_URL}/api/attachments/signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType: file.type,
        contentLength: file.size,
        type: 1,
        baseId: "bse1pHlESYWysI2D4VR",
      }),
    })

    console.log("[v0] Signature response status:", signatureResponse.status)

    if (!signatureResponse.ok) {
      const errorText = await signatureResponse.text()
      console.error("[v0] Failed to get signature:", errorText)
      throw new Error(`Failed to get upload signature: ${errorText}`)
    }

    const signature = await signatureResponse.json()
    console.log("[v0] Got signature:", { token: signature.token, uploadMethod: signature.uploadMethod })

    // Step 2: Upload file to storage
    console.log("[v0] Step 2: Uploading file to storage...")
    const fileBuffer = await file.arrayBuffer()

    const uploadHeaders = { ...signature.requestHeaders }
    delete uploadHeaders["Content-Length"] // Will be set automatically

    console.log("[v0] Upload URL:", signature.url)
    console.log("[v0] Upload method:", signature.uploadMethod)
    console.log("[v0] Upload headers:", uploadHeaders)
    console.log("[v0] File buffer size:", fileBuffer.byteLength)

    const uploadResponse = await fetch(signature.url, {
      method: signature.uploadMethod,
      headers: uploadHeaders,
      body: fileBuffer,
    })

    console.log("[v0] Upload response status:", uploadResponse.status)
    console.log("[v0] Upload response headers:", Object.fromEntries(uploadResponse.headers.entries()))

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error("[v0] Failed to upload file to storage:", errorText)
      throw new Error(`Failed to upload file: ${errorText}`)
    }

    const uploadResponseText = await uploadResponse.text()
    console.log("[v0] Upload response body:", uploadResponseText)

    // Step 3: Notify Teable
    console.log("[v0] Step 3: Notifying Teable...")
    console.log("[v0] Notify token:", signature.token)
    console.log("[v0] Notify filename:", file.name)

    const notifyUrl = `${TEABLE_API_URL}/api/attachments/notify/${signature.token}?filename=${encodeURIComponent(file.name)}`
    console.log("[v0] Notify URL:", notifyUrl)

    const notifyResponse = await fetch(notifyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })

    console.log("[v0] Notify response status:", notifyResponse.status)

    if (!notifyResponse.ok) {
      const errorText = await notifyResponse.text()
      console.error("[v0] Failed to notify Teable:", errorText)
      throw new Error(`Failed to notify Teable: ${errorText}`)
    }

    const attachmentData = await notifyResponse.json()
    console.log("[v0] Upload successful! Token:", attachmentData.token)

    // Return the attachment in Teable format
    return NextResponse.json({
      name: file.name,
      token: attachmentData.token,
      size: attachmentData.size,
      mimetype: attachmentData.mimetype,
      presignedUrl: attachmentData.presignedUrl,
    })
  } catch (error) {
    console.error("[v0] Error uploading attachment:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
