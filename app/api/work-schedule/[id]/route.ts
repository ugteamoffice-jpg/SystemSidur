import { NextResponse } from "next/server"

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    // שליפת משתני הסביבה - שים לב שאנחנו משתמשים ב-APP_TOKEN ו-BASE_ID
    const TEABLE_API_URL = process.env.TEABLE_API_URL || "https://app.teable.io"
    const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN
    const BASE_ID = "base_xxxxxxxxxxxx" // ה-ID של הבסיס שלך
    const TABLE_ID = "tblVAQgfYOLfvCZdqqj" // ה-ID של הטבלה מהגיבוי שלך 

    if (!TEABLE_APP_TOKEN) {
      return NextResponse.json({ error: "Missing API Token" }, { status: 500 })
    }

    // הפנייה ישירה ל-API של Teable למחיקת רשומה
    const response = await fetch(
      `${TEABLE_API_URL}/api/base/${BASE_ID}/table/${TABLE_ID}/record/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Teable error:", errorData)
      return NextResponse.json({ error: "Failed to delete from Teable" }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API Route Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
