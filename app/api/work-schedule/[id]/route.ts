import { NextResponse } from "next/server";
import { teableClient } from "@/lib/teable-client";

// זה ה-ID של הטבלה שלך (וודא שהוא תואם לטבלה ב-Teable)
const TABLE_ID = "tblVAQgfYOLfvCZdqqj"; 

// הוספתי את זה כדי שאם תיכנס לכתובת בדפדפן, תראה שהיא קיימת
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ message: "Work schedule API is working", id: params.id });
}

// פונקציית העדכון (כאן הוספתי הדפסה של השגיאה המדויקת)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    console.log(`Trying to update record: ${id}`);
    console.log(`Data sent:`, JSON.stringify(body.fields));

    const result = await teableClient.updateRecord(TABLE_ID, id, body.fields);

    return NextResponse.json(result);
  } catch (error: any) {
    // *** זה החלק החשוב לדיבוג ***
    // זה יחזיר לך לדפדפן את השגיאה האמיתית של Teable
    console.error("Critical Update Error:", error);
    return NextResponse.json(
      { 
        error: "Update Failed", 
        details: error.message || error.toString() 
      },
      { status: 500 }
    );
  }
}

// פונקציית המחיקה
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await teableClient.deleteRecord(TABLE_ID, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Delete Failed" }, { status: 500 });
  }
}
